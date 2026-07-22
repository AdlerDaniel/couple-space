import assert from "node:assert/strict";
import test from "node:test";

import {
  getSupabaseAuthStorageKey,
  getSupabaseClientUrl,
  shouldUseVercelRealtimeProxy,
  toPortableSupabaseUrl,
  vercelRealtimeProxyUrl,
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

test("Sites uses the public Vercel WebSocket gateway for live updates", () => {
  process.env.DEPLOY_TARGET = "sites";

  assert.equal(shouldUseVercelRealtimeProxy(), true);
  assert.equal(
    vercelRealtimeProxyUrl,
    "wss://couple-space-kappa.vercel.app/supabase/realtime/v1/websocket",
  );

  delete process.env.DEPLOY_TARGET;
});
