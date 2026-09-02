import assert from "node:assert/strict";
import test from "node:test";

import {
  applyTrackerOccurrenceOverrides,
  buildTrackerPlanIcs,
  expandTrackerPlanOccurrences,
  findFreeSlots,
  getTrackerViewRange,
  getWeekStrip,
  type TrackerPlan,
} from "../lib/trackerPlanDomain.ts";

function plan(overrides: Partial<TrackerPlan> = {}): TrackerPlan {
  return {
    id: "plan-1",
    couple_id: "couple-1",
    title: "Вечер вместе",
    description: "Чай, фильм; без телефонов",
    kind: "date",
    start_date: "2026-09-07",
    starts_at: "2026-09-07T16:00:00.000Z",
    ends_at: "2026-09-07T18:00:00.000Z",
    all_day: false,
    participant_scope: "both",
    assignee_id: null,
    visibility: "couple",
    status: "planned",
    repeat_mode: "none",
    repeat_interval: 1,
    repeat_weekdays: [],
    repeat_until: null,
    category_id: null,
    color: "#d97706",
    edit_scope: "participants",
    created_by: "user-1",
    updated_by: null,
    created_at: "2026-09-01T10:00:00.000Z",
    updated_at: "2026-09-01T10:00:00.000Z",
    ...overrides,
  };
}

test("week strip and week range start on Monday", () => {
  assert.deepEqual(
    getWeekStrip("2026-09-09").map((item) => item.dateKey),
    [
      "2026-09-07",
      "2026-09-08",
      "2026-09-09",
      "2026-09-10",
      "2026-09-11",
      "2026-09-12",
      "2026-09-13",
    ],
  );
  assert.deepEqual(getTrackerViewRange("2026-09-09", "week"), {
    from: "2026-09-07",
    to: "2026-09-13",
  });
});

test("daily and weekly repetitions expand only inside the selected range", () => {
  const daily = plan({
    id: "daily",
    repeat_mode: "daily",
    repeat_until: "2026-09-09",
  });
  const weekly = plan({
    id: "weekly",
    start_date: "2026-09-07",
    starts_at: null,
    ends_at: null,
    all_day: true,
    repeat_mode: "weekly",
    repeat_weekdays: [1, 3],
    repeat_until: "2026-09-16",
  });

  const occurrences = expandTrackerPlanOccurrences(
    [daily, weekly],
    "2026-09-07",
    "2026-09-16",
  );

  assert.deepEqual(
    occurrences.filter((item) => item.plan.id === "daily").map((item) => item.dateKey),
    ["2026-09-07", "2026-09-08", "2026-09-09"],
  );
  assert.deepEqual(
    occurrences.filter((item) => item.plan.id === "weekly").map((item) => item.dateKey),
    ["2026-09-07", "2026-09-09", "2026-09-14", "2026-09-16"],
  );
});

test("free-time search excludes overlapping windows and respects all-day privacy blocks", () => {
  const busyStart = new Date(2026, 8, 7, 10, 0);
  const busyEnd = new Date(2026, 8, 7, 11, 30);
  const slots = findFreeSlots(
    "2026-09-07",
    [{ startsAt: busyStart, endsAt: busyEnd }],
    { startHour: 9, endHour: 13, durationMinutes: 60, stepMinutes: 30 },
  );

  assert.deepEqual(
    slots.map((slot) => [slot.start.getHours(), slot.start.getMinutes()]),
    [[9, 0], [11, 30], [12, 0]],
  );
  assert.deepEqual(
    findFreeSlots("2026-09-07", [{ startsAt: busyStart, endsAt: busyEnd, allDay: true }]),
    [],
  );
});

test("ICS export includes recurrence, alarm and escaped user text", () => {
  const ics = buildTrackerPlanIcs(
    plan({
      repeat_mode: "weekly",
      repeat_weekdays: [1, 5],
      repeat_until: "2026-10-02",
    }),
    30,
  );

  assert.match(ics, /SUMMARY:Вечер вместе/);
  assert.match(ics, /DESCRIPTION:Чай\\, фильм\\; без телефонов/);
  assert.match(ics, /RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,FR;UNTIL=20261002T235959Z/);
  assert.match(ics, /TRIGGER:-PT30M/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
});


test("single occurrence override moves or cancels only the selected repetition", () => {
  const recurring = plan({
    repeat_mode: "daily",
    repeat_until: "2026-09-09",
  });
  const expanded = expandTrackerPlanOccurrences([recurring], "2026-09-07", "2026-09-09");
  const moved = applyTrackerOccurrenceOverrides(expanded, [{
    id: "override-1",
    plan_id: recurring.id,
    couple_id: recurring.couple_id,
    occurrence_date: "2026-09-08",
    override_start_date: "2026-09-10",
    override_starts_at: "2026-09-10T17:00:00.000Z",
    override_ends_at: "2026-09-10T19:00:00.000Z",
    status: "planned",
    updated_by: "user-1",
    updated_at: "2026-09-02T10:00:00.000Z",
  }, {
    id: "override-2",
    plan_id: recurring.id,
    couple_id: recurring.couple_id,
    occurrence_date: "2026-09-09",
    override_start_date: null,
    override_starts_at: null,
    override_ends_at: null,
    status: "cancelled",
    updated_by: "user-1",
    updated_at: "2026-09-02T10:00:00.000Z",
  }]);

  assert.deepEqual(moved.map((item) => item.dateKey), ["2026-09-07", "2026-09-10"]);
  assert.equal(moved[1]?.startsAt, "2026-09-10T17:00:00.000Z");
});
