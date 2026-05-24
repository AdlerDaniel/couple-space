import assert from "node:assert/strict";
import test from "node:test";

import { dailyQuestions, getDailyQuestion } from "../lib/dailyQuestions.ts";

test("dailyQuestions contains 300 unique questions", () => {
  assert.equal(dailyQuestions.length, 300);
  assert.equal(new Set(dailyQuestions).size, 300);
});

test("getDailyQuestion rotates beyond the day of month", () => {
  assert.notEqual(
    getDailyQuestion(new Date("2026-01-01T12:00:00.000Z"), "Europe/Moscow"),
    getDailyQuestion(new Date("2026-02-01T12:00:00.000Z"), "Europe/Moscow"),
  );
});
