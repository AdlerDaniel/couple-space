import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { mobileMainLinks, mobileMoreLinks } from "../lib/navigation.ts";

test("mobile dock keeps the four requested sections in the requested order", () => {
  assert.deepEqual(
    mobileMainLinks.map(({ href }) => href),
    ["/memories", "/questions", "/tracker", "/watch"]
  );
});

test("remaining primary mobile sections are available under More", () => {
  assert.deepEqual(
    mobileMoreLinks.map(({ href }) => href),
    ["/today", "/dashboard", "/quizzes", "/chat", "/calendar"]
  );
});

test("mobile dock uses the matte implementation instead of liquid glass buttons", async () => {
  const source = await readFile(new URL("../components/MobileNav.tsx", import.meta.url), "utf8");
  const dock = source.slice(source.indexOf('<nav\n        aria-label="Основная мобильная навигация"'));

  assert.match(dock, /mobile-matte-dock/);
  assert.match(dock, /mobile-matte-tab/);
  assert.doesNotMatch(dock, /LiquidGlassButton/);
  assert.doesNotMatch(dock, /LiquidGlassSurface/);
});
