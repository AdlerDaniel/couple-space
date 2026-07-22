import assert from "node:assert/strict";
import test from "node:test";

import {
  createVirtualQuestionArchiveId,
  getQuestionDateKey,
  parseQuestionDate,
  parseVirtualQuestionArchiveId,
} from "../lib/questionArchive.ts";

test("archive date parser supports stored and virtual date formats", () => {
  assert.equal(getQuestionDateKey(parseQuestionDate("22.07.2026")), "2026-07-22");
  assert.equal(getQuestionDateKey(parseQuestionDate("2026-07-22")), "2026-07-22");
});

test("virtual archive ids only accept valid calendar dates", () => {
  const id = createVirtualQuestionArchiveId("2026-07-22");

  assert.equal(id, "day-2026-07-22");
  assert.equal(parseVirtualQuestionArchiveId(id), "2026-07-22");
  assert.equal(parseVirtualQuestionArchiveId("day-2026-02-31"), null);
  assert.equal(parseVirtualQuestionArchiveId("javascript:alert(1)"), null);
});
