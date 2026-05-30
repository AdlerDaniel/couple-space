import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyNetworkDiagnostics,
  normalizeSupabaseRestStatus,
} from "../lib/networkDiagnostics.ts";

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

test("network diagnostics treats Supabase REST 401 as reachable", () => {
  assert.equal(normalizeSupabaseRestStatus("failed", "HTTP 401"), "ok");
});

test("network diagnostics keeps chunk failure primary when Supabase REST only returns 401", () => {
  assert.equal(
    classifyNetworkDiagnostics({
      failedResources: ["https://example.com/_next/static/chunks/app.js"],
      originStatus: "ok",
      staticAssetsStatus: "failed",
      supabaseRestStatus: normalizeSupabaseRestStatus("failed", "HTTP 401"),
      supabaseAuthStatus: "ok",
      realtimeStatus: "ok",
    }),
    "chunk-failed",
  );
});
