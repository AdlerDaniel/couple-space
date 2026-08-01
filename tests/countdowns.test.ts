import assert from "node:assert/strict";
import test from "node:test";

import { getCountdownTimeParts, sortCountdowns } from "../lib/countdowns.ts";

test("getCountdownTimeParts splits the remaining interval", () => {
  const now = Date.parse("2026-08-01T10:00:00.000Z");
  const target = "2026-08-03T12:03:04.000Z";

  assert.deepEqual(getCountdownTimeParts(target, now), {
    days: 2,
    hours: 2,
    minutes: 3,
    seconds: 4,
    isCompleted: false,
  });
});

test("getCountdownTimeParts stops at zero for completed events", () => {
  const now = Date.parse("2026-08-01T10:00:00.000Z");

  assert.deepEqual(getCountdownTimeParts("2026-07-31T10:00:00.000Z", now), {
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isCompleted: true,
  });
});

test("sortCountdowns puts the nearest future event first and recent history last", () => {
  const now = Date.parse("2026-08-01T10:00:00.000Z");
  const sorted = sortCountdowns(
    [
      { id: "past-old", target_at: "2026-07-01T10:00:00.000Z" },
      { id: "future-far", target_at: "2026-09-01T10:00:00.000Z" },
      { id: "past-recent", target_at: "2026-07-31T10:00:00.000Z" },
      { id: "future-near", target_at: "2026-08-02T10:00:00.000Z" },
    ],
    now,
  );

  assert.deepEqual(sorted.map((item) => item.id), [
    "future-near",
    "future-far",
    "past-recent",
    "past-old",
  ]);
});
