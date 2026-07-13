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

test("More opens a compact matte list without dashboard clutter", async () => {
  const source = await readFile(new URL("../components/MobileNav.tsx", import.meta.url), "utf8");

  assert.match(source, /mobile-matte-sheet/);
  assert.match(source, /max-h-\[72dvh\]/);
  assert.doesNotMatch(source, /quickState/);
  assert.doesNotMatch(source, /quickNavActions/);
  assert.doesNotMatch(source, /PushNotificationButton/);
  assert.doesNotMatch(source, />Быстро</);
});

test("navigation icons come from Lucide", async () => {
  const source = await readFile(new URL("../components/NavIcon.tsx", import.meta.url), "utf8");

  assert.match(source, /from "lucide-react"/);
  assert.doesNotMatch(source, /iconPaths/);
});
