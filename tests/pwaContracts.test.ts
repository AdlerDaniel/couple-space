import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const manifestSource = await readFile("app/manifest.ts", "utf8");
const assetLinks = JSON.parse(
  await readFile("public/.well-known/assetlinks.json", "utf8"),
) as Array<{
  relation: string[];
  target: {
    namespace: string;
    package_name: string;
    sha256_cert_fingerprints: string[];
  };
}>;
const pushWorkerSource = await readFile("public/push-worker.js", "utf8");

test("Couple Space exposes an installable standalone web app", () => {
  assert.match(manifestSource, /display:\s*"standalone"/);
  assert.match(manifestSource, /couple-space-192\.png/);
  assert.match(manifestSource, /couple-space-512\.png/);
  assert.match(manifestSource, /couple-space-maskable-512\.png/);
});

test("Android package and website are linked for fullscreen TWA mode", () => {
  assert.equal(assetLinks.length, 1);
  assert.deepEqual(assetLinks[0].relation, ["delegate_permission/common.handle_all_urls"]);
  assert.equal(assetLinks[0].target.namespace, "android_app");
  assert.equal(assetLinks[0].target.package_name, "app.couplespace.mobile");
  assert.match(assetLinks[0].target.sha256_cert_fingerprints[0], /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/);
});

test("push notifications use the real Couple Space application icon", () => {
  assert.doesNotMatch(pushWorkerSource, /window\.svg/);
  assert.match(pushWorkerSource, /couple-space-192\.png/);
});
