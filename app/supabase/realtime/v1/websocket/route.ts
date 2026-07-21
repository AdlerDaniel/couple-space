import { experimental_upgradeWebSocket } from "@vercel/functions";
import { connection } from "next/server";
import WebSocket, { type Data } from "ws";

export const dynamic = "force-dynamic";

function getUpstreamUrl(request: Request) {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!configuredUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured");

  const base = new URL(configuredUrl);
  if (base.protocol !== "https:" || !base.hostname.endsWith(".supabase.co")) {
    throw new Error("Invalid Supabase upstream URL");
  }

  const incoming = new URL(request.url);
  const upstream = new URL(base);
  upstream.protocol = "wss:";
  upstream.pathname = "/realtime/v1/websocket";
  upstream.search = incoming.search;
  return upstream;
}

export async function GET(request: Request) {
  await connection();
  const upstreamUrl = getUpstreamUrl(request);

  return experimental_upgradeWebSocket((client) => {
    const upstream = new WebSocket(upstreamUrl);
    const pending: Data[] = [];

    client.on("message", (data) => {
      if (upstream.readyState === WebSocket.OPEN) {
        upstream.send(data);
      } else if (upstream.readyState === WebSocket.CONNECTING) {
        pending.push(data);
      }
    });

    upstream.on("open", () => {
      for (const data of pending.splice(0)) upstream.send(data);
    });

    upstream.on("message", (data) => {
      if (client.readyState === WebSocket.OPEN) client.send(data);
    });

    const closeBoth = () => {
      if (client.readyState === WebSocket.OPEN) client.close();
      if (upstream.readyState === WebSocket.OPEN) upstream.close();
    };

    client.on("close", () => {
      if (upstream.readyState === WebSocket.OPEN) upstream.close();
    });
    upstream.on("close", () => {
      if (client.readyState === WebSocket.OPEN) client.close();
    });
    client.on("error", closeBoth);
    upstream.on("error", closeBoth);
  });
}
