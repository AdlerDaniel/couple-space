import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabaseAuthStorageKey,
  getSupabaseClientUrl,
} from "./supabaseUrls.ts";

const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let client: SupabaseClient | null = null;

export function getSupabaseClient() {
  if (!client) {
    client = createClient(getSupabaseClientUrl(), supabaseAnonKey, {
      auth: {
        storageKey: getSupabaseAuthStorageKey(),
      },
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
