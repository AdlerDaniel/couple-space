import assert from "node:assert/strict";
import test from "node:test";

import {
  getCanonicalSupabaseRealtimeUrl,
  getSupabaseAuthStorageKey,
  getSupabaseClientUrl,
  toPortableSupabaseUrl,
} from "../lib/supabaseUrls.ts";

test("Supabase URLs use a provider-neutral same-origin path", () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example-project.supabase.co";

  assert.equal(getSupabaseClientUrl(), "https://example-project.supabase.co");
  assert.equal(getSupabaseAuthStorageKey(), "sb-example-project-auth-token");
  assert.equal(
    toPortableSupabaseUrl(
      "https://example-project.supabase.co/storage/v1/object/public/photos/image.webp",
    ),
    "/supabase/storage/v1/object/public/photos/image.webp",
  );
});

test("portable media URLs stay unchanged across Vercel and Sites", () => {
  assert.equal(
    toPortableSupabaseUrl("/supabase/storage/v1/object/public/photos/image.webp"),
    "/supabase/storage/v1/object/public/photos/image.webp",
  );
});

test("Realtime connects directly to Supabase and preserves client parameters", () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example-project.supabase.co";

  assert.equal(
    getCanonicalSupabaseRealtimeUrl(
      "wss://couple-space.example/supabase/realtime/v1/websocket?apikey=anon-key&vsn=1.0.0",
    ),
    "wss://example-project.supabase.co/realtime/v1/websocket?apikey=anon-key&vsn=1.0.0",
  );
});
