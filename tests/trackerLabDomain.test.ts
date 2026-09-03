import assert from "node:assert/strict";
import test from "node:test";

import {
  applyTrackerOccurrenceOverrides,
  buildTrackerPlanIcs,
  expandTrackerPlanOccurrences,
  findFreeSlots,
  getTrackerViewRange,
  shiftTrackerViewDate,
  getTrackerToday,
  trackerDateTimeToIso,
  formatTrackerClock,
  getPlanBaseDate,
  type TrackerOccurrenceOverride,
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
  assert.match(ics.replace(/\r\n /g, ""), /RRULE:FREQ=WEEKLY;INTERVAL=1;WKST=MO;BYDAY=MO,FR;UNTIL=20261002T205959Z/);
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


function override(values: Partial<TrackerOccurrenceOverride> = {}): TrackerOccurrenceOverride {
  return { id: "override", plan_id: "plan-1", couple_id: "couple-1", occurrence_date: "2026-09-08",
    override_start_date: null, override_starts_at: null, override_ends_at: null, status: "planned",
    updated_by: "user-1", updated_at: "2026-09-02T10:00:00Z", ...values };
}

test("pair timezone determines date and converts input independently of browser timezone", () => {
  assert.equal(getTrackerToday("Asia/Tokyo", new Date("2026-09-02T23:30:00Z")), "2026-09-03");
  assert.equal(trackerDateTimeToIso("2026-09-03", "09:30", "Asia/Tokyo"), "2026-09-03T00:30:00.000Z");
  assert.equal(formatTrackerClock("2026-09-03T00:30:00Z", "Asia/Tokyo"), "09:30");
  assert.equal(getPlanBaseDate(plan({ starts_at: "2026-09-02T23:30:00Z" }), "Asia/Tokyo"), "2026-09-03");
});

test("DST conversion rejects nonexistent input and chooses first ambiguous instant", () => {
  assert.throws(() => trackerDateTimeToIso("2026-03-08", "02:30", "America/New_York"), RangeError);
  assert.equal(trackerDateTimeToIso("2026-11-01", "01:30", "America/New_York"), "2026-11-01T05:30:00.000Z");
});

test("timed daily recurrence retains local clock across DST", () => {
  const rows = expandTrackerPlanOccurrences([plan({ starts_at: "2026-03-07T14:00:00Z", ends_at: "2026-03-07T15:00:00Z", repeat_mode: "daily", repeat_until: null })], "2026-03-07", "2026-03-09", "America/New_York");
  assert.deepEqual(rows.map((row) => row.startsAt), ["2026-03-07T14:00:00.000Z", "2026-03-08T13:00:00.000Z", "2026-03-09T13:00:00.000Z"]);
  assert.ok(rows.every((row) => formatTrackerClock(row.startsAt!, "America/New_York") === "09:00"));
});

test("weekly interval is anchored to Monday, not seven days after DTSTART", () => {
  const rows = expandTrackerPlanOccurrences([plan({ all_day: true, start_date: "2026-09-09", starts_at: null, ends_at: null, repeat_mode: "weekly", repeat_interval: 2, repeat_weekdays: [1, 3] })], "2026-09-09", "2026-09-30");
  assert.deepEqual(rows.map((row) => row.dateKey), ["2026-09-09", "2026-09-21", "2026-09-23"]);
});

test("monthly and leap-year repetitions skip nonexistent calendar dates", () => {
  const monthly = plan({ all_day: true, start_date: "2026-01-31", starts_at: null, ends_at: null, repeat_mode: "monthly" });
  assert.deepEqual(expandTrackerPlanOccurrences([monthly], "2026-01-01", "2026-04-30").map((row) => row.dateKey), ["2026-01-31", "2026-03-31"]);
  const yearly = plan({ all_day: true, start_date: "2024-02-29", starts_at: null, ends_at: null, repeat_mode: "yearly" });
  assert.deepEqual(expandTrackerPlanOccurrences([yearly], "2024-01-01", "2028-12-31").map((row) => row.dateKey), ["2024-02-29", "2028-02-29"]);
});

test("moved occurrence preserves original identity, is re-editable, and carries done status", () => {
  const recurring = plan({ repeat_mode: "daily" });
  const edits = [override({ override_start_date: "2026-09-20", status: "done" })];
  const rows = expandTrackerPlanOccurrences([recurring], "2026-09-20", "2026-09-20", "Europe/Moscow", edits);
  const moved = rows.find((row) => row.originalDateKey === "2026-09-08");
  assert.ok(moved);
  assert.equal(moved.dateKey, "2026-09-20");
  assert.equal(moved.status, "done");
  const again = applyTrackerOccurrenceOverrides([moved], [override({ override_start_date: "2026-09-21" })]);
  assert.equal(again[0]?.dateKey, "2026-09-21");
  assert.equal(again[0]?.originalDateKey, "2026-09-08");
});

test("all-day ICS has DATE UNTIL and UTF-8 lines never exceed 75 octets", () => {
  const ics = buildTrackerPlanIcs(plan({ all_day: true, starts_at: null, ends_at: null, repeat_mode: "daily", repeat_until: "2026-09-30", title: "Наш прекрасный совместный вечер ".repeat(15) }));
  const unfolded = ics.replace(/\r\n /g, "");
  assert.match(unfolded, /UNTIL=20260930(?:\r\n|;)/);
  assert.doesNotMatch(unfolded, /UNTIL=20260930T/);
  for (const line of ics.split("\r\n")) assert.ok(Buffer.byteLength(line, "utf8") <= 75);
  assert.match(unfolded, /SUMMARY:Наш прекрасный совместный вечер /);
});

test("ICS identifies moved and cancelled instances by their original DTSTART", () => {
  const ics = buildTrackerPlanIcs(plan({ repeat_mode: "daily" }), 30, "Europe/Moscow", [
    override({ override_start_date: "2026-09-10", override_starts_at: "2026-09-10T17:00:00Z", override_ends_at: "2026-09-10T19:00:00Z" }),
    override({ id: "cancel", occurrence_date: "2026-09-09", status: "cancelled" }),
  ]).replace(/\r\n /g, "");
  assert.match(ics, /RECURRENCE-ID;TZID=Europe\/Moscow:20260908T190000/);
  assert.match(ics, /DTSTART;TZID=Europe\/Moscow:20260910T200000/);
  assert.match(ics, /RECURRENCE-ID;TZID=Europe\/Moscow:20260909T190000/);
  assert.match(ics, /STATUS:CANCELLED/);
});


test("month navigation clamps January 31 instead of overflowing into March", () => {
  assert.equal(shiftTrackerViewDate("2026-01-31", "month", 1), "2026-02-28");
  assert.equal(shiftTrackerViewDate("2024-01-31", "month", 1), "2024-02-29");
  assert.equal(shiftTrackerViewDate("2026-03-31", "month", -1), "2026-02-28");
});

test("year navigation clamps leap day and preserves day/week boundaries", () => {
  assert.equal(shiftTrackerViewDate("2024-02-29", "year", 1), "2025-02-28");
  assert.equal(shiftTrackerViewDate("2024-02-29", "year", 4), "2028-02-29");
  assert.equal(shiftTrackerViewDate("2026-12-31", "day", 1), "2027-01-01");
  assert.equal(shiftTrackerViewDate("2026-12-28", "week", 1), "2027-01-04");
});
