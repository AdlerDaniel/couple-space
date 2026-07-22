import assert from "node:assert/strict";
import test from "node:test";

import {
  dailyQuestions,
  getDailyQuestion,
  getDailyQuestionHistory,
} from "../lib/dailyQuestions.ts";
import { isRecoverableRouteError } from "../lib/routeRecovery.ts";

test("dailyQuestions contains 300 unique questions", () => {
  assert.equal(dailyQuestions.length, 300);
  assert.equal(new Set(dailyQuestions).size, 300);
});

test("dailyQuestions uses the supplied Couple Space question set", () => {
  assert.equal(dailyQuestions[0], "Что ты хочешь построить вместе с партнёром?");
  assert.equal(dailyQuestions[299], "В какой ситуации ты чувствуешь себя максимально уверенно?");
});

test("getDailyQuestion rotates beyond the day of month", () => {
  assert.notEqual(
    getDailyQuestion(new Date("2026-01-01T12:00:00.000Z"), "Europe/Moscow"),
    getDailyQuestion(new Date("2026-02-01T12:00:00.000Z"), "Europe/Moscow"),
  );
});

test("getDailyQuestionHistory includes every couple day in its time zone", () => {
  const history = getDailyQuestionHistory(
    new Date("2026-07-20T21:30:00.000Z"),
    new Date("2026-07-22T12:00:00.000Z"),
    "Europe/Moscow",
  );

  assert.deepEqual(
    history.map((entry) => entry.dateKey),
    ["2026-07-21", "2026-07-22"],
  );
  assert.deepEqual(
    history.map((entry) => entry.date),
    ["21.07.2026", "22.07.2026"],
  );
  assert.equal(
    history[1].question,
    getDailyQuestion(new Date("2026-07-22T12:00:00.000Z"), "Europe/Moscow"),
  );
});

test("route recovery treats stack overflow during stale client runtime as recoverable", () => {
  assert.equal(isRecoverableRouteError(new RangeError("Maximum call stack size exceeded")), true);
});
