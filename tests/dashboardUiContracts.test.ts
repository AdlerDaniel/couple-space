import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("dashboard always renders a two-part couple banner with initials as fallback", async () => {
  const source = await readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8");

  assert.match(source, /grid h-full w-full grid-cols-2/);
  assert.match(source, /initials\(partner\.name\)/);
  assert.match(source, /legacyAvatarUrl/);
  assert.doesNotMatch(source, /hasHeroCollage/);
});

test("dashboard no longer renders the live relationship progress line", async () => {
  const source = await readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(source, /RelationshipJourney/);
  assert.doesNotMatch(source, /Живая линия прогресса/);
});
