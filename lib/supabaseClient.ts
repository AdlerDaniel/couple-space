import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabaseAuthStorageKey,
  getSupabaseClientUrl,
  shouldUseVercelRealtimeProxy,
  vercelRealtimeProxyUrl,
} from "./supabaseUrls.ts";

const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let client: SupabaseClient | null = null;

function getRealtimeOptions() {
  if (!shouldUseVercelRealtimeProxy() || typeof WebSocket === "undefined") {
    return undefined;
  }

  class SitesRealtimeWebSocket extends WebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      const upstreamUrl = new URL(vercelRealtimeProxyUrl);
      upstreamUrl.search = new URL(url).search;
      super(upstreamUrl, protocols);
    }
  }

  return { transport: SitesRealtimeWebSocket };
}

export function getSupabaseClient() {
  if (!client) {
    client = createClient(getSupabaseClientUrl(), supabaseAnonKey, {
      auth: {
        storageKey: getSupabaseAuthStorageKey(),
      },
      realtime: getRealtimeOptions(),
    });
  }

  return client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const activeClient = getSupabaseClient();
    const value = Reflect.get(activeClient, property, activeClient);
    return typeof value === "function" ? value.bind(activeClient) : value;
  },
});
