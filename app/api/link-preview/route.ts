import { NextRequest } from "next/server";

export const runtime = "nodejs";

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

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url") || "";

  try {
    const targetUrl = new URL(rawUrl);
    if (!["http:", "https:"].includes(targetUrl.protocol)) {
      return Response.json({ error: "Unsupported URL" }, { status: 400 });
    }

    const response = await fetch(targetUrl.toString(), {
      headers: {
        "user-agent": "Mozilla/5.0 CoupleSpaceLinkPreview/1.0",
      },
      signal: AbortSignal.timeout(6000),
    });
    const html = await response.text();
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
