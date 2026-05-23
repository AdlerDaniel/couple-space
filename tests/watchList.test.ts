import assert from "node:assert/strict";
import test from "node:test";

import {
  findDuplicateWatchTitle,
  getRandomWatchItem,
  normalizeWatchTitle,
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
