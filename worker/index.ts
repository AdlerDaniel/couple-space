import {
  DEFAULT_DEVICE_SIZES,
  DEFAULT_IMAGE_SIZES,
  handleImageOptimization,
} from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

const defaultSupabaseUrl = "https://adyfbxbmfrdetzdxdmmh.supabase.co";

interface Env {
  ASSETS: Fetcher;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: {
          format: string;
          quality: number;
        }): Promise<{ response(): Response }>;
      };
    };
  };
}

function getSupabaseUpstream(request: Request, env?: Env) {
  const configuredUrl = env?.NEXT_PUBLIC_SUPABASE_URL || defaultSupabaseUrl;
  if (!configuredUrl) return null;

  const base = new URL(configuredUrl);
  if (base.protocol !== "https:" || !base.hostname.endsWith(".supabase.co")) {
    return null;
  }

  const incoming = new URL(request.url);
  const upstream = new URL(base);
  upstream.pathname = incoming.pathname.slice("/supabase".length) || "/";
  upstream.search = incoming.search;
  return upstream;
}

async function proxySupabase(request: Request, env?: Env) {
  try {
    const upstream = getSupabaseUpstream(request, env);
    if (!upstream) {
      return new Response("Supabase proxy is not configured", { status: 503 });
    }

    return await fetch(new Request(upstream.toString(), request));
  } catch (error) {
    const incoming = new URL(request.url);
    const message = error instanceof Error ? error.message : "Unknown proxy error";
    return new Response(
      incoming.hostname === "127.0.0.1" || incoming.hostname === "localhost"
        ? message
        : "Supabase proxy request failed",
      { status: 502 },
    );
  }
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/supabase" || url.pathname.startsWith("/supabase/")) {
      return proxySupabase(request, env);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(
        request,
        {
          fetchAsset: (path) =>
            env.ASSETS.fetch(new Request(new URL(path, request.url))),
          transformImage: async (body, { width, format, quality }) => {
            const result = await env.IMAGES.input(body)
              .transform(width > 0 ? { width } : {})
              .output({ format, quality });
            return result.response();
          },
        },
        allowedWidths,
      );
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
