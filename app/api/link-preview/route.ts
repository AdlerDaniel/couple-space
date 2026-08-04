import { NextRequest } from "next/server";
import { resolve4, resolve6 } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import type { IncomingMessage } from "node:http";
import { enforceRateLimit } from "@/lib/apiSecurity";
import { getAdminClient, getAuthenticatedUser } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const maxPreviewBytes = 512 * 1024;
const maxUrlLength = 2048;
const maxRedirects = 3;

function readMeta(html: string, names: string[]) {
  for (const name of names) {
    const propertyPattern = new RegExp(
      `<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i"
    );
    const contentPattern = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name}["'][^>]*>`,
      "i"
    );
    const match = html.match(propertyPattern) || html.match(contentPattern);
    if (match?.[1]) return decodeHtml(match[1]);
  }

  return "";
}

function readTitle(html: string) {
  return decodeHtml(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || "");
}

function decodeHtml(value: string) {
  const entities: Record<string, string> = {
    "&quot;": "\"",
    "&#39;": "'",
    "&lt;": "<",
    "&gt;": ">",
    "&amp;": "&",
  };

  return value.replace(/&(?:quot|#39|lt|gt|amp);/g, (entity) => entities[entity]).trim();
}

function resolveUrl(value: string, baseUrl: string) {
  if (!value) return null;

  try {
    const resolvedUrl = new URL(value, baseUrl);
    return ["http:", "https:"].includes(resolvedUrl.protocol)
      ? resolvedUrl.toString()
      : null;
  } catch {
    return null;
  }
}

function isPrivateIPv4(address: string) {
  const parts = address.split(".").map((part) => Number(part));
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return true;
  }
  const [a, b] = parts;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function isPrivateIPv6(address: string) {
  const normalized = address.toLowerCase();

  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("::ffff:") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}

function isBlockedAddress(address: string) {
  const normalized = address.replace(/^\[|\]$/g, "");
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(normalized)) {
    return isPrivateIPv4(normalized);
  }
  if (normalized.includes(":")) return isPrivateIPv6(normalized);
  return true;
}

async function resolveHostAddresses(hostname: string) {
  const normalizedHostname = hostname.replace(/^\[|\]$/g, "");
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(normalizedHostname)) {
    return [normalizedHostname];
  }
  if (normalizedHostname.includes(":")) return [normalizedHostname];

  const results = await Promise.allSettled([
    resolve4(normalizedHostname),
    resolve6(normalizedHostname),
  ]);

  return results.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );
}

async function resolvePublicAddress(targetUrl: URL) {
  if (!["http:", "https:"].includes(targetUrl.protocol)) {
    throw new Error("Unsupported URL");
  }

  if (targetUrl.username || targetUrl.password || targetUrl.href.length > maxUrlLength) {
    throw new Error("Unsupported URL");
  }

  const normalizedHostname = targetUrl.hostname.replace(/^\[|\]$/g, "");
  const isLiteralAddress =
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(normalizedHostname) ||
    normalizedHostname.includes(":");

  if (isLiteralAddress && isBlockedAddress(normalizedHostname)) {
    throw new Error("Unsupported URL");
  }

  // Cloudflare Workers mediate outbound fetches and block internal network
  // services. Their production DNS shim does not implement lookup-style host
  // checks consistently, so Sites relies on that platform boundary while the
  // Node.js/Vercel target retains an explicit DNS preflight.
  if (process.env.DEPLOY_TARGET !== "sites") {
    const addresses = await resolveHostAddresses(normalizedHostname);
    if (addresses.length === 0 || addresses.some(isBlockedAddress)) {
      throw new Error("Unsupported URL");
    }

    // Pin the connection to the validated address. This closes the DNS
    // rebinding window between validation and the outbound request.
    return addresses[0];
  }

  return normalizedHostname;
}

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

async function readLimitedText(response: IncomingMessage) {
  const contentType = headerValue(response.headers["content-type"]);
  if (!contentType.toLowerCase().includes("text/html")) {
    throw new Error("Unsupported content type");
  }

  const contentLength = Number(headerValue(response.headers["content-length"]) || 0);
  if (contentLength > maxPreviewBytes) {
    throw new Error("Response too large");
  }

  const chunks: Buffer[] = [];
  let received = 0;

  for await (const chunk of response) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    received += buffer.byteLength;
    if (received > maxPreviewBytes) {
      response.destroy();
      throw new Error("Response too large");
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks).toString("utf8");
}

function requestAtAddress(targetUrl: URL, address: string) {
  return new Promise<IncomingMessage>((resolve, reject) => {
    const request = (targetUrl.protocol === "https:" ? httpsRequest : httpRequest)(
      {
        protocol: targetUrl.protocol,
        hostname: address,
        port: targetUrl.port || undefined,
        path: `${targetUrl.pathname}${targetUrl.search}`,
        method: "GET",
        family: address.includes(":") ? 6 : 4,
        servername: targetUrl.protocol === "https:" ? targetUrl.hostname : undefined,
        headers: {
          host: targetUrl.host,
          "user-agent": "Mozilla/5.0 CoupleSpaceLinkPreview/1.0",
          accept: "text/html,application/xhtml+xml",
        },
      },
      resolve,
    );

    request.setTimeout(6000, () => request.destroy(new Error("Request timed out")));
    request.on("error", reject);
    request.end();
  });
}

async function fetchPreviewResponse(initialUrl: URL) {
  let currentUrl = initialUrl;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const address = await resolvePublicAddress(currentUrl);
    const response = await requestAtAddress(currentUrl, address);
    const status = response.statusCode || 0;

    if (status < 300 || status >= 400) return response;

    const location = headerValue(response.headers.location);
    if (!location || redirectCount === maxRedirects) {
      response.resume();
      throw new Error("Too many redirects");
    }

    response.resume();
    currentUrl = new URL(location, currentUrl);
  }

  throw new Error("Too many redirects");
}

export async function GET(request: NextRequest) {
  const adminSupabase = getAdminClient();
  if (!adminSupabase) {
    return Response.json({ error: "Предпросмотр временно недоступен" }, { status: 503 });
  }

  const user = await getAuthenticatedUser(adminSupabase, request);
  if (!user) return Response.json({ error: "Не выполнен вход" }, { status: 401 });

  const rateLimitResponse = await enforceRateLimit(adminSupabase, request, {
    route: "link-preview",
    identity: user.id,
    limit: 30,
    windowMs: 60_000,
  });
  if (rateLimitResponse) return rateLimitResponse;

  const rawUrl = request.nextUrl.searchParams.get("url") || "";

  try {
    const targetUrl = new URL(rawUrl);
    await resolvePublicAddress(targetUrl);

    const response = await fetchPreviewResponse(targetUrl);
    const html = await readLimitedText(response);
    const title = readMeta(html, ["og:title", "twitter:title"]) || readTitle(html);
    const description = readMeta(html, [
      "og:description",
      "twitter:description",
      "description",
    ]);
    const image = resolveUrl(
      readMeta(html, ["og:image", "twitter:image"]),
      targetUrl.toString()
    );

    return Response.json({
      url: targetUrl.toString(),
      title: title || targetUrl.hostname,
      description,
      image,
      domain: targetUrl.hostname.replace(/^www\./, ""),
    });
  } catch {
    return Response.json({
      url: rawUrl,
      title: rawUrl,
      description: "",
      image: null,
      domain: rawUrl,
    });
  }
}
