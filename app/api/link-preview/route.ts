import { NextRequest } from "next/server";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const runtime = "nodejs";

const maxPreviewBytes = 512 * 1024;
const maxUrlLength = 2048;

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
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .trim();
}

function resolveUrl(value: string, baseUrl: string) {
  if (!value) return null;

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function isPrivateIPv4(address: string) {
  const parts = address.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;
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
  const version = isIP(address);
  if (version === 4) return isPrivateIPv4(address);
  if (version === 6) return isPrivateIPv6(address);
  return true;
}

async function assertPublicHttpUrl(targetUrl: URL) {
  if (!["http:", "https:"].includes(targetUrl.protocol)) {
    return "Unsupported URL";
  }

  if (targetUrl.username || targetUrl.password || targetUrl.href.length > maxUrlLength) {
    return "Unsupported URL";
  }

  const addresses = await lookup(targetUrl.hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some((item) => isBlockedAddress(item.address))) {
    return "Unsupported URL";
  }

  return null;
}

async function readLimitedText(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("text/html")) {
    throw new Error("Unsupported content type");
  }

  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > maxPreviewBytes) {
    throw new Error("Response too large");
  }

  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (received <= maxPreviewBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxPreviewBytes) {
      await reader.cancel();
      throw new Error("Response too large");
    }
    chunks.push(value);
  }

  return new TextDecoder().decode(Buffer.concat(chunks));
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url") || "";

  try {
    const targetUrl = new URL(rawUrl);
    const validationError = await assertPublicHttpUrl(targetUrl);
    if (validationError) return Response.json({ error: validationError }, { status: 400 });

    const response = await fetch(targetUrl.toString(), {
      redirect: "error",
      headers: {
        "user-agent": "Mozilla/5.0 CoupleSpaceLinkPreview/1.0",
      },
      signal: AbortSignal.timeout(6000),
    });
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
