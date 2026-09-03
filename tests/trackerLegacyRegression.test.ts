import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/tracker/page.tsx", import.meta.url), "utf8");

test("legacy day navigation advances one day and selected years reload", () => {
  assert.match(source, /if \(period === "day"\) \{\s*date\.setDate\(date\.getDate\(\) \+ direction\)/);
  assert.match(source, /getDateRange\(new Date\(viewYear, 0, 1\), "year"\)/);
  assert.match(source, /void reloadEvents\(\);[\s\S]*?\[reloadEvents\]/);
  assert.match(source, /requestVersion === eventLoadVersion\.current/);
});

test("legacy mood updates preserve notes and display both partners", () => {
  assert.match(source, /const cleanNote = getVisibleEventNote\(targetEvent\)/);
  assert.match(source, /note: getDayMoodNote\(cleanNote\)/);
  assert.match(source, /const partnerMood = getDayMood\(partnerEvents\)/);
  assert.match(source, /aria-label="Эмодзи дня партнёра"/);
  assert.match(source, /const categoryCount = countOnly\(myEvents, category\.id\)/);
  assert.match(source, /value=\{categoryCount\}/);
});
