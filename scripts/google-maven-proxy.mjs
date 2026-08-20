import http from "node:http";
import { Readable } from "node:stream";

const port = Number.parseInt(process.env.GOOGLE_MAVEN_PROXY_PORT ?? "8765", 10);
const upstreamOrigin = "https://dl.google.com";

const server = http.createServer(async (request, response) => {
  try {
    const upstreamUrl = new URL(request.url ?? "/", upstreamOrigin);
    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers: request.headers.range ? { range: request.headers.range } : undefined,
      redirect: "follow",
    });

    response.statusCode = upstreamResponse.status;
    for (const header of [
      "accept-ranges",
      "content-type",
      "etag",
      "last-modified",
    ]) {
      const value = upstreamResponse.headers.get(header);
      if (value) response.setHeader(header, value);
    }

    if (!upstreamResponse.body || request.method === "HEAD") {
      response.end();
      return;
    }

    Readable.fromWeb(upstreamResponse.body).pipe(response);
  } catch (error) {
    response.statusCode = 502;
    response.end(error instanceof Error ? error.message : "Proxy request failed");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Google Maven proxy listening on http://127.0.0.1:${port}`);
});
