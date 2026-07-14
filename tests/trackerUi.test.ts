import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("tracker follows the calendar and selected-day reference hierarchy", async () => {
  const source = await readFile(new URL("../app/tracker/page.tsx", import.meta.url), "utf8");

  assert.match(source, /<TrackerHeader/);
  assert.match(source, /<DateNavigator/);
  assert.match(source, /<PeriodTabs/);
  assert.match(source, /className="tracker-content-grid"/);
  assert.match(source, /className="tracker-view"/);
  assert.match(source, /className="tracker-day space-y-3"/);
  assert.match(source, /<DayEventEditor/);
  assert.match(source, /Сохранить изменения/);
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
