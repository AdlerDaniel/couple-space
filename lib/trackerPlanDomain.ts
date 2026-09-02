export type TrackerPlanKind = "event" | "date" | "task" | "reminder";
export type TrackerPlanStatus = "idea" | "planned" | "tentative" | "done" | "cancelled";
export type TrackerPlanVisibility = "couple" | "private";
export type TrackerPlanRepeat = "none" | "daily" | "weekly" | "monthly" | "yearly";
export type TrackerParticipantScope = "me" | "partner" | "both";

export type TrackerPlan = {
  id: string;
  couple_id: string;
  title: string;
  description: string | null;
  kind: TrackerPlanKind;
  start_date: string | null;
  starts_at: string | null;
  ends_at: string | null;
  all_day: boolean;
  participant_scope: TrackerParticipantScope;
  assignee_id: string | null;
  visibility: TrackerPlanVisibility;
  status: TrackerPlanStatus;
  repeat_mode: TrackerPlanRepeat;
  repeat_interval: number;
  repeat_weekdays: number[];
  repeat_until: string | null;
  category_id: string | null;
  color: string | null;
  edit_scope: "creator" | "participants";
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type TrackerOccurrence = {
  plan: TrackerPlan;
  dateKey: string;
  startsAt: string | null;
  endsAt: string | null;
};

export type TrackerOccurrenceOverride = {
  id: string;
  plan_id: string;
  couple_id: string;
  occurrence_date: string;
  override_start_date: string | null;
  override_starts_at: string | null;
  override_ends_at: string | null;
  status: "planned" | "cancelled" | "done";
  updated_by: string;
  updated_at: string;
};

export type FreeSlot = {
  start: Date;
  end: Date;
};

const MS_PER_DAY = 86_400_000;

export function toTrackerDateKey(value: Date) {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

export function parseTrackerDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

export function addTrackerDays(value: Date, amount: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + amount);
  return next;
}

export function startOfTrackerWeek(value: Date) {
  const day = value.getDay() || 7;
  return addTrackerDays(value, 1 - day);
}

export function getWeekStrip(value: string | Date) {
  const source = typeof value === "string" ? parseTrackerDateKey(value) : value;
  const start = startOfTrackerWeek(source);
  const todayKey = toTrackerDateKey(new Date());
  return Array.from({ length: 7 }, (_, index) => {
    const date = addTrackerDays(start, index);
    return {
      date,
      dateKey: toTrackerDateKey(date),
      weekday: new Intl.DateTimeFormat("ru-RU", { weekday: "short" }).format(date).replace(".", ""),
      day: date.getDate(),
      isToday: toTrackerDateKey(date) === todayKey,
    };
  });
}

export function getPlanBaseDate(plan: TrackerPlan) {
  if (plan.start_date) return plan.start_date;
  if (plan.starts_at) return toTrackerDateKey(new Date(plan.starts_at));
  return toTrackerDateKey(new Date());
}

function isSameOrAfter(value: string, start: string) {
  return value >= start;
}

function isSameOrBefore(value: string, end: string) {
  return value <= end;
}

function monthsBetween(start: Date, end: Date) {
  return (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
}

function occursOn(plan: TrackerPlan, dateKey: string) {
  const baseKey = getPlanBaseDate(plan);
  if (!isSameOrAfter(dateKey, baseKey)) return false;
  if (plan.repeat_until && !isSameOrBefore(dateKey, plan.repeat_until)) return false;
  if (plan.repeat_mode === "none") return dateKey === baseKey;

  const base = parseTrackerDateKey(baseKey);
  const date = parseTrackerDateKey(dateKey);
  const dayDifference = Math.round((date.getTime() - base.getTime()) / MS_PER_DAY);
  const interval = Math.max(1, plan.repeat_interval || 1);

  if (plan.repeat_mode === "daily") return dayDifference % interval === 0;
  if (plan.repeat_mode === "weekly") {
    const isoDay = date.getDay() || 7;
    const weekdays = plan.repeat_weekdays.length ? plan.repeat_weekdays : [base.getDay() || 7];
    return weekdays.includes(isoDay) && Math.floor(dayDifference / 7) % interval === 0;
  }
  if (plan.repeat_mode === "monthly") {
    return date.getDate() === base.getDate() && monthsBetween(base, date) % interval === 0;
  }
  return (
    date.getDate() === base.getDate() &&
    date.getMonth() === base.getMonth() &&
    (date.getFullYear() - base.getFullYear()) % interval === 0
  );
}

function shiftIsoToDate(isoValue: string | null, baseKey: string, targetKey: string) {
  if (!isoValue) return null;
  const original = new Date(isoValue);
  const difference =
    Math.round(
      (parseTrackerDateKey(targetKey).getTime() - parseTrackerDateKey(baseKey).getTime()) / MS_PER_DAY,
    );
  original.setDate(original.getDate() + difference);
  return original.toISOString();
}

export function expandTrackerPlanOccurrences(
  plans: TrackerPlan[],
  from: string,
  to: string,
): TrackerOccurrence[] {
  const start = parseTrackerDateKey(from);
  const end = parseTrackerDateKey(to);
  const occurrences: TrackerOccurrence[] = [];
  let cursor = start;
  let guard = 0;

  while (cursor <= end && guard < 3700) {
    const dateKey = toTrackerDateKey(cursor);
    for (const plan of plans) {
      if (!occursOn(plan, dateKey) || plan.status === "cancelled") continue;
      const baseKey = getPlanBaseDate(plan);
      occurrences.push({
        plan,
        dateKey,
        startsAt: shiftIsoToDate(plan.starts_at, baseKey, dateKey),
        endsAt: shiftIsoToDate(plan.ends_at, baseKey, dateKey),
      });
    }
    cursor = addTrackerDays(cursor, 1);
    guard += 1;
  }

  return occurrences.sort((first, second) => {
    const byDate = first.dateKey.localeCompare(second.dateKey);
    if (byDate) return byDate;
    return (first.startsAt || "").localeCompare(second.startsAt || "");
  });
}

export function applyTrackerOccurrenceOverrides(
  occurrences: TrackerOccurrence[],
  overrides: TrackerOccurrenceOverride[],
) {
  return occurrences.flatMap((occurrence) => {
    const override = overrides.find((item) =>
      item.plan_id === occurrence.plan.id && item.occurrence_date === occurrence.dateKey,
    );
    if (!override) return [occurrence];
    if (override.status === "cancelled") return [];
    return [{
      ...occurrence,
      dateKey: override.override_start_date || occurrence.dateKey,
      startsAt: override.override_starts_at || occurrence.startsAt,
      endsAt: override.override_ends_at || occurrence.endsAt,
    }];
  }).sort((first, second) =>
    first.dateKey.localeCompare(second.dateKey) ||
    (first.startsAt || "").localeCompare(second.startsAt || ""),
  );
}

export function findFreeSlots(
  dateKey: string,
  busy: Array<{ startsAt: string | Date; endsAt: string | Date; allDay?: boolean }>,
  options: { startHour?: number; endHour?: number; durationMinutes?: number; stepMinutes?: number } = {},
) {
  const startHour = options.startHour ?? 9;
  const endHour = options.endHour ?? 22;
  const durationMinutes = options.durationMinutes ?? 60;
  const stepMinutes = options.stepMinutes ?? 30;
  if (busy.some((item) => item.allDay)) return [] as FreeSlot[];

  const base = parseTrackerDateKey(dateKey);
  const dayStart = new Date(base);
  dayStart.setHours(startHour, 0, 0, 0);
  const dayEnd = new Date(base);
  dayEnd.setHours(endHour, 0, 0, 0);
  const durationMs = durationMinutes * 60_000;
  const slots: FreeSlot[] = [];

  for (
    let cursor = dayStart.getTime();
    cursor + durationMs <= dayEnd.getTime();
    cursor += stepMinutes * 60_000
  ) {
    const start = new Date(cursor);
    const end = new Date(cursor + durationMs);
    const overlaps = busy.some((item) => {
      const busyStart = new Date(item.startsAt).getTime();
      const busyEnd = new Date(item.endsAt).getTime();
      return busyStart < end.getTime() && busyEnd > start.getTime();
    });
    if (!overlaps) slots.push({ start, end });
  }

  return slots;
}

function escapeIcs(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

function toIcsUtc(value: string) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function toIcsDate(value: string) {
  return value.replaceAll("-", "");
}

function addOneDate(value: string) {
  return toTrackerDateKey(addTrackerDays(parseTrackerDateKey(value), 1));
}

export function buildTrackerPlanIcs(plan: TrackerPlan, reminderMinutes = 60) {
  const baseDate = getPlanBaseDate(plan);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Couple Space//Tracker Lab//RU",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${escapeIcs(plan.id)}@couple-space`,
    `DTSTAMP:${toIcsUtc(new Date().toISOString())}`,
    `SUMMARY:${escapeIcs(plan.title)}`,
  ];

  if (plan.description) lines.push(`DESCRIPTION:${escapeIcs(plan.description)}`);
  if (plan.all_day) {
    lines.push(`DTSTART;VALUE=DATE:${toIcsDate(baseDate)}`);
    lines.push(`DTEND;VALUE=DATE:${toIcsDate(addOneDate(baseDate))}`);
  } else if (plan.starts_at) {
    lines.push(`DTSTART:${toIcsUtc(plan.starts_at)}`);
    if (plan.ends_at) lines.push(`DTEND:${toIcsUtc(plan.ends_at)}`);
  }

  if (plan.repeat_mode !== "none") {
    const frequency = {
      daily: "DAILY",
      weekly: "WEEKLY",
      monthly: "MONTHLY",
      yearly: "YEARLY",
    }[plan.repeat_mode];
    const parts = [`FREQ=${frequency}`, `INTERVAL=${Math.max(1, plan.repeat_interval)}`];
    if (plan.repeat_mode === "weekly" && plan.repeat_weekdays.length) {
      const weekdays = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
      parts.push(`BYDAY=${plan.repeat_weekdays.map((day) => weekdays[day - 1]).filter(Boolean).join(",")}`);
    }
    if (plan.repeat_until) parts.push(`UNTIL=${toIcsDate(plan.repeat_until)}T235959Z`);
    lines.push(`RRULE:${parts.join(";")}`);
  }

  if (reminderMinutes >= 0) {
    lines.push("BEGIN:VALARM");
    lines.push(`TRIGGER:-PT${Math.max(0, reminderMinutes)}M`);
    lines.push("ACTION:DISPLAY");
    lines.push(`DESCRIPTION:${escapeIcs(plan.title)}`);
    lines.push("END:VALARM");
  }

  lines.push("END:VEVENT", "END:VCALENDAR", "");
  return lines.join("\r\n");
}

export function formatTrackerDate(value: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("ru-RU", options || {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(parseTrackerDateKey(value));
}

export function getTrackerViewRange(selectedDate: string, mode: "day" | "week" | "month" | "year") {
  const source = parseTrackerDateKey(selectedDate);
  if (mode === "day") return { from: selectedDate, to: selectedDate };
  if (mode === "week") {
    const start = startOfTrackerWeek(source);
    return { from: toTrackerDateKey(start), to: toTrackerDateKey(addTrackerDays(start, 6)) };
  }
  if (mode === "month") {
    const start = new Date(source.getFullYear(), source.getMonth(), 1, 12);
    const end = new Date(source.getFullYear(), source.getMonth() + 1, 0, 12);
    return { from: toTrackerDateKey(start), to: toTrackerDateKey(end) };
  }
  return {
    from: `${source.getFullYear()}-01-01`,
    to: `${source.getFullYear()}-12-31`,
  };
}
