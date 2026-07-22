import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabaseAuthStorageKey,
  getSupabaseClientUrl,
  shouldUseVercelRealtimeProxy,
  vercelRealtimeProxyUrl,
} from "./supabaseUrls.ts";

const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const rememberPreferenceKey = "couple-space:remember-me";

let client: SupabaseClient | null = null;

function getBrowserAuthStorage() {
  return {
    getItem(key: string) {
      if (typeof window === "undefined") return null;
      return window.sessionStorage.getItem(key) ?? window.localStorage.getItem(key);
    },
    setItem(key: string, value: string) {
      if (typeof window === "undefined") return;
      const remember = window.localStorage.getItem(rememberPreferenceKey) !== "false";
      const activeStorage = remember ? window.localStorage : window.sessionStorage;
      const inactiveStorage = remember ? window.sessionStorage : window.localStorage;
      activeStorage.setItem(key, value);
      inactiveStorage.removeItem(key);
    },
    removeItem(key: string) {
      if (typeof window === "undefined") return;
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    },
  };
}

export function setAuthPersistencePreference(remember: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(rememberPreferenceKey, remember ? "true" : "false");
}

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
        storage: getBrowserAuthStorage(),
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
