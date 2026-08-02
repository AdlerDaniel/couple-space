import assert from "node:assert/strict";
import test from "node:test";

import {
  findDuplicateWatchTitle,
  getRandomWatchItem,
  normalizeOptionalUrl,
  normalizeWatchTitle,
  shouldOpenAddWatch,
  shouldAutoSpinWatch,
} from "../lib/watchList.ts";

test("normalizeWatchTitle trims and collapses spaces", () => {
  assert.equal(normalizeWatchTitle("  Властелин   колец  "), "властелин колец");
});

test("findDuplicateWatchTitle matches titles case-insensitively", () => {
  const duplicate = findDuplicateWatchTitle(
    [
      { id: "1", title: "Интерстеллар", is_watched: false },
      { id: "2", title: "Атака титанов", is_watched: true },
    ],
    "  интерстеллар ",
  );

  assert.equal(duplicate?.id, "1");
});

test("getRandomWatchItem uses only unwatched items", () => {
  const selected = getRandomWatchItem(
    [
      { id: "1", title: "Просмотрено", is_watched: true },
      { id: "2", title: "Ждёт", is_watched: false },
    ],
    () => 0,
  );

  assert.equal(selected?.id, "2");
});

test("normalizeOptionalUrl adds https for plain domains", () => {
  assert.equal(normalizeOptionalUrl(" kinopoisk.ru/film/123 "), "https://kinopoisk.ru/film/123");
});

test("normalizeOptionalUrl keeps empty values empty", () => {
  assert.equal(normalizeOptionalUrl("   "), "");
});

test("shouldAutoSpinWatch accepts spin=1", () => {
  assert.equal(shouldAutoSpinWatch(new URLSearchParams("spin=1")), true);
});

test("shouldAutoSpinWatch rejects missing spin flag", () => {
  assert.equal(shouldAutoSpinWatch(new URLSearchParams("")), false);
});

test("shouldOpenAddWatch accepts add=1", () => {
  assert.equal(shouldOpenAddWatch(new URLSearchParams("add=1")), true);
  assert.equal(shouldOpenAddWatch(new URLSearchParams("")), false);
});
