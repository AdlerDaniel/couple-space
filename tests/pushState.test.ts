import assert from "node:assert/strict";
import test from "node:test";

import { resolvePushPermissionState } from "../lib/pushState.ts";

test("push state asks to enable when permission is granted but no subscription exists", () => {
  assert.equal(
    resolvePushPermissionState({
      isSupported: true,
      isConfigured: true,
      permission: "granted",
      hasSubscription: false,
    }),
    "default",
  );
});

test("push state is enabled only when permission and subscription both exist", () => {
  assert.equal(
    resolvePushPermissionState({
      isSupported: true,
      isConfigured: true,
      permission: "granted",
      hasSubscription: true,
    }),
    "enabled",
  );
});

test("push state keeps blocked and unsupported states", () => {
  assert.equal(
    resolvePushPermissionState({
      isSupported: true,
      isConfigured: true,
      permission: "denied",
      hasSubscription: false,
    }),
    "blocked",
  );
  assert.equal(
    resolvePushPermissionState({
      isSupported: false,
      isConfigured: true,
      permission: "default",
      hasSubscription: false,
    }),
    "unsupported",
  );
});
