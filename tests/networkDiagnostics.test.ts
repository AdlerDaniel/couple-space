import assert from "node:assert/strict";
import test from "node:test";

import { classifyNetworkDiagnostics } from "../lib/networkDiagnostics.ts";

test("network diagnostics classifies a healthy connection", () => {
  assert.equal(
    classifyNetworkDiagnostics({
      failedResources: [],
      originStatus: "ok",
      staticAssetsStatus: "ok",
      supabaseRestStatus: "ok",
      supabaseAuthStatus: "ok",
      realtimeStatus: "ok",
    }),
    "ok",
  );
});

test("network diagnostics classifies blocked Supabase REST/Auth", () => {
  assert.equal(
    classifyNetworkDiagnostics({
      failedResources: [],
      originStatus: "ok",
      staticAssetsStatus: "ok",
      supabaseRestStatus: "failed",
      supabaseAuthStatus: "failed",
      realtimeStatus: "skipped",
    }),
    "supabase-blocked",
  );
});

test("network diagnostics classifies blocked Supabase Realtime separately", () => {
  assert.equal(
    classifyNetworkDiagnostics({
      failedResources: [],
      originStatus: "ok",
      staticAssetsStatus: "ok",
      supabaseRestStatus: "ok",
      supabaseAuthStatus: "ok",
      realtimeStatus: "failed",
    }),
    "realtime-blocked",
  );
});

test("network diagnostics classifies failed Next.js chunks", () => {
  assert.equal(
    classifyNetworkDiagnostics({
      failedResources: ["https://example.com/_next/static/chunks/app.js"],
      originStatus: "ok",
      staticAssetsStatus: "failed",
      supabaseRestStatus: "ok",
      supabaseAuthStatus: "ok",
      realtimeStatus: "ok",
    }),
    "chunk-failed",
  );
});
