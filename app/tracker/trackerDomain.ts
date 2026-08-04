import { trackerCategoryColors } from "@/lib/trackerCategories";

import type { TrackerPeriod } from "./TrackerNavigation";

export type Period = TrackerPeriod;
export type Mood = "great" | "good" | "normal" | "tired" | "bad";
export type Participants = "both" | "me" | "partner";

export type Couple = {
  id: string;
  partner_one_id: string;
  partner_two_id: string | null;
};

export type TrackerCategory = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  sort_order: number;
  is_default: boolean;
};

export type TrackerEvent = {
  id: string;
  couple_id: string;
  category_id: string;
  date: string;
  time: string | null;
  count: number;
  duration_minutes: number;
  note: string | null;
  mood: Mood;
  participants: Participants;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type GoalPeriod = "day" | "week" | "month" | "year";

export type TrackerGoal = {
  id: string;
  couple_id: string;
  title: string;
  category_id: string | null;
  period: GoalPeriod;
  target_count: number;
  created_by: string;
  created_at: string;
};

export const goalPeriods: { key: GoalPeriod; label: string }[] = [
  { key: "day", label: "за день" },
  { key: "week", label: "за неделю" },
  { key: "month", label: "за месяц" },
  { key: "year", label: "за год" },
];

export const moods: { key: Mood; label: string; icon: string }[] = [
  { key: "bad", label: "Злость", icon: "😠" },
  { key: "great", label: "Радость", icon: "😄" },
  { key: "tired", label: "Грусть", icon: "😢" },
  { key: "good", label: "С любовью", icon: "🥰" },
  { key: "normal", label: "Заигрывание", icon: "😏" },
];

const DAY_MOOD_MARKER = "[[day-mood]]";

export function getCategoryColor(category: TrackerCategory) {
  return trackerCategoryColors[category.slug] || category.color || "#ca8a04";
}

export function hasDayMood(event: TrackerEvent) {
  return event.note?.startsWith(DAY_MOOD_MARKER) || false;
}

export function getDayMood(events: TrackerEvent[]) {
  const marker = events.find(hasDayMood);
  return marker ? moods.find((mood) => mood.key === marker.mood) || null : null;
}

export function getVisibleEventNote(event: TrackerEvent) {
  if (!event.note) return "";
  return event.note.startsWith(DAY_MOOD_MARKER)
    ? event.note.slice(DAY_MOOD_MARKER.length).trim()
    : event.note;
}

export function getDayMoodNote(note = "") {
  return `${DAY_MOOD_MARKER}${note ? `\n${note}` : ""}`;
}

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay() || 7;
  next.setDate(next.getDate() - day + 1);
  return next;
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function formatDate(dateKey: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parseDateKey(dateKey));
}

export function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(date);
}

export function monthTitle(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(date);
}

export function getDateRange(date: Date, period: Period) {
  if (period === "day") return { from: toDateKey(date), to: toDateKey(date) };
  if (period === "week") {
    const start = startOfWeek(date);
    return { from: toDateKey(start), to: toDateKey(addDays(start, 6)) };
  }
  if (period === "year") {
    return {
      from: toDateKey(new Date(date.getFullYear(), 0, 1)),
      to: toDateKey(new Date(date.getFullYear(), 11, 31)),
    };
  }
  return { from: toDateKey(startOfMonth(date)), to: toDateKey(endOfMonth(date)) };
}

export function getGoalDateRange(period: GoalPeriod) {
  return getDateRange(new Date(), period);
}

export function sumEvents(events: TrackerEvent[], categoryId?: string) {
  return events
    .filter((event) => !categoryId || event.category_id === categoryId)
    .reduce((sum, event) => sum + event.count + Math.ceil(event.duration_minutes / 60), 0);
}

export function countOnly(events: TrackerEvent[], categoryId?: string) {
  return events
    .filter((event) => !categoryId || event.category_id === categoryId)
    .reduce((sum, event) => sum + event.count, 0);
}

export function groupByDate(events: TrackerEvent[]) {
  return events.reduce<Record<string, TrackerEvent[]>>((result, event) => {
    result[event.date] = [...(result[event.date] || []), event];
    return result;
  }, {});
}

export function getCalendarDays(monthDate: Date) {
  const start = startOfMonth(monthDate);
  const end = endOfMonth(monthDate);
  const gridStart = startOfWeek(start);
  const days: Date[] = [];
  let cursor = gridStart;

  while (days.length < 42) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
    if (cursor > end && days.length % 7 === 0) break;
  }

  return days;
}

export function getStreak(events: TrackerEvent[]) {
  const activeDays = new Set(events.map((event) => event.date));
  let cursor = new Date();
  let streak = 0;

  while (activeDays.has(toDateKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

export function getBestDay(events: TrackerEvent[]) {
  const grouped = groupByDate(events);
  const best = Object.entries(grouped)
    .map(([date, rows]) => ({ date, score: sumEvents(rows) }))
    .sort((a, b) => b.score - a.score)[0];
  return best ? `${formatShortDate(parseDateKey(best.date))} · ${best.score}` : "пока нет";
}

export function getMostFrequent(events: TrackerEvent[], categories: TrackerCategory[]) {
  const best = categories
    .map((category) => ({
      category,
      value: countOnly(events, category.id),
    }))
    .sort((a, b) => b.value - a.value)[0];
  return best && best.value > 0 ? best.category.name : "пока нет";
}

export function compareWithPreviousMonth(events: TrackerEvent[], selectedDate: Date) {
  const thisStart = startOfMonth(selectedDate);
  const thisEnd = endOfMonth(selectedDate);
  const previousStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1);
  const previousEnd = endOfMonth(previousStart);
  const current = events.filter((event) => {
    const date = parseDateKey(event.date);
    return date >= thisStart && date <= thisEnd;
  }).length;
  const previous = events.filter((event) => {
    const date = parseDateKey(event.date);
    return date >= previousStart && date <= previousEnd;
  }).length;

  if (!previous && current) return "+100% к прошлому месяцу";
  if (!previous) return "нет прошлого месяца";
  const diff = Math.round(((current - previous) / previous) * 100);
  return `${diff > 0 ? "+" : ""}${diff}% к прошлому месяцу`;
}

export function getWeekDays(selectedDate: Date) {
  const start = startOfWeek(selectedDate);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}
