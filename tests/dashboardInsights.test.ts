import assert from "node:assert/strict";
import test from "node:test";

import {
  getNearestAchievements,
  getWeeklyActivityCount,
} from "../lib/dashboardInsights.ts";

test("getWeeklyActivityCount counts activity from the last 7 days", () => {
  const now = new Date("2026-05-24T12:00:00.000Z");

  assert.equal(
    getWeeklyActivityCount(
      [
        { createdAt: "2026-05-24T08:00:00.000Z" },
        { createdAt: "2026-05-20T08:00:00.000Z" },
        { createdAt: "2026-05-16T08:00:00.000Z" },
        { createdAt: "not-a-date" },
      ],
      now,
    ),
    2,
  );
});

test("getNearestAchievements returns locked achievements closest to completion", () => {
  const nearest = getNearestAchievements(
    [
      { id: "done", value: 10, target: 10, unlocked: true },
      { id: "far", value: 1, target: 10, unlocked: false },
      { id: "close", value: 8, target: 10, unlocked: false },
      { id: "middle", value: 4, target: 10, unlocked: false },
    ],
    2,
  );

  assert.deepEqual(
    nearest.map((item) => item.id),
    ["close", "middle"],
  );
});
