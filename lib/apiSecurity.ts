import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const defaultMaximumBodyBytes = 16 * 1024;

export type JsonObject = Record<string, unknown>;

export async function readJsonObject(
  request: Request,
  maximumBodyBytes = defaultMaximumBodyBytes,
): Promise<
  | { data: JsonObject; error: null }
  | { data: null; error: Response }
> {
  const contentType = request.headers.get("content-type")?.toLowerCase() || "";
  if (!contentType.includes("application/json")) {
    return {
      data: null,
      error: Response.json({ error: "Ожидается JSON" }, { status: 415 }),
    };
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > maximumBodyBytes) {
    return {
      data: null,
      error: Response.json({ error: "Запрос слишком большой" }, { status: 413 }),
    };
  }

  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > maximumBodyBytes) {
      return {
        data: null,
        error: Response.json({ error: "Запрос слишком большой" }, { status: 413 }),
      };
    }

    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Invalid JSON object");
    }

    return { data: parsed as JsonObject, error: null };
  } catch {
    return {
      data: null,
      error: Response.json({ error: "Некорректный JSON" }, { status: 400 }),
    };
  }
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    const requestOrigin = new URL(request.url);
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const host = forwardedHost || request.headers.get("host")?.trim();
    const forwardedProtocol = request.headers
      .get("x-forwarded-proto")
      ?.split(",")[0]
      ?.trim();

    if (host) requestOrigin.host = host;
    if (forwardedProtocol) requestOrigin.protocol = `${forwardedProtocol}:`;

    return new URL(origin).origin === requestOrigin.origin;
  } catch {
    return false;
  }
}

function getClientAddress(request: Request) {
  const forwardedAddress =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("x-forwarded-for")?.split(",")[0];

  return forwardedAddress?.trim().slice(0, 128) || "unknown";
}

function hashIdentity(route: string, identity: string) {
  return createHash("sha256")
    .update(`couple-space:${route}:${identity}`)
    .digest("hex");
}

export async function enforceRateLimit(
  adminSupabase: SupabaseClient,
  request: Request,
  options: {
    route: string;
    limit: number;
    windowMs: number;
    identity?: string;
  },
) {
  const identity = options.identity || getClientAddress(request);
  const identityHash = hashIdentity(options.route, identity);
  const windowSeconds = Math.max(1, Math.ceil(options.windowMs / 1000));
  const { data, error } = await adminSupabase.rpc("consume_api_rate_limit", {
    p_route: options.route,
    p_identity_hash: identityHash,
    p_window_seconds: windowSeconds,
    p_limit: options.limit,
  });

  const result = Array.isArray(data)
    ? (data[0] as
        | {
            allowed?: boolean;
            request_count?: number;
            retry_after_seconds?: number;
          }
        | undefined)
    : undefined;

  if (error || typeof result?.allowed !== "boolean") {
    console.error("Rate limit service error", error?.message || "Invalid RPC response");
    return Response.json(
      { error: "Защита от частых запросов временно недоступна. Попробуйте позже." },
      {
        status: 503,
        headers: { "Retry-After": "10" },
      },
    );
  }

  if (result.allowed) return null;

  const retryAfter = Math.max(1, result.retry_after_seconds || windowSeconds);
  return Response.json(
    { error: "Слишком много запросов. Попробуйте позже." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfter) },
    },
  );
}
