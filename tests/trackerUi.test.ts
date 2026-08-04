import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("tracker follows the calendar and selected-day reference hierarchy", async () => {
  const [page, navigation] = await Promise.all([
    readFile(new URL("../app/tracker/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/tracker/TrackerNavigation.tsx", import.meta.url), "utf8"),
  ]);
  const source = `${page}\n${navigation}`;

  assert.match(source, /<TrackerHeader/);
  assert.match(source, /<TrackerNavigation/);
  assert.match(source, /aria-label="Предыдущий период"/);
  assert.match(source, /role="tablist"/);
  assert.match(source, /className="tracker-content-grid"/);
  assert.match(source, /className="tracker-view"/);
  assert.match(source, /className="tracker-day space-y-3"/);
  assert.match(source, /<MoodSelector/);
  assert.match(source, /Эмодзи дня/);
  assert.doesNotMatch(source, /Настроение для/);
});

test("tracker uses a single persisted day mood and Lucide category icons", async () => {
  const [source, categories] = await Promise.all([
    readFile(new URL("../app/tracker/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/trackerCategories.ts", import.meta.url), "utf8"),
  ]);

  assert.match(source, /DAY_MOOD_MARKER/);
  assert.match(source, /tracker-calendar-mood-empty/);
  assert.match(source, /function CategoryIcon/);
  assert.match(source, /Utensils/);
  assert.match(source, /Gamepad2/);
  assert.match(categories, /food.*#9a6334/);
  assert.match(categories, /sex.*#e5484d/);
  assert.match(categories, /sport.*#2f9e44/);
  assert.match(categories, /games.*#3478d4/);
  assert.match(categories, /drawings.*#db5b9a/);
});

test("tracker goals and history use compact progressive disclosure", async () => {
  const source = await readFile(new URL("../app/tracker/page.tsx", import.meta.url), "utf8");

  assert.match(source, /isFormOpen/);
  assert.match(source, /pair-goal-form/);
  assert.match(source, /tracker-history-row/);
  assert.doesNotMatch(source, /Целей пока нет/);
});

test("tracker mobile layout keeps the calendar before the day editor and charts", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(css, /grid-template-areas:\s*"summary"\s*"view"\s*"day"\s*"charts"/);
  assert.match(css, /@media \(min-width: 1024px\)[\s\S]*"summary day"\s*"view day"\s*"charts day"/);
});

test("tracker calendar uses compact category markers", async () => {
  const source = await readFile(new URL("../app/tracker/page.tsx", import.meta.url), "utf8");

  assert.match(source, /activeCategories\.slice\(0, 4\)/);
  assert.doesNotMatch(source, /group min-h-24 rounded-2xl/);
});

test("tracker year view names the current year and opens a selected day", async () => {
  const source = await readFile(new URL("../app/tracker/page.tsx", import.meta.url), "utf8");

  assert.match(source, />\{year\} год</);
  assert.match(source, /onClick=\{\(\) => onSelectDate\(day\.dateKey\)\}/);
  assert.match(source, /setPeriod\("day"\)/);
});
