import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  desktopNavLinks,
  mobileMainLinks,
  mobileMoreLinks,
} from "../lib/navigation.ts";

test("mobile dock keeps the four requested sections in the requested order", () => {
  assert.deepEqual(
    mobileMainLinks.map(({ href }) => href),
    ["/memories", "/questions", "/tracker", "/watch"]
  );
});

test("remaining primary mobile sections are available under More", () => {
  assert.deepEqual(
    mobileMoreLinks.map(({ href }) => href),
    ["/today", "/dashboard", "/quizzes", "/chat", "/countdown"]
  );
});

test("desktop sidebar exposes every section without a More menu", async () => {
  assert.deepEqual(
    desktopNavLinks.map(({ href }) => href),
    ["/today", "/questions", "/quizzes", "/watch", "/memories", "/countdown", "/dashboard", "/chat", "/tracker"],
  );
  assert.equal(desktopNavLinks.find(({ href }) => href === "/questions")?.label, "Вопрос дня");
  assert.equal(desktopNavLinks.find(({ href }) => href === "/watch")?.label, "Фильмы");

  const source = await readFile(new URL("../components/Navbar.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /isMoreOpen|setIsMoreOpen/);
  assert.doesNotMatch(source, />Ещё</);
  assert.doesNotMatch(source, /isActionsOpen|quickNavActions|>Добавить</);
});

test("desktop profile has no density setting", async () => {
  const [navbarSource, themeSource, cssSource] = await Promise.all([
    readFile(new URL("../components/Navbar.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/ThemeToggle.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(navbarSource, /isCompact|toggleCompactMode|плотность/i);
  assert.doesNotMatch(cssSource, /app-compact/);
  assert.match(themeSource, /localStorage\.removeItem\("couple-space:density"\)/);
});

test("Today focus colors the mobile More tab", async () => {
  const cssSource = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(cssSource, /body:has\(\.today-page-question\) \.mobile-matte-dock/);
  assert.match(cssSource, /body:has\(\.today-page-memories\) \.mobile-matte-dock/);
  assert.match(cssSource, /body:has\(\.today-page-movies\) \.mobile-matte-dock/);
  assert.match(cssSource, /--mobile-nav-accent: #3f6212/);
  assert.match(cssSource, /body:has\(\.today-page-question\) \.desktop-matte-rail/);
  assert.match(cssSource, /body:has\(\.today-page-memories\) \.desktop-matte-rail/);
  assert.match(cssSource, /body:has\(\.today-page-movies\) \.desktop-matte-rail/);
});

test("desktop profile menu links to settings", async () => {
  const source = await readFile(new URL("../components/Navbar.tsx", import.meta.url), "utf8");

  assert.match(source, /href="\/settings"/);
  assert.match(source, />\s*Настройки\s*</);
});

test("desktop page background continues beneath the floating sidebar", async () => {
  const [layoutSource, cssSource] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(layoutSource, /PageBackgroundSync/);
  assert.match(cssSource, /\.app-desktop-content \{[\s\S]*?width: 100%;[\s\S]*?margin-left: 0;/);
  assert.match(cssSource, /\.app-desktop-content > main \{[\s\S]*?padding-left: 6\.25rem !important;/);
});

test("mobile dock uses the matte implementation instead of liquid glass buttons", async () => {
  const source = await readFile(new URL("../components/MobileNav.tsx", import.meta.url), "utf8");
  const dock = source.slice(source.indexOf('aria-label="Основная мобильная навигация"'));

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

test("desktop navigation uses a fixed matte sidebar", async () => {
  const source = await readFile(new URL("../components/Navbar.tsx", import.meta.url), "utf8");

  assert.match(source, /desktop-sidebar/);
  assert.match(source, /desktop-matte-rail/);
  assert.doesNotMatch(source, /LiquidGlassButton/);
  assert.doesNotMatch(source, /LiquidGlassSurface/);
});

test("calendar is absent from application navigation", async () => {
  const source = await readFile(new URL("../lib/navigation.ts", import.meta.url), "utf8");

  assert.doesNotMatch(source, /\/calendar/);
  assert.doesNotMatch(source, /Календарь/);
});
