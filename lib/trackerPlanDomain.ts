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
  originalDateKey: string;
  status: TrackerPlanStatus;
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

export function getWeekStrip(value: string | Date, timeZone = "Europe/Moscow") {
  const source = typeof value === "string" ? parseTrackerDateKey(value) : value;
  const start = startOfTrackerWeek(source);
  const todayKey = getTrackerToday(timeZone);
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

function zoneParts(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(value);
  const get = (key: string) => parts.find((part) => part.type === key)?.value || "00";
  return { date: [get("year"), get("month"), get("day")].join("-"), time: [get("hour"), get("minute"), get("second")].join(":") };
}

export function getTrackerToday(timeZone = "Europe/Moscow", now = new Date()) {
  return zoneParts(now, timeZone).date;
}

export function formatTrackerClock(iso: string, timeZone = "Europe/Moscow") {
  return zoneParts(new Date(iso), timeZone).time.slice(0, 5);
}

export function trackerDateTimeToIso(date: string, time: string, timeZone = "Europe/Moscow") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}(:\d{2})?$/.test(time)) throw new RangeError("Некорректная дата или время");
  const clock = time.length === 5 ? time + ":00" : time;
  const target = Date.parse(date + "T" + clock + "Z");
  if (!Number.isFinite(target) || new Date(target).toISOString().slice(0, 10) !== date) throw new RangeError("Некорректная дата");
  const offsets = new Set<number>();
  for (const hours of [-36, -12, 0, 12, 36]) {
    const sample = new Date(target + hours * 3_600_000);
    const local = zoneParts(sample, timeZone);
    offsets.add(Date.parse(local.date + "T" + local.time + "Z") - sample.getTime());
  }
  const matches = [...offsets].map((offset) => target - offset).filter((instant) => {
    const local = zoneParts(new Date(instant), timeZone);
    return local.date === date && local.time === clock;
  }).sort((x, y) => x - y);
  if (!matches.length) throw new RangeError("Это время не существует в выбранном часовом поясе");
  return new Date(matches[0]).toISOString();
}

export function getPlanBaseDate(plan: TrackerPlan, timeZone = "Europe/Moscow") {
  if (!plan.all_day && plan.starts_at) return getTrackerToday(timeZone, new Date(plan.starts_at));
  return plan.start_date || getTrackerToday(timeZone);
}

function dateNumber(key: string) { return Date.parse(key + "T12:00:00Z") / MS_PER_DAY; }
function shiftDate(key: string, amount: number) { return new Date((dateNumber(key) + amount) * MS_PER_DAY).toISOString().slice(0, 10); }

function occursOn(plan: TrackerPlan, dateKey: string, timeZone: string) {
  const baseKey = getPlanBaseDate(plan, timeZone);
  if (dateKey < baseKey || (plan.repeat_until && dateKey > plan.repeat_until)) return false;
  if (plan.repeat_mode === "none") return dateKey === baseKey;
  const base = new Date(baseKey + "T12:00:00Z");
  const date = new Date(dateKey + "T12:00:00Z");
  const difference = dateNumber(dateKey) - dateNumber(baseKey);
  const interval = Math.max(1, plan.repeat_interval || 1);
  if (plan.repeat_mode === "daily") return difference % interval === 0;
  if (plan.repeat_mode === "weekly") {
    const baseDay = base.getUTCDay() || 7;
    const day = date.getUTCDay() || 7;
    const weeks = (difference - (day - 1) + (baseDay - 1)) / 7;
    const weekdays = plan.repeat_weekdays.length ? plan.repeat_weekdays : [baseDay];
    return weekdays.includes(day) && weeks % interval === 0;
  }
  if (plan.repeat_mode === "monthly") {
    const months = (date.getUTCFullYear() - base.getUTCFullYear()) * 12 + date.getUTCMonth() - base.getUTCMonth();
    return date.getUTCDate() === base.getUTCDate() && months % interval === 0;
  }
  return date.getUTCDate() === base.getUTCDate() && date.getUTCMonth() === base.getUTCMonth() && (date.getUTCFullYear() - base.getUTCFullYear()) % interval === 0;
}

function shiftIsoToDate(iso: string | null, baseKey: string, targetKey: string, timeZone: string) {
  if (!iso) return null;
  const local = zoneParts(new Date(iso), timeZone);
  return trackerDateTimeToIso(shiftDate(targetKey, dateNumber(local.date) - dateNumber(baseKey)), local.time, timeZone);
}

function makeOccurrence(plan: TrackerPlan, key: string, timeZone: string): TrackerOccurrence | null {
  try {
    const base = getPlanBaseDate(plan, timeZone);
    return { plan, dateKey: key, originalDateKey: key, status: plan.status,
      startsAt: plan.all_day ? null : shiftIsoToDate(plan.starts_at, base, key, timeZone),
      endsAt: plan.all_day ? null : shiftIsoToDate(plan.ends_at, base, key, timeZone) };
  } catch (error) {
    if (error instanceof RangeError) return null;
    throw error;
  }
}

export function expandTrackerPlanOccurrences(
  plans: TrackerPlan[], from: string, to: string, timeZone = "Europe/Moscow",
  overrides: TrackerOccurrenceOverride[] = [],
): TrackerOccurrence[] {
  const occurrences: TrackerOccurrence[] = [];
  for (let key = from, guard = 0; key <= to && guard < 3700; key = shiftDate(key, 1), guard += 1) {
    for (const plan of plans) {
      if (plan.status === "cancelled" || !occursOn(plan, key, timeZone)) continue;
      const occurrence = makeOccurrence(plan, key, timeZone);
      if (occurrence) occurrences.push(occurrence);
    }
  }
  // Include repetitions moved into the range from an original date outside it.
  for (const override of overrides) {
    if (override.occurrence_date >= from && override.occurrence_date <= to) continue;
    const plan = plans.find((item) => item.id === override.plan_id);
    if (!plan || plan.status === "cancelled" || !occursOn(plan, override.occurrence_date, timeZone)) continue;
    const occurrence = makeOccurrence(plan, override.occurrence_date, timeZone);
    if (occurrence) occurrences.push(occurrence);
  }
  return applyTrackerOccurrenceOverrides(occurrences, overrides, timeZone).filter((item) => item.dateKey >= from && item.dateKey <= to);
}

export function applyTrackerOccurrenceOverrides(occurrences: TrackerOccurrence[], overrides: TrackerOccurrenceOverride[], timeZone = "Europe/Moscow") {
  return occurrences.flatMap((occurrence) => {
    const key = occurrence.originalDateKey || occurrence.dateKey;
    const override = overrides.find((item) => item.plan_id === occurrence.plan.id && item.occurrence_date === key);
    if (!override) return [occurrence];
    if (override.status === "cancelled") return [];
    const dateKey = override.override_start_date || (override.override_starts_at ? getTrackerToday(timeZone, new Date(override.override_starts_at)) : key);
    return [{ ...occurrence, originalDateKey: key, status: override.status, dateKey,
      startsAt: override.override_starts_at || shiftIsoToDate(occurrence.plan.starts_at, getPlanBaseDate(occurrence.plan, timeZone), dateKey, timeZone),
      endsAt: override.override_ends_at || shiftIsoToDate(occurrence.plan.ends_at, getPlanBaseDate(occurrence.plan, timeZone), dateKey, timeZone) }];
  }).sort((x, y) => x.dateKey.localeCompare(y.dateKey) || (x.startsAt || "").localeCompare(y.startsAt || ""));
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
    .replace(/\r\n|\r|\n/g, "\\n")
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

function foldIcsLine(line: string) {
  const encoder = new TextEncoder();
  const result: string[] = [];
  let part = "";
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (size + bytes > 75) { result.push(part); part = " "; size = 1; }
    part += char;
    size += bytes;
  }
  result.push(part);
  return result.join("\r\n");
}

export function buildTrackerPlanIcs(plan: TrackerPlan, reminderMinutes = 60, timeZone = "Europe/Moscow", overrides: TrackerOccurrenceOverride[] = []) {
  const baseDate = getPlanBaseDate(plan, timeZone);
  const localValue = (iso: string) => {
    const local = zoneParts(new Date(iso), timeZone);
    return toIcsDate(local.date) + "T" + local.time.replaceAll(":", "");
  };
  const timedProperty = (name: string, iso: string) => name + ";TZID=" + timeZone + ":" + localValue(iso);
  const stamp = toIcsUtc(new Date().toISOString());
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Couple Space//Tracker Lab//RU", "CALSCALE:GREGORIAN", "X-WR-TIMEZONE:" + timeZone];
  const addEvent = (occurrence?: TrackerOccurrenceOverride) => {
    const originalKey = occurrence?.occurrence_date || baseDate;
    const starts = occurrence?.override_starts_at || shiftIsoToDate(plan.starts_at, baseDate, occurrence?.override_start_date || originalKey, timeZone);
    const ends = occurrence?.override_ends_at || shiftIsoToDate(plan.ends_at, baseDate, occurrence?.override_start_date || originalKey, timeZone);
    const date = occurrence?.override_start_date || (!plan.all_day && starts ? getTrackerToday(timeZone, new Date(starts)) : originalKey);
    lines.push("BEGIN:VEVENT", "UID:" + escapeIcs(plan.id) + "@couple-space", "DTSTAMP:" + stamp, "SUMMARY:" + escapeIcs(plan.title));
    if (occurrence) {
      if (plan.all_day) lines.push("RECURRENCE-ID;VALUE=DATE:" + toIcsDate(originalKey));
      else if (plan.starts_at) lines.push(timedProperty("RECURRENCE-ID", shiftIsoToDate(plan.starts_at, baseDate, originalKey, timeZone)!));
    }
    if (plan.description) lines.push("DESCRIPTION:" + escapeIcs(plan.description));
    if (plan.all_day) lines.push("DTSTART;VALUE=DATE:" + toIcsDate(date), "DTEND;VALUE=DATE:" + toIcsDate(addOneDate(date)));
    else if (starts) {
      lines.push(timedProperty("DTSTART", starts));
      if (ends) lines.push(timedProperty("DTEND", ends));
    }
    if (!occurrence && plan.repeat_mode !== "none") {
      const parts = ["FREQ=" + plan.repeat_mode.toUpperCase(), "INTERVAL=" + Math.max(1, plan.repeat_interval), "WKST=MO"];
      if (plan.repeat_mode === "weekly" && plan.repeat_weekdays.length) {
        const weekdays = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
        parts.push("BYDAY=" + plan.repeat_weekdays.map((day) => weekdays[day - 1]).filter(Boolean).join(","));
      }
      if (plan.repeat_until) parts.push("UNTIL=" + (plan.all_day ? toIcsDate(plan.repeat_until) : toIcsUtc(trackerDateTimeToIso(plan.repeat_until, "23:59:59", timeZone))));
      lines.push("RRULE:" + parts.join(";"));
    }
    const status = occurrence?.status || plan.status;
    if (status === "cancelled") lines.push("STATUS:CANCELLED");
    if (status === "done") lines.push("X-TRACKER-STATUS:DONE");
    if (reminderMinutes >= 0 && status !== "cancelled" && status !== "done") lines.push("BEGIN:VALARM", "TRIGGER:-PT" + Math.max(0, reminderMinutes) + "M", "ACTION:DISPLAY", "DESCRIPTION:" + escapeIcs(plan.title), "END:VALARM");
    lines.push("END:VEVENT");
  };
  addEvent();
  for (const override of overrides.filter((item) => item.plan_id === plan.id)) addEvent(override);
  lines.push("END:VCALENDAR", "");
  return lines.map(foldIcsLine).join("\r\n");
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


export function shiftTrackerViewDate(selectedDate: string, mode: "day" | "week" | "month" | "year", amount: number) {
  if (mode === "day" || mode === "week") return shiftDate(selectedDate, amount * (mode === "week" ? 7 : 1));
  const source = new Date(selectedDate + "T12:00:00Z");
  const month = source.getUTCMonth() + (mode === "month" ? amount : 0);
  const year = source.getUTCFullYear() + (mode === "year" ? amount : 0);
  const target = new Date(Date.UTC(year, month, 1, 12));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12)).getUTCDate();
  target.setUTCDate(Math.min(source.getUTCDate(), lastDay));
  return target.toISOString().slice(0, 10);
}
