"use client";

import { createPartnerNotification } from "@/lib/notifications";
import { supabase } from "@/lib/supabaseClient";
import { trackerCategoryColors, trackerDefaultCategories } from "@/lib/trackerCategories";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CirclePlus,
  Dumbbell,
  Gamepad2,
  Heart,
  Minus,
  Palette,
  Plus,
  RefreshCw,
  Trash2,
  Utensils,
} from "lucide-react";

type Period = "day" | "week" | "month" | "year";
type Mood = "great" | "good" | "normal" | "tired" | "bad";
type Participants = "both" | "me" | "partner";

type Couple = {
  id: string;
  partner_one_id: string;
  partner_two_id: string | null;
};

type TrackerCategory = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  sort_order: number;
  is_default: boolean;
};

type TrackerEvent = {
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

type TrackerGoal = {
  id: string;
  couple_id: string;
  title: string;
  category_id: string | null;
  period: GoalPeriod;
  target_count: number;
  created_by: string;
  created_at: string;
};

type GoalPeriod = "day" | "week" | "month" | "year";

function getCategoryColor(category: TrackerCategory) {
  return trackerCategoryColors[category.slug] || category.color || "#ca8a04";
}

const periodTabs: { key: Period; label: string }[] = [
  { key: "day", label: "День" },
  { key: "week", label: "Неделя" },
  { key: "month", label: "Месяц" },
  { key: "year", label: "Год" },
];

const goalPeriods: { key: GoalPeriod; label: string }[] = [
  { key: "day", label: "за день" },
  { key: "week", label: "за неделю" },
  { key: "month", label: "за месяц" },
  { key: "year", label: "за год" },
];

const moods: { key: Mood; label: string; icon: string }[] = [
  { key: "bad", label: "Злость", icon: "😠" },
  { key: "great", label: "Радость", icon: "😄" },
  { key: "tired", label: "Грусть", icon: "😢" },
  { key: "good", label: "С любовью", icon: "🥰" },
  { key: "normal", label: "Заигрывание", icon: "😏" },
];

const DAY_MOOD_MARKER = "[[day-mood]]";

function hasDayMood(event: TrackerEvent) {
  return event.note?.startsWith(DAY_MOOD_MARKER) || false;
}

function getDayMood(events: TrackerEvent[]) {
  const marker = events.find(hasDayMood);
  return marker ? moods.find((mood) => mood.key === marker.mood) || null : null;
}

function getVisibleEventNote(event: TrackerEvent) {
  if (!event.note) return "";
  return event.note.startsWith(DAY_MOOD_MARKER)
    ? event.note.slice(DAY_MOOD_MARKER.length).trim()
    : event.note;
}

function CategoryIcon({ category, size = 18 }: { category: TrackerCategory; size?: number }) {
  const Icon = category.slug === "food"
    ? Utensils
    : category.slug === "sex"
      ? Heart
      : category.slug === "sport"
        ? Dumbbell
        : category.slug === "games"
          ? Gamepad2
          : Palette;
  return <Icon aria-hidden="true" size={size} strokeWidth={2.25} />;
}

const trackerPanelClass =
  "border border-amber-900/12 bg-white/64 shadow-[0_20px_55px_rgba(146,64,14,0.09)] backdrop-blur-xl dark:border-amber-200/10 dark:bg-[#211a0c]/78 dark:shadow-[0_24px_70px_rgba(0,0,0,0.26)]";

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay() || 7;
  next.setDate(next.getDate() - day + 1);
  return next;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function formatDate(dateKey: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parseDateKey(dateKey));
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(date);
}

function monthTitle(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(date);
}

function getDateRange(date: Date, period: Period) {
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

function getGoalDateRange(period: GoalPeriod) {
  return getDateRange(new Date(), period);
}

function sumEvents(events: TrackerEvent[], categoryId?: string) {
  return events
    .filter((event) => !categoryId || event.category_id === categoryId)
    .reduce((sum, event) => sum + event.count + Math.ceil(event.duration_minutes / 60), 0);
}

function countOnly(events: TrackerEvent[], categoryId?: string) {
  return events
    .filter((event) => !categoryId || event.category_id === categoryId)
    .reduce((sum, event) => sum + event.count, 0);
}

function groupByDate(events: TrackerEvent[]) {
  return events.reduce<Record<string, TrackerEvent[]>>((result, event) => {
    result[event.date] = [...(result[event.date] || []), event];
    return result;
  }, {});
}

function getCalendarDays(monthDate: Date) {
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

function getStreak(events: TrackerEvent[]) {
  const activeDays = new Set(events.map((event) => event.date));
  let cursor = new Date();
  let streak = 0;

  while (activeDays.has(toDateKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

function getBestDay(events: TrackerEvent[]) {
  const grouped = groupByDate(events);
  const best = Object.entries(grouped)
    .map(([date, rows]) => ({ date, score: sumEvents(rows) }))
    .sort((a, b) => b.score - a.score)[0];
  return best ? `${formatShortDate(parseDateKey(best.date))} · ${best.score}` : "пока нет";
}

function getMostFrequent(events: TrackerEvent[], categories: TrackerCategory[]) {
  const best = categories
    .map((category) => ({
      category,
      value: countOnly(events, category.id),
    }))
    .sort((a, b) => b.value - a.value)[0];
  return best && best.value > 0 ? best.category.name : "пока нет";
}

function compareWithPreviousMonth(events: TrackerEvent[], selectedDate: Date) {
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

function getWeekDays(selectedDate: Date) {
  const start = startOfWeek(selectedDate);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export default function TrackerPage() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [categories, setCategories] = useState<TrackerCategory[]>([]);
  const [events, setEvents] = useState<TrackerEvent[]>([]);
  const [goals, setGoals] = useState<TrackerGoal[]>([]);
  const [goalCategoryId, setGoalCategoryId] = useState("");
  const [goalPeriod, setGoalPeriod] = useState<GoalPeriod>("week");
  const [goalTargetCount, setGoalTargetCount] = useState(1);
  const [period, setPeriod] = useState<Period>("month");
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("all");
  const [editingNames, setEditingNames] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSpark, setShowSpark] = useState(false);

  const activityEvents = useMemo(() => events.filter((event) => event.count > 0), [events]);

  const selectedDayEvents = useMemo(
    () => events.filter((event) => event.date === selectedDate),
    [events, selectedDate]
  );
  const mySelectedDayEvents = useMemo(
    () => selectedDayEvents.filter((event) => event.created_by === currentUserId),
    [currentUserId, selectedDayEvents]
  );
  const monthEvents = useMemo(() => {
    const start = startOfMonth(viewDate);
    const end = endOfMonth(viewDate);
    return activityEvents.filter((event) => {
      const date = parseDateKey(event.date);
      return date >= start && date <= end;
    });
  }, [activityEvents, viewDate]);
  const weekDays = useMemo(() => getWeekDays(parseDateKey(selectedDate)), [selectedDate]);
  const eventsByDate = useMemo(() => groupByDate(events), [events]);
  const selectedRange = useMemo(() => getDateRange(parseDateKey(selectedDate), period), [period, selectedDate]);
  const rangeEvents = useMemo(
    () => activityEvents.filter((event) => event.date >= selectedRange.from && event.date <= selectedRange.to),
    [activityEvents, selectedRange]
  );

  useEffect(() => {
    if (!goalCategoryId && categories.length > 0) {
      queueMicrotask(() => setGoalCategoryId(categories[0].id));
    }
  }, [categories, goalCategoryId]);

  useEffect(() => {
    async function loadTracker() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsLoading(false);
        return;
      }

      setCurrentUserId(user.id);

      const { data: coupleData } = await supabase
        .from("couples")
        .select("id, partner_one_id, partner_two_id")
        .or(`partner_one_id.eq.${user.id},partner_two_id.eq.${user.id}`)
        .limit(1)
        .maybeSingle<Couple>();

      if (!coupleData) {
        setIsLoading(false);
        return;
      }

      setCouple(coupleData);

      const { data: categoryRows, error: categoryError } = await supabase
        .from("tracker_categories")
        .select("*")
        .order("sort_order", { ascending: true });

      if (categoryError) {
        setMessage("Создайте таблицы из supabase-tracker.sql в Supabase.");
        setCategories([]);
        setEvents([]);
        setIsLoading(false);
        return;
      }

      let nextCategories = (categoryRows || []) as TrackerCategory[];

      const hasMissingDefaultCategories = trackerDefaultCategories.some(
        (defaultCategory) =>
          !nextCategories.some((category) => category.slug === defaultCategory.slug)
      );

      if (hasMissingDefaultCategories) {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const response = await fetch("/api/tracker/categories", {
          method: "POST",
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {},
        });
        const result = (await response.json()) as {
          categories?: TrackerCategory[];
          error?: string;
        };

        if (response.ok && result.categories) {
          nextCategories = result.categories;
        } else if (nextCategories.length === 0) {
          console.error(result.error || "Не удалось обновить категории трекера");
        }
      }

      if (nextCategories.length === 0) {
        const { data: insertedCategories } = await supabase
          .from("tracker_categories")
          .insert(trackerDefaultCategories)
          .select("*");
        nextCategories = (insertedCategories || []) as TrackerCategory[];
      }

      setCategories(nextCategories);
      setEditingNames(
        nextCategories.reduce<Record<string, string>>((result, category) => {
          result[category.id] = category.name;
          return result;
        }, {})
      );

      const yearRange = getDateRange(new Date(), "year");
      const { data: eventRows } = await supabase
        .from("tracker_events")
        .select("*")
        .eq("couple_id", coupleData.id)
        .gte("date", yearRange.from)
        .lte("date", yearRange.to)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      setEvents((eventRows || []) as TrackerEvent[]);

      const { data: goalRows, error: goalsError } = await supabase
        .from("tracker_goals")
        .select("*")
        .eq("couple_id", coupleData.id)
        .order("created_at", { ascending: false });

      if (!goalsError) {
        setGoals((goalRows || []) as TrackerGoal[]);
      }

      setIsLoading(false);
    }

    loadTracker();
  }, []);

  async function reloadEvents() {
    if (!couple) return;
    const yearRange = getDateRange(viewDate, "year");
    const { data } = await supabase
      .from("tracker_events")
      .select("*")
      .eq("couple_id", couple.id)
      .gte("date", yearRange.from)
      .lte("date", yearRange.to)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    setEvents((data || []) as TrackerEvent[]);
  }

  async function reloadGoals() {
    if (!couple) return;

    const { data, error } = await supabase
      .from("tracker_goals")
      .select("*")
      .eq("couple_id", couple.id)
      .order("created_at", { ascending: false });

    if (!error) {
      setGoals((data || []) as TrackerGoal[]);
    }
  }

  async function createGoal() {
    const category = categories.find((item) => item.id === goalCategoryId);
    if (!category || !couple || !currentUserId) return;

    const title = category.name;

    const optimisticGoal: TrackerGoal = {
      id: `local-${Date.now()}`,
      couple_id: couple.id,
      title,
      category_id: category.id,
      period: goalPeriod,
      target_count: goalTargetCount,
      created_by: currentUserId,
      created_at: new Date().toISOString(),
    };

    setGoals((current) => [optimisticGoal, ...current]);

    const { data, error } = await supabase
      .from("tracker_goals")
      .insert({
        couple_id: couple.id,
        title,
        category_id: category.id,
        period: goalPeriod,
        target_count: goalTargetCount,
        created_by: currentUserId,
      })
      .select("*")
      .single<TrackerGoal>();

    if (error || !data) {
      setGoals((current) => current.filter((goal) => goal.id !== optimisticGoal.id));
      setMessage(error?.message || "Не удалось сохранить цель.");
      window.setTimeout(() => setMessage(""), 2400);
      return;
    }

    setGoals((current) => current.map((goal) => (goal.id === optimisticGoal.id ? data : goal)));
    setGoalTargetCount(1);

    await createPartnerNotification(couple, currentUserId, {
      type: "tracker_goal_created",
      title: "Новая цель пары",
      body: `${category.name}: ${goalTargetCount} ${
        goalPeriods.find((item) => item.key === goalPeriod)?.label || "за неделю"
      }`,
      href: "/tracker",
    });
  }

  async function deleteGoal(goalId: string) {
    if (!currentUserId) return;

    const previousGoals = goals;
    setGoals((current) => current.filter((goal) => goal.id !== goalId));

    const { error } = await supabase
      .from("tracker_goals")
      .delete()
      .eq("id", goalId)
      .eq("created_by", currentUserId);

    if (error) {
      setGoals(previousGoals);
      setMessage("Удалить можно только свою цель.");
      window.setTimeout(() => setMessage(""), 2000);
    }
  }

  async function adjustCategory(category: TrackerCategory, delta: 1 | -1) {
    if (!couple || !currentUserId || isSaving) return;
    setIsSaving(true);

    const existing = mySelectedDayEvents.find((event) => event.category_id === category.id);

    if (!existing && delta === 1) {
      const isFirstForDay = selectedDayEvents.length === 0;
      const { data, error } = await supabase
        .from("tracker_events")
        .insert([
          {
            couple_id: couple.id,
            category_id: category.id,
            date: selectedDate,
            time: null,
            count: 1,
            duration_minutes: category.slug === "games" ? 60 : 0,
            note: null,
            mood: "good",
            participants: "me",
            created_by: currentUserId,
          },
        ])
        .select("*")
        .single<TrackerEvent>();

      if (!error && data) {
        setEvents((current) => [data, ...current]);
        if (isFirstForDay) {
          setShowSpark(true);
          window.setTimeout(() => setShowSpark(false), 1200);
        }
      } else {
        setMessage(error?.message || "Не удалось поставить отметку.");
      }
      setIsSaving(false);
      return;
    }

    if (!existing) {
      setIsSaving(false);
      return;
    }

    const nextCount = Math.max(0, existing.count + delta);

    if (nextCount === 0 && !hasDayMood(existing)) {
      const { error } = await supabase
        .from("tracker_events")
        .delete()
        .eq("id", existing.id)
        .eq("created_by", currentUserId);
      if (!error) {
        setEvents((current) => current.filter((event) => event.id !== existing.id));
      } else {
        setMessage(error.message);
      }
      setIsSaving(false);
      return;
    }

    const { data, error } = await supabase
      .from("tracker_events")
      .update({ count: nextCount, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .eq("created_by", currentUserId)
      .select("*")
      .single<TrackerEvent>();

    if (!error && data) {
      setEvents((current) => current.map((event) => (event.id === data.id ? data : event)));
    } else {
      setMessage(error?.message || "Не удалось обновить отметку.");
    }

    setIsSaving(false);
  }

  async function saveDayMood(mood: Mood) {
    if (!couple || !currentUserId || categories.length === 0) return;
    const markerEvent = mySelectedDayEvents.find(hasDayMood);
    const targetEvent = markerEvent || mySelectedDayEvents[0];

    if (targetEvent) {
      const cleanNote = targetEvent.note?.startsWith(DAY_MOOD_MARKER)
        ? targetEvent.note.slice(DAY_MOOD_MARKER.length).trimStart()
        : targetEvent.note || "";
      const { data, error } = await supabase
        .from("tracker_events")
        .update({
          mood,
          note: `${DAY_MOOD_MARKER}${cleanNote ? `\n${cleanNote}` : ""}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetEvent.id)
        .eq("created_by", currentUserId)
        .select("*")
        .single<TrackerEvent>();

      if (!error && data) {
        setEvents((current) => current.map((event) => (event.id === data.id ? data : event)));
      } else {
        setMessage(error?.message || "Не удалось сохранить эмодзи дня.");
      }
      return;
    }

    const { data, error } = await supabase
      .from("tracker_events")
      .insert({
        couple_id: couple.id,
        category_id: categories[0].id,
        date: selectedDate,
        time: null,
        count: 0,
        duration_minutes: 0,
        note: DAY_MOOD_MARKER,
        mood,
        participants: "me",
        created_by: currentUserId,
      })
      .select("*")
      .single<TrackerEvent>();

    if (!error && data) {
      setEvents((current) => [data, ...current]);
    } else {
      setMessage(error?.message || "Не удалось сохранить эмодзи дня.");
    }
  }

  async function saveCategoryName(category: TrackerCategory) {
    const name = editingNames[category.id]?.trim();
    if (!name || name === category.name) return;

    const { data, error } = await supabase
      .from("tracker_categories")
      .update({ name })
      .eq("id", category.id)
      .select("*")
      .single<TrackerCategory>();

    if (!error && data) {
      setCategories((current) =>
        current.map((item) => (item.id === data.id ? data : item)).sort((a, b) => a.sort_order - b.sort_order)
      );
      setMessage("Категория переименована");
      window.setTimeout(() => setMessage(""), 1800);
    } else {
      setMessage(error?.message || "Не удалось переименовать категорию.");
    }
  }

  function shiftView(direction: -1 | 1) {
    const date = new Date(viewDate);
    if (period === "year") {
      date.setFullYear(date.getFullYear() + direction);
    } else if (period === "week") {
      date.setDate(date.getDate() + direction * 7);
    } else {
      date.setMonth(date.getMonth() + direction);
    }
    setViewDate(date);
    setSelectedDate(toDateKey(date));
  }

  if (isLoading) {
    return (
      <main className="tracker-theme flex min-h-screen items-center justify-center bg-gradient-to-br from-[#fffbeb] via-[#fefce8] to-[#fef9c3] px-6 pt-28 text-[#713f12] dark:from-[#171204] dark:via-[#111006] dark:to-black dark:text-white">
        <div className="rounded-[2rem] bg-white/65 p-8 font-black shadow-2xl backdrop-blur dark:bg-white/10">
          Загружаем трекер...
        </div>
      </main>
    );
  }

  if (!currentUserId || !couple) {
    return (
      <main className="tracker-theme flex min-h-screen items-center justify-center bg-gradient-to-br from-[#fffbeb] via-[#fefce8] to-[#fef9c3] px-6 pt-28 text-[#713f12] dark:from-[#171204] dark:via-[#111006] dark:to-black dark:text-white">
        <div className="max-w-md rounded-[2rem] bg-white/70 p-8 text-center shadow-2xl backdrop-blur dark:bg-white/10">
          <p className="text-2xl font-black">Нужна пара</p>
          <p className="mt-3 font-semibold opacity-70">
            Создайте или подключите пару в профиле, чтобы отмечать общие дни.
          </p>
          <Link
            href="/profile"
            className="mt-6 inline-flex rounded-2xl bg-[#ca8a04] px-5 py-3 font-black text-white shadow-lg"
          >
            Открыть профиль
          </Link>
        </div>
      </main>
    );
  }

  const yearDays = Array.from(
    { length: Math.floor((new Date(viewDate.getFullYear(), 11, 31).getTime() - new Date(viewDate.getFullYear(), 0, 1).getTime()) / 86400000) + 1 },
    (_, index) => addDays(new Date(viewDate.getFullYear(), 0, 1), index)
  );
  const filteredYearDays = yearDays.map((date) => {
    const dateKey = toDateKey(date);
    const rows = (eventsByDate[dateKey] || []).filter(
      (event) => selectedCategoryFilter === "all" || event.category_id === selectedCategoryFilter
    );
    return { date, dateKey, rows, score: sumEvents(rows) };
  });
  const maxYearScore = Math.max(1, ...filteredYearDays.map((day) => day.score));
  return (
    <main className="tracker-theme mobile-redesign-page min-h-screen px-3 pb-28 pt-7 text-[#713f12] dark:text-amber-50 sm:px-5 lg:px-8 lg:pb-12 lg:pt-8">
      <div className="mx-auto max-w-[1480px] space-y-4 sm:space-y-5">
        <TrackerHeader
          total={sumEvents(rangeEvents)}
          activeDays={new Set(rangeEvents.map((event) => event.date)).size}
          streak={getStreak(activityEvents)}
        />

        <div className="grid gap-3 lg:grid-cols-[minmax(17rem,0.68fr)_minmax(32rem,1fr)] lg:items-center">
          <DateNavigator period={period} viewDate={viewDate} selectedDate={selectedDate} onShift={shiftView} />
          <PeriodTabs period={period} onChange={setPeriod} />
        </div>

        {message && (
          <div className={`${trackerPanelClass} rounded-2xl px-4 py-3 text-center text-sm font-black`}>
            {message}
          </div>
        )}

        <section className="tracker-content-grid">
          <div className="tracker-summary">
            <TrackerStatsCards
              monthEvents={monthEvents}
              allEvents={activityEvents}
              categories={categories}
              selectedDate={viewDate}
            />
          </div>

          <div className="tracker-view">
            {period === "day" && (
              <DayOverview
                selectedDate={selectedDate}
                categories={categories}
                events={mySelectedDayEvents}
                onAdjust={adjustCategory}
              />
            )}

            {period === "week" && (
              <WeekTracker
                weekDays={weekDays}
                categories={categories}
                eventsByDate={eventsByDate}
                onSelectDate={(dateKey) => {
                  setSelectedDate(dateKey);
                  setPeriod("day");
                }}
              />
            )}

            {period === "month" && (
              <MonthCalendar
                viewDate={viewDate}
                selectedDate={selectedDate}
                categories={categories}
                eventsByDate={eventsByDate}
                onSelectDate={(dateKey) => {
                  setSelectedDate(dateKey);
                  setViewDate(parseDateKey(dateKey));
                }}
              />
            )}

            {period === "year" && (
              <YearHeatmap
                categories={categories}
                filter={selectedCategoryFilter}
                onFilter={setSelectedCategoryFilter}
                days={filteredYearDays}
                maxScore={maxYearScore}
              />
            )}
          </div>

          <div className="tracker-day space-y-3">
            {showSpark && (
              <div className={`${trackerPanelClass} animate-fadeIn rounded-2xl p-3 text-center text-sm font-black text-amber-800 dark:text-amber-100`}>
                Первый след дня добавлен
              </div>
            )}
            <DayDetailsPanel
              selectedDate={selectedDate}
              categories={categories}
              events={selectedDayEvents}
              currentUserId={currentUserId}
              editingNames={editingNames}
              onEditingNameChange={(categoryId, name) =>
                setEditingNames((current) => ({ ...current, [categoryId]: name }))
              }
              onSaveCategoryName={saveCategoryName}
              onAdjust={adjustCategory}
              onMoodChange={saveDayMood}
            />
          </div>

          <details className="mobile-disclosure tracker-charts-disclosure">
            <summary>Графики и сводка</summary>
            <div className="tracker-charts">
              <TrackerCharts categories={categories} events={activityEvents} />
            </div>
          </details>
        </section>

        <section className="tracker-support-grid grid gap-3 xl:grid-cols-2">
          <details className="mobile-disclosure">
            <summary>Цели пары</summary>
            <PairGoalsPanel
              goals={goals}
              categories={categories}
              events={activityEvents}
              currentUserId={currentUserId}
              selectedCategoryId={goalCategoryId}
              period={goalPeriod}
              targetCount={goalTargetCount}
              onCategoryChange={setGoalCategoryId}
              onPeriodChange={setGoalPeriod}
              onTargetCountChange={setGoalTargetCount}
              onCreate={createGoal}
              onDelete={deleteGoal}
              onReload={reloadGoals}
            />
          </details>
          <details className="mobile-disclosure">
            <summary>История отметок</summary>
            <ActivityHistory
              events={activityEvents}
              categories={categories}
              currentUserId={currentUserId}
              onReload={reloadEvents}
            />
          </details>
        </section>
      </div>
    </main>
  );
}

function PairGoalsPanel({
  goals,
  categories,
  events,
  currentUserId,
  selectedCategoryId,
  period,
  targetCount,
  onCategoryChange,
  onPeriodChange,
  onTargetCountChange,
  onCreate,
  onDelete,
  onReload,
}: {
  goals: TrackerGoal[];
  categories: TrackerCategory[];
  events: TrackerEvent[];
  currentUserId: string;
  selectedCategoryId: string;
  period: GoalPeriod;
  targetCount: number;
  onCategoryChange: (categoryId: string) => void;
  onPeriodChange: (period: GoalPeriod) => void;
  onTargetCountChange: (value: number) => void;
  onCreate: () => void;
  onDelete: (goalId: string) => void;
  onReload: () => void;
}) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  return (
    <section className={`${trackerPanelClass} pair-goals-panel rounded-[1.35rem] p-4 sm:p-5`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700/70 dark:text-amber-100/70">
            Цели пары
          </p>
          <h2 className="mt-1 text-xl font-black">Ваши цели</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReload}
            className="grid h-9 w-9 place-items-center rounded-full border border-amber-900/10 bg-white/45 text-[#713f12]/60 transition hover:bg-amber-100 hover:text-[#a16207] dark:border-amber-100/10 dark:bg-white/[0.05] dark:text-amber-100/60"
            aria-label="Обновить цели"
            title="Обновить цели"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setIsFormOpen((current) => !current)}
            className="grid h-9 w-9 place-items-center rounded-full bg-[#ca8a04] text-white shadow-sm"
            aria-label={isFormOpen ? "Закрыть добавление цели" : "Добавить цель"}
            aria-expanded={isFormOpen}
            title={isFormOpen ? "Закрыть" : "Добавить цель"}
          >
            <Plus className={`h-4 w-4 transition ${isFormOpen ? "rotate-45" : ""}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      {isFormOpen && <form
        className="pair-goal-form mt-4 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          onCreate();
          setIsFormOpen(false);
        }}
      >
        <div className="flex gap-2">
          <select
            value={selectedCategoryId}
            onChange={(event) => onCategoryChange(event.target.value)}
            className="min-w-0 flex-1 rounded-2xl border border-white/45 bg-white/70 px-4 py-3 text-sm font-black outline-none transition focus:shadow-[0_0_0_4px_rgba(202,138,4,0.14)] dark:border-white/10 dark:bg-white/10"
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!selectedCategoryId || targetCount < 1}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#ca8a04] text-white shadow-sm transition hover:bg-[#b77905] disabled:cursor-not-allowed disabled:opacity-45"
            aria-label="Добавить цель"
            title="Добавить цель"
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
          <select
            value={period}
            onChange={(event) => onPeriodChange(event.target.value as GoalPeriod)}
            className="rounded-2xl border border-white/45 bg-white/70 px-4 py-3 text-sm font-black outline-none transition focus:shadow-[0_0_0_4px_rgba(202,138,4,0.14)] dark:border-white/10 dark:bg-white/10"
          >
            {goalPeriods.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            max={999}
            value={targetCount}
            onChange={(event) => onTargetCountChange(Math.max(1, Number(event.target.value || 1)))}
            className="rounded-2xl border border-white/45 bg-white/70 px-4 py-3 text-sm font-black outline-none transition focus:shadow-[0_0_0_4px_rgba(202,138,4,0.14)] dark:border-white/10 dark:bg-white/10"
            aria-label="Количество"
          />
        </div>
      </form>}

      <div className="pair-goals-list mt-4 space-y-2">
        {goals.length === 0 ? (
          <button type="button" onClick={() => setIsFormOpen(true)} className="flex w-full items-center gap-3 rounded-xl border border-dashed border-amber-700/25 bg-amber-50/45 p-3 text-left dark:border-amber-100/15 dark:bg-amber-300/5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-100 text-[#a16207] dark:bg-amber-300/10 dark:text-amber-200"><Plus aria-hidden="true" size={17} /></span>
            <span><strong className="block text-sm">Добавьте первую цель</strong><small className="opacity-55">Выберите действие и желаемый результат</small></span>
          </button>
        ) : (
          goals.map((goal) => {
            const isMine = goal.created_by === currentUserId;
            const category = categories.find((item) => item.id === goal.category_id);
            const goalRange = getGoalDateRange(goal.period || "week");
            const progress = countOnly(
              events.filter(
                (event) =>
                  event.category_id === goal.category_id &&
                  event.date >= goalRange.from &&
                  event.date <= goalRange.to
              )
            );
            const target = goal.target_count || 1;
            const percent = Math.min(100, Math.round((progress / target) * 100));
            const isCompleted = progress >= target;

            return (
              <div key={goal.id} className="pair-goal-card rounded-xl bg-white/58 p-3 shadow-inner dark:bg-white/8">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 break-words font-black">
                      {category ? <><CategoryIcon category={category} size={16} /> {category.name}</> : goal.title}
                    </p>
                    <p className="mt-1 text-sm font-black text-[#ca8a04] dark:text-amber-100">
                      Условие: {goal.target_count || 1} {goalPeriods.find((item) => item.key === goal.period)?.label || "за неделю"}
                    </p>
                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between gap-3 text-xs font-black uppercase tracking-wide text-[#713f12]/55 dark:text-white/45">
                        <span>Прогресс</span>
                        <span className={isCompleted ? "text-[#65a30d] dark:text-lime-200" : ""}>
                          {progress}/{target}
                        </span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-white/65 shadow-inner dark:bg-white/10">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isCompleted
                              ? "bg-gradient-to-r from-[#84cc16] to-[#bef264]"
                              : "bg-gradient-to-r from-[#ca8a04] to-[#facc15]"
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                    <p className="mt-1 text-xs font-black uppercase tracking-wide text-[#713f12]/50 dark:text-white/45">
                      Автор: {isMine ? "вы" : "партнёр"}
                    </p>
                  </div>
                  {isMine && (
                    <button
                      type="button"
                      onClick={() => onDelete(goal.id)}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#713f12]/8 text-[#713f12]/55 transition hover:bg-rose-100 hover:text-rose-700 dark:bg-white/[0.06] dark:text-amber-100/55 dark:hover:bg-rose-500/12 dark:hover:text-rose-200"
                      aria-label="Удалить цель"
                      title="Удалить цель"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function TrackerHeader({
  total,
  activeDays,
  streak,
}: {
  total: number;
  activeDays: number;
  streak: number;
}) {
  return (
    <header className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
      <div>
        <div className="flex items-center gap-2 text-sm font-black text-[#ca8a04] dark:text-amber-300">
          <Heart className="h-4 w-4" aria-hidden="true" />
          <span>Трекер пары</span>
        </div>
        <h1 className="mt-2 text-3xl font-black tracking-normal text-[#713f12] dark:text-amber-50 sm:text-4xl lg:text-5xl">
            Календарь ваших дней
        </h1>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#713f12]/65 dark:text-amber-100/60 sm:text-base">
          Отмечайте ваши общие занятия день за днём, без давления и лишнего шума.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="Краткая статистика">
        {[
          [total, "отметок"],
          [activeDays, "активных дней"],
          [`${streak} дн.`, "серия"],
        ].map(([value, label]) => (
          <div key={label} className={`${trackerPanelClass} min-w-0 rounded-2xl px-2 py-3 text-center sm:min-w-28 sm:px-4 sm:py-4`}>
            <p className="truncate text-xl font-black tabular-nums text-[#a16207] dark:text-amber-300 sm:text-2xl">{value}</p>
            <p className="mt-1 text-[10px] font-bold leading-tight text-[#713f12]/55 dark:text-amber-100/50 sm:text-xs">{label}</p>
          </div>
        ))}
      </div>
    </header>
  );
}

function DateNavigator({
  period,
  viewDate,
  selectedDate,
  onShift,
}: {
  period: Period;
  viewDate: Date;
  selectedDate: string;
  onShift: (direction: -1 | 1) => void;
}) {
  const label = period === "day"
    ? formatDate(selectedDate)
    : period === "year"
      ? `${viewDate.getFullYear()} год`
      : monthTitle(viewDate);

  return (
    <div className={`${trackerPanelClass} flex h-14 items-center justify-between rounded-full p-1.5`}>
        <button
          type="button"
          onClick={() => onShift(-1)}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[#713f12]/70 transition hover:bg-amber-100/75 hover:text-[#a16207] active:scale-95 dark:text-amber-100/70 dark:hover:bg-amber-300/10"
          aria-label="Предыдущий период"
          title="Предыдущий период"
        >
          <ArrowLeft aria-hidden="true" size={18} />
        </button>
        <div className="flex min-w-0 items-center justify-center gap-2 px-2 font-black capitalize">
          <CalendarDays className="h-4 w-4 shrink-0 text-[#ca8a04]" aria-hidden="true" />
          <span className="truncate text-sm sm:text-base">{label}</span>
        </div>
        <button
          type="button"
          onClick={() => onShift(1)}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[#713f12]/70 transition hover:bg-amber-100/75 hover:text-[#a16207] active:scale-95 dark:text-amber-100/70 dark:hover:bg-amber-300/10"
          aria-label="Следующий период"
          title="Следующий период"
        >
          <ArrowRight aria-hidden="true" size={18} />
        </button>
      </div>
  );
}

function PeriodTabs({ period, onChange }: { period: Period; onChange: (period: Period) => void }) {
  return (
    <div className={`${trackerPanelClass} grid h-14 grid-cols-4 gap-1 rounded-full p-1.5`} role="tablist" aria-label="Период трекера">
      {periodTabs.map((tab) => (
        <button
          type="button"
          role="tab"
          aria-selected={period === tab.key}
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`rounded-full px-1 text-xs font-black transition sm:px-3 sm:text-sm ${
            period === tab.key
              ? "bg-[#ca8a04] text-white shadow-[0_10px_24px_rgba(202,138,4,0.26)]"
              : "text-[#713f12]/62 hover:bg-amber-100/65 hover:text-[#a16207] dark:text-amber-100/65 dark:hover:bg-amber-300/10"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function TrackerStatsCards({
  monthEvents,
  allEvents,
  categories,
  selectedDate,
}: {
  monthEvents: TrackerEvent[];
  allEvents: TrackerEvent[];
  categories: TrackerCategory[];
  selectedDate: Date;
}) {
  const cards = [
    ["Активных дней", new Set(monthEvents.map((event) => event.date)).size],
    ["Частая активность", getMostFrequent(monthEvents, categories)],
    ["Лучший день", getBestDay(monthEvents)],
    ["Сравнение", compareWithPreviousMonth(allEvents, selectedDate)],
  ];

  return (
    <section className={`${trackerPanelClass} grid grid-cols-2 overflow-hidden rounded-[1.35rem] p-2 sm:p-3 lg:grid-cols-4`}>
      {cards.map(([label, value]) => (
        <div
          key={label}
          className="tracker-summary-item min-h-20 border-amber-900/10 px-3 py-3 text-center sm:px-4"
        >
          <p className="text-lg font-black leading-tight text-[#a16207] dark:text-amber-300 sm:text-xl">{value}</p>
          <p className="mt-1 text-[10px] font-bold leading-tight text-[#713f12]/55 dark:text-amber-100/50 sm:text-xs">{label}</p>
        </div>
      ))}
    </section>
  );
}

function MonthCalendar({
  viewDate,
  selectedDate,
  categories,
  eventsByDate,
  onSelectDate,
}: {
  viewDate: Date;
  selectedDate: string;
  categories: TrackerCategory[];
  eventsByDate: Record<string, TrackerEvent[]>;
  onSelectDate: (date: string) => void;
}) {
  const today = toDateKey(new Date());
  const days = getCalendarDays(viewDate);

  return (
    <section className={`${trackerPanelClass} animate-fadeIn rounded-[1.35rem] p-3 sm:p-5`}>
      <h2 className="mb-4 text-lg font-black capitalize sm:text-xl">{monthTitle(viewDate)}</h2>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase text-[#713f12]/45 dark:text-amber-100/40 sm:gap-2 sm:text-xs">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-2">
        {days.map((date) => {
          const dateKey = toDateKey(date);
          const dayEvents = eventsByDate[dateKey] || [];
          const activeCategories = categories.filter((category) => countOnly(dayEvents, category.id) > 0);
          const dayMood = getDayMood(dayEvents);
          const isCurrentMonth = date.getMonth() === viewDate.getMonth();
          const isSelected = selectedDate === dateKey;
          const isToday = today === dateKey;
          return (
            <button
              type="button"
              key={dateKey}
              onClick={() => onSelectDate(dateKey)}
              aria-label={`${formatDate(dateKey)}, ${sumEvents(dayEvents)} отметок${dayMood ? `, ${dayMood.label}` : ", эмодзи дня не выбрано"}`}
              className={`group flex h-12 min-w-0 flex-col items-center justify-between rounded-lg border px-1 py-1.5 text-center transition sm:h-16 sm:rounded-xl sm:p-2 lg:h-20 ${
                isSelected
                  ? "border-[#ca8a04] bg-amber-100/82 shadow-[inset_0_0_0_1px_rgba(202,138,4,0.22),0_8px_20px_rgba(202,138,4,0.12)] dark:bg-amber-300/12"
                  : "border-amber-900/10 bg-white/36 hover:border-amber-600/35 hover:bg-amber-50/75 dark:border-amber-100/8 dark:bg-white/[0.035] dark:hover:bg-amber-300/8"
              } ${isCurrentMonth ? "" : "opacity-35"}`}
            >
              <span className="tracker-calendar-date-row flex w-full items-center justify-center gap-1">
                <span className={`text-xs font-black sm:text-sm ${isToday ? "text-[#ca8a04]" : ""}`}>{date.getDate()}</span>
                {dayMood ? (
                  <span className="tracker-calendar-mood" title={dayMood.label}>{dayMood.icon}</span>
                ) : (
                  <span className="tracker-calendar-mood-empty" title="Добавить эмодзи дня">
                    <CirclePlus aria-hidden="true" size={11} />
                  </span>
                )}
              </span>
              <div className="flex h-2 items-center justify-center gap-0.5 sm:gap-1">
                {activeCategories.slice(0, 4).map((category) => (
                  <span
                    key={category.id}
                    className="h-1.5 w-1.5 rounded-full sm:h-2 sm:w-2"
                    style={{ backgroundColor: getCategoryColor(category) }}
                    title={`${category.name}: ${countOnly(dayEvents, category.id)}`}
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function WeekTracker({
  weekDays,
  categories,
  eventsByDate,
  onSelectDate,
}: {
  weekDays: Date[];
  categories: TrackerCategory[];
  eventsByDate: Record<string, TrackerEvent[]>;
  onSelectDate: (dateKey: string) => void;
}) {
  return (
    <section className={`${trackerPanelClass} animate-fadeIn rounded-[1.35rem] p-4 sm:p-5`}>
      <h2 className="text-xl font-black">Неделя</h2>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {weekDays.map((date) => {
          const dateKey = toDateKey(date);
          const dayEvents = eventsByDate[dateKey] || [];
          const total = sumEvents(dayEvents);
          const dayMood = getDayMood(dayEvents);
          return (
            <button
              type="button"
              key={dateKey}
              onClick={() => onSelectDate(dateKey)}
              className="rounded-xl border border-amber-900/10 bg-white/38 p-3 text-left transition hover:border-amber-600/30 hover:bg-amber-50/70 dark:border-amber-100/8 dark:bg-white/[0.035]"
            >
              <p className="text-xs font-black uppercase opacity-45">
                {new Intl.DateTimeFormat("ru-RU", { weekday: "short" }).format(date)}
              </p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="text-lg font-black">{date.getDate()}</p>
                {dayMood ? <span title={dayMood.label}>{dayMood.icon}</span> : <span className="tracker-calendar-mood-empty"><CirclePlus aria-hidden="true" size={12} /></span>}
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white dark:bg-white/10">
                <div className="h-full rounded-full bg-[#ca8a04]" style={{ width: `${Math.min(100, total * 18)}%` }} />
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {categories.map((category) => {
                  const value = countOnly(dayEvents, category.id);
                  return value ? (
                    <span key={category.id} className="text-sm" title={`${category.name}: ${value}`}>
                      <CategoryIcon category={category} size={15} />
                    </span>
                  ) : null;
                })}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function DayOverview({
  selectedDate,
  categories,
  events,
  onAdjust,
}: {
  selectedDate: string;
  categories: TrackerCategory[];
  events: TrackerEvent[];
  onAdjust: (category: TrackerCategory, delta: 1 | -1) => void;
}) {
  return (
    <section className={`${trackerPanelClass} animate-fadeIn rounded-[1.35rem] p-4 sm:p-5`}>
      <h2 className="text-xl font-black">{formatDate(selectedDate)}</h2>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        {categories.map((category) => {
          const value = countOnly(events, category.id);
          return (
            <ActivityCategoryCard
              key={category.id}
              category={category}
              value={value}
              onMinus={() => onAdjust(category, -1)}
              onPlus={() => onAdjust(category, 1)}
            />
          );
        })}
      </div>
    </section>
  );
}

function ActivityCategoryCard({
  category,
  value,
  onMinus,
  onPlus,
}: {
  category: TrackerCategory;
  value: number;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <div className="rounded-xl border border-amber-900/10 bg-white/38 p-3 transition hover:border-amber-600/30 dark:border-amber-100/8 dark:bg-white/[0.035]">
      <div className="flex items-center gap-3">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-xl text-white shadow-sm"
          style={{ backgroundColor: getCategoryColor(category) }}
        >
          <CategoryIcon category={category} />
        </span>
        <div>
          <p className="font-black">{category.name}</p>
          <p className="text-sm font-semibold opacity-55">{value} отметок</p>
        </div>
      </div>
      <div className="mt-3">
        <ActivityCounter value={value} onMinus={onMinus} onPlus={onPlus} color={getCategoryColor(category)} />
      </div>
    </div>
  );
}

function ActivityCounter({
  value,
  onMinus,
  onPlus,
  color,
}: {
  value: number;
  onMinus: () => void;
  onPlus: () => void;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={onMinus}
        disabled={value <= 0}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg font-black text-white shadow-sm transition hover:brightness-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-25 disabled:grayscale-[0.35]"
        style={{ backgroundColor: color }}
        aria-label="Уменьшить"
        title="Уменьшить"
      >
        <Minus className="h-4 w-4" aria-hidden="true" />
      </button>
      <span className="min-w-5 text-center text-xl font-black tabular-nums">{value}</span>
      <button
        type="button"
        onClick={onPlus}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg font-black text-white shadow-sm transition hover:brightness-105 active:scale-95"
        style={{ backgroundColor: color }}
        aria-label="Увеличить"
        title="Увеличить"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function DayDetailsPanel({
  selectedDate,
  categories,
  events,
  currentUserId,
  editingNames,
  onEditingNameChange,
  onSaveCategoryName,
  onAdjust,
  onMoodChange,
}: {
  selectedDate: string;
  categories: TrackerCategory[];
  events: TrackerEvent[];
  currentUserId: string;
  editingNames: Record<string, string>;
  onEditingNameChange: (categoryId: string, name: string) => void;
  onSaveCategoryName: (category: TrackerCategory) => void;
  onAdjust: (category: TrackerCategory, delta: 1 | -1) => void;
  onMoodChange: (mood: Mood) => Promise<void>;
}) {
  const myEvents = events.filter((event) => event.created_by === currentUserId);
  const partnerEvents = events.filter((event) => event.created_by !== currentUserId);
  const activeMood = getDayMood(myEvents);
  const visibleMyEvents = myEvents.filter((event) => event.count > 0);
  const visiblePartnerEvents = partnerEvents.filter((event) => event.count > 0);

  return (
    <aside className={`${trackerPanelClass} animate-zoomIn rounded-[1.35rem] p-4 sm:p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-[#ca8a04] dark:text-amber-300">Выбранный день</p>
          <h2 className="mt-1 text-xl font-black sm:text-2xl">{formatDate(selectedDate)}</h2>
        </div>
        <span className="rounded-full border border-amber-900/10 bg-amber-50/72 px-3 py-1.5 text-[11px] font-black text-[#a16207] dark:border-amber-100/10 dark:bg-amber-300/8 dark:text-amber-200">
          {visibleMyEvents.length} моих · {visiblePartnerEvents.length} партнёра
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {categories.map((category) => {
          const event = myEvents.find((item) => item.category_id === category.id);
          const partnerCategoryEvents = partnerEvents.filter((item) => item.category_id === category.id);

          return (
            <div
              key={category.id}
              className="tracker-action-row grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-amber-900/8 bg-white/34 p-2.5 transition dark:border-amber-100/8 dark:bg-white/[0.035] sm:gap-3 sm:p-3"
            >
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-xl text-white shadow-sm transition hover:scale-105 sm:h-11 sm:w-11"
                style={{ backgroundColor: getCategoryColor(category) }}
                aria-hidden="true"
              >
                <CategoryIcon category={category} />
              </span>
              <div className="min-w-0">
                <input
                  value={editingNames[category.id] || ""}
                  onChange={(input) => onEditingNameChange(category.id, input.target.value)}
                  onBlur={() => onSaveCategoryName(category)}
                  className="w-full truncate rounded-md bg-transparent px-1 py-1 text-sm font-black outline-none transition focus:bg-white/65 focus:px-2 focus:ring-2 focus:ring-amber-500/20 dark:focus:bg-white/[0.06] sm:text-base"
                  aria-label={`Название категории ${category.name}`}
                />
                {partnerCategoryEvents.length > 0 && (
                  <p className="truncate px-1 text-[10px] font-bold text-[#713f12]/48 dark:text-amber-100/45">
                    Партнёр: {countOnly(partnerCategoryEvents)}
                  </p>
                )}
              </div>
              <ActivityCounter
                value={event?.count || 0}
                onMinus={() => onAdjust(category, -1)}
                onPlus={() => onAdjust(category, 1)}
                color={getCategoryColor(category)}
              />
            </div>
          );
        })}
      </div>

      <div className="tracker-day-mood mt-4 border-t border-amber-900/10 pt-4 dark:border-amber-100/10">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm font-black">Эмодзи дня</p>
          <span className="text-xs font-bold opacity-55">{activeMood?.label || "Не выбрано"}</span>
        </div>
        <MoodSelector value={activeMood?.key || null} onChange={(mood) => void onMoodChange(mood)} />
      </div>

      {visiblePartnerEvents.length > 0 && (
        <div className="mt-4 border-t border-amber-900/10 pt-4 dark:border-amber-100/10">
          <p className="text-xs font-black text-[#713f12]/55 dark:text-amber-100/50">Отметки партнёра</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {categories.map((category) => {
              const categoryEvents = visiblePartnerEvents.filter((event) => event.category_id === category.id);
              if (categoryEvents.length === 0) return null;
              return (
                <span
                  key={category.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-900/10 bg-white/45 px-3 py-1.5 text-xs font-black dark:border-amber-100/10 dark:bg-white/[0.05]"
                >
                  <CategoryIcon category={category} size={14} />
                  {category.name}: {countOnly(categoryEvents)}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}

function MoodSelector({ value, onChange }: { value: Mood | null; onChange: (mood: Mood) => void }) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {moods.map((mood) => (
        <button
          type="button"
          key={mood.key}
          onClick={() => onChange(mood.key)}
          className={`grid h-11 place-items-center rounded-xl border text-lg transition ${
            value === mood.key
              ? "border-[#ca8a04] bg-amber-100/82 shadow-[inset_0_0_0_1px_rgba(202,138,4,0.22)] dark:bg-amber-300/12"
              : "border-amber-900/10 bg-white/40 hover:bg-amber-50 dark:border-amber-100/10 dark:bg-white/[0.04]"
          }`}
          aria-label={mood.label}
          aria-pressed={value === mood.key}
          title={mood.label}
        >
          <span aria-hidden="true">{mood.icon}</span>
        </button>
      ))}
    </div>
  );
}

function YearHeatmap({
  categories,
  filter,
  days,
  maxScore,
  onFilter,
}: {
  categories: TrackerCategory[];
  filter: string;
  days: { date: Date; dateKey: string; rows: TrackerEvent[]; score: number }[];
  maxScore: number;
  onFilter: (categoryId: string) => void;
}) {
  return (
    <section className={`${trackerPanelClass} animate-fadeIn rounded-[1.35rem] p-4 sm:p-5`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="text-2xl font-black">Годовая heatmap</h2>
        <div className="flex flex-wrap gap-2">
          {[{ id: "all", name: "Все" }, ...categories.map((category) => ({ id: category.id, name: category.name }))].map((item) => (
            <button
              key={item.id}
              onClick={() => onFilter(item.id)}
              className={`rounded-full px-3 py-2 text-xs font-black transition ${
                filter === item.id ? "bg-[#ca8a04] text-white" : "bg-white/60 dark:bg-white/10"
              }`}
            >
              {item.id !== "all" && <CategoryIcon category={categories.find((category) => category.id === item.id)!} size={14} />} {item.name}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-5 grid grid-cols-[repeat(18,minmax(0,1fr))] gap-1 sm:grid-cols-[repeat(26,minmax(0,1fr))] md:grid-cols-[repeat(53,minmax(0,1fr))]">
        {days.map((day) => {
          const opacity = day.score ? 0.2 + (day.score / maxScore) * 0.8 : 0.08;
          const title = `${formatDate(day.dateKey)} · ${day.score || 0} активностей`;
          return (
            <div
              key={day.dateKey}
              title={title}
              className="anime-heat-cell aspect-square rounded-[0.25rem] transition hover:scale-150 hover:ring-2 hover:ring-white"
              style={{
                backgroundColor: day.score ? `rgba(202,138,4,${opacity})` : "rgba(255,255,255,0.55)",
              }}
            />
          );
        })}
      </div>
    </section>
  );
}

function TrackerCharts({ categories, events }: { categories: TrackerCategory[]; events: TrackerEvent[] }) {
  const weekLabels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const byWeekday = weekLabels.map((label, index) => {
    const value = events
      .filter((event) => {
        const day = parseDateKey(event.date).getDay() || 7;
        return day === index + 1;
      })
      .length;
    return { label, value };
  });
  const byCategory = categories.map((category) => ({
    category,
    value: countOnly(events, category.id),
  }));
  const byMonth = Array.from({ length: 12 }, (_, index) => {
    const value = events.filter((event) => parseDateKey(event.date).getMonth() === index).length;
    return {
      label: new Intl.DateTimeFormat("ru-RU", { month: "short" }).format(
        new Date(new Date().getFullYear(), index, 1)
      ),
      value,
    };
  });
  const max = Math.max(1, ...byWeekday.map((item) => item.value), ...byCategory.map((item) => item.value), ...byMonth.map((item) => item.value));

  return (
    <section className={`${trackerPanelClass} rounded-[1.35rem] p-4 sm:p-5`}>
      <h2 className="text-xl font-black">Графики и сводка</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <BarChart title="По дням недели" items={byWeekday} max={max} />
        <div className="rounded-xl border border-amber-900/8 bg-white/34 p-3 dark:border-amber-100/8 dark:bg-white/[0.035]">
          <p className="font-black">По категориям</p>
          <div className="mt-4 space-y-3">
            {byCategory.map(({ category, value }) => (
              <div key={category.id}>
                <div className="mb-1 flex justify-between text-sm font-black">
                  <span className="flex items-center gap-2"><CategoryIcon category={category} size={14} /> {category.name}</span>
                  <span>{value}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-white dark:bg-white/10">
                  <div className="h-full rounded-full" style={{ width: `${(value / max) * 100}%`, backgroundColor: getCategoryColor(category) }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <BarChart title="По месяцам" items={byMonth} max={max} compact />
      </div>
    </section>
  );
}

function BarChart({
  title,
  items,
  max,
  compact = false,
}: {
  title: string;
  items: { label: string; value: number }[];
  max: number;
  compact?: boolean;
}) {
  return (
    <div className="rounded-xl border border-amber-900/8 bg-white/34 p-3 dark:border-amber-100/8 dark:bg-white/[0.035]">
      <p className="font-black">{title}</p>
      <div className={`mt-4 flex items-end ${compact ? "h-32 gap-1" : "h-40 gap-2"}`}>
        {items.map((item) => (
          <div key={item.label} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2 text-center">
            <div
              className="mx-auto w-full rounded-t-xl bg-gradient-to-t from-[#ca8a04] to-[#facc15] transition-all"
              style={{ height: `${Math.max(6, (item.value / max) * 100)}%` }}
              title={`${item.label}: ${item.value}`}
            />
            <span className="truncate text-[10px] font-black opacity-55" title={item.label}>
              {compact ? item.label.slice(0, 1) : item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityHistory({
  events,
  categories,
  currentUserId,
  onReload,
}: {
  events: TrackerEvent[];
  categories: TrackerCategory[];
  currentUserId: string;
  onReload: () => void;
}) {
  const recent = events.slice(0, 8);
  return (
    <section className={`${trackerPanelClass} rounded-[1.35rem] p-4 sm:p-5`}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black">История отметок</h2>
        <button
          type="button"
          onClick={onReload}
          className="grid h-9 w-9 place-items-center rounded-full border border-amber-900/10 bg-white/45 text-[#713f12]/60 transition hover:bg-amber-100 hover:text-[#a16207] dark:border-amber-100/10 dark:bg-white/[0.05] dark:text-amber-100/60"
          aria-label="Обновить историю"
          title="Обновить историю"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="tracker-history-list mt-3 grid grid-cols-2 gap-2 rounded-xl">
        {recent.length === 0 ? (
          <div className="rounded-2xl bg-white/55 p-4 text-sm font-bold opacity-60 dark:bg-white/8">
            История появится после первой отметки.
          </div>
        ) : (
          recent.map((event) => {
            const category = categories.find((item) => item.id === event.category_id);
            const isMine = event.created_by === currentUserId;
            const visibleNote = getVisibleEventNote(event);
            return (
              <div key={event.id} className="tracker-history-row flex min-w-0 items-center gap-2 rounded-xl border border-amber-900/8 bg-white/42 px-2.5 py-2 dark:border-amber-100/8 dark:bg-white/[0.04]">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white" style={{ backgroundColor: category ? getCategoryColor(category) : "#ca8a04" }}>
                  {category ? <CategoryIcon category={category} size={15} /> : <Heart aria-hidden="true" size={15} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-black">{category?.name || "Активность"}</p>
                    <span className="text-[10px] font-black uppercase opacity-40">{isMine ? "вы" : "партнёр"}</span>
                  </div>
                  {visibleNote && <p className="truncate text-xs font-semibold opacity-58">{visibleNote}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-black">×{event.count}</p>
                  <p className="text-[10px] font-bold opacity-42">{formatShortDate(parseDateKey(event.date))}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
