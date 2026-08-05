import assert from "node:assert/strict";
import test from "node:test";

import { getQuestionAnswerEditWindowStart } from "../lib/questionAnswerEdit.ts";

test("partner answer creation time does not lock an unanswered user", () => {
  assert.equal(
    getQuestionAnswerEditWindowStart({
      editedAt: null,
      recordCreatedAt: "2026-08-05T10:00:00.000Z",
      hasOwnAnswer: false,
    }),
    null,
  );
});

test("legacy own answers still use the record creation time", () => {
  assert.equal(
    getQuestionAnswerEditWindowStart({
      editedAt: null,
      recordCreatedAt: "2026-08-05T10:00:00.000Z",
      hasOwnAnswer: true,
    }),
    "2026-08-05T10:00:00.000Z",
  );
});

test("per-user edit timestamp has priority", () => {
  assert.equal(
    getQuestionAnswerEditWindowStart({
      editedAt: "2026-08-05T10:05:00.000Z",
      recordCreatedAt: "2026-08-05T10:00:00.000Z",
      hasOwnAnswer: true,
    }),
    "2026-08-05T10:05:00.000Z",
  );
});
