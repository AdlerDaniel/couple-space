"use client";

import EmptyState from "@/components/EmptyState";
import { createPartnerNotification } from "@/lib/notifications";
import { supabase } from "@/lib/supabaseClient";
import { trackerCategoryColors, trackerDefaultCategories } from "@/lib/trackerCategories";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

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
  { key: "great", label: "отлично", icon: "😍" },
  { key: "good", label: "хорошо", icon: "😊" },
  { key: "normal", label: "нормально", icon: "🙂" },
  { key: "tired", label: "устали", icon: "😴" },
  { key: "bad", label: "плохо", icon: "😔" },
];

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
  return best && best.value > 0 ? `${best.category.icon} ${best.category.name}` : "пока нет";
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
    return events.filter((event) => {
      const date = parseDateKey(event.date);
      return date >= start && date <= end;
    });
  }, [events, viewDate]);
  const weekDays = useMemo(() => getWeekDays(parseDateKey(selectedDate)), [selectedDate]);
  const eventsByDate = useMemo(() => groupByDate(events), [events]);
  const selectedRange = useMemo(() => getDateRange(parseDateKey(selectedDate), period), [period, selectedDate]);
  const rangeEvents = useMemo(
    () => events.filter((event) => event.date >= selectedRange.from && event.date <= selectedRange.to),
    [events, selectedRange]
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

    if (nextCount === 0) {
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

  async function updateEvent(eventId: string, patch: Partial<TrackerEvent>) {
    if (!currentUserId) return;

    const { data, error } = await supabase
      .from("tracker_events")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", eventId)
      .eq("created_by", currentUserId)
      .select("*")
      .single<TrackerEvent>();

    if (!error && data) {
      setEvents((current) => current.map((event) => (event.id === data.id ? data : event)));
    } else {
      setMessage(error?.message || "Не удалось сохранить изменения.");
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
    <main className="tracker-theme min-h-screen overflow-hidden bg-gradient-to-br from-[#fffbeb] via-[#fefce8] to-[#fef9c3] px-4 pb-28 pt-24 text-[#713f12] dark:from-[#171204] dark:via-[#111006] dark:to-black dark:text-white md:px-6 md:pt-28">
      <div className="pointer-events-none fixed inset-0 opacity-70">
        <div className="absolute left-[-8%] top-20 h-72 w-72 rounded-full bg-[#facc15]/20 blur-3xl" />
        <div className="absolute right-[-6%] top-48 h-80 w-80 rounded-full bg-[#fde047]/18 blur-3xl" />
        <div className="absolute bottom-20 left-1/3 h-72 w-72 rounded-full bg-[#ca8a04]/14 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl space-y-6">
        <TrackerHeader
          period={period}
          viewDate={viewDate}
          selectedDate={selectedDate}
          onShift={shiftView}
          total={sumEvents(rangeEvents)}
          streak={getStreak(events)}
        />

        {message && (
          <div className="rounded-3xl border border-white/45 bg-white/70 px-5 py-4 text-center font-black shadow-lg backdrop-blur dark:border-white/10 dark:bg-white/10">
            {message}
          </div>
        )}

        <PeriodTabs period={period} onChange={setPeriod} />

        <TrackerStatsCards
          monthEvents={monthEvents}
          allEvents={events}
          categories={categories}
          selectedDate={viewDate}
        />

        <section className="grid gap-6 lg:grid-cols-[1.35fr_0.9fr]">
          <div className="space-y-6">
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

            <TrackerCharts categories={categories} events={events} />
          </div>

          <div className="space-y-6">
            {showSpark && (
              <div className="animate-fadeIn rounded-[1.5rem] border border-amber-200 bg-amber-50/90 p-4 text-center font-black text-amber-800 shadow-[0_18px_60px_rgba(202,138,4,0.18)] dark:border-white/10 dark:bg-white/10 dark:text-white">
                ✨ Первый след дня добавлен
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
              onUpdate={updateEvent}
            />

            <ActivityHistory
              events={events}
              categories={categories}
              currentUserId={currentUserId}
              onReload={reloadEvents}
            />

            <PairGoalsPanel
              goals={goals}
              categories={categories}
              events={events}
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
          </div>
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
  return (
    <section className="rounded-[2rem] border border-white/45 bg-white/68 p-5 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-white/8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700/70 dark:text-amber-100/70">
            Цели пары
          </p>
          <h2 className="mt-1 text-xl font-black">Ваши цели</h2>
        </div>
        <button
          type="button"
          onClick={onReload}
          className="rounded-full bg-white/70 px-3 py-1.5 text-xs font-black shadow transition hover:-translate-y-0.5 dark:bg-white/10"
        >
          обновить
        </button>
      </div>

      <form
        className="mt-4 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          onCreate();
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
                {category.icon} {category.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!selectedCategoryId || targetCount < 1}
            className="rounded-2xl bg-[#ca8a04] px-4 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
          >
            +
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
      </form>

      <div className="mt-4 space-y-3">
        {goals.length === 0 ? (
          <EmptyState
            icon="◫"
            title="Целей пока нет"
            text="Выберите категорию, период и количество, чтобы поставить первую цель пары."
            actionHref="/tracker"
            actionLabel="Остаться здесь"
            accent="#ca8a04"
          />
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
              <div key={goal.id} className="rounded-2xl bg-white/58 p-4 shadow-inner dark:bg-white/8">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-black">
                      {category ? `${category.icon} ${category.name}` : goal.title}
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
                      className="shrink-0 rounded-full bg-[#713f12]/10 px-3 py-1.5 text-xs font-black text-[#713f12] transition hover:bg-[#713f12]/16 dark:bg-white/10 dark:text-white"
                    >
                      удалить
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
  period,
  viewDate,
  selectedDate,
  total,
  streak,
  onShift,
}: {
  period: Period;
  viewDate: Date;
  selectedDate: string;
  total: number;
  streak: number;
  onShift: (direction: -1 | 1) => void;
}) {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/45 bg-white/62 p-5 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-white/8 md:p-8">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.24em] text-amber-600/75 dark:text-amber-100/60">
            Couple tracker
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight md:text-6xl">
            Календарь ваших дней
          </h1>
          <p className="mt-3 max-w-2xl text-base font-semibold opacity-68">
            Отмечайте, что сделали вместе: день за днём, без давления и лишнего шума.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            ["Период", period === "day" ? formatDate(selectedDate) : monthTitle(viewDate)],
            ["Отметок", total],
            ["Streak", `${streak} дн.`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-3xl bg-white/60 px-4 py-3 shadow-inner dark:bg-white/10">
              <p className="text-xs font-black uppercase tracking-wide opacity-45">{label}</p>
              <p className="mt-1 text-lg font-black">{value}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-6 flex gap-3">
        <button
          onClick={() => onShift(-1)}
          className="rounded-full bg-white/70 px-4 py-2 font-black shadow-lg transition hover:-translate-y-0.5 dark:bg-white/10"
        >
          <ArrowLeft aria-hidden="true" size={18} />
        </button>
        <button
          onClick={() => onShift(1)}
          className="rounded-full bg-white/70 px-4 py-2 font-black shadow-lg transition hover:-translate-y-0.5 dark:bg-white/10"
        >
          <ArrowRight aria-hidden="true" size={18} />
        </button>
      </div>
    </section>
  );
}

function PeriodTabs({ period, onChange }: { period: Period; onChange: (period: Period) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2 rounded-[1.5rem] border border-white/45 bg-white/55 p-2 shadow-xl backdrop-blur dark:border-white/10 dark:bg-white/8">
      {periodTabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`rounded-2xl px-3 py-3 text-sm font-black transition ${
            period === tab.key
              ? "bg-[#ca8a04] text-white shadow-[0_14px_40px_rgba(202,138,4,0.3)]"
              : "bg-white/55 text-[#713f12]/72 hover:bg-amber-50 dark:bg-white/5 dark:text-white/70 dark:hover:bg-amber-500/15"
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
    ["Всего за месяц", monthEvents.length],
    ["Частая активность", getMostFrequent(monthEvents, categories)],
    ["Лучший день", getBestDay(monthEvents)],
    ["Сравнение", compareWithPreviousMonth(allEvents, selectedDate)],
  ];

  return (
    <section className="grid gap-3 md:grid-cols-4">
      {cards.map(([label, value]) => (
        <div
          key={label}
          className="rounded-[1.5rem] border border-white/45 bg-white/62 p-5 shadow-xl backdrop-blur dark:border-white/10 dark:bg-white/8"
        >
          <p className="text-xs font-black uppercase tracking-wide opacity-45">{label}</p>
          <p className="mt-2 text-2xl font-black">{value}</p>
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
    <section className="animate-fadeIn rounded-[2rem] border border-white/45 bg-white/62 p-4 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-white/8 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-black capitalize">{monthTitle(viewDate)}</h2>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-700 dark:bg-white/10 dark:text-white">
          месяц
        </span>
      </div>
      <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-black uppercase opacity-45">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-2">
        {days.map((date) => {
          const dateKey = toDateKey(date);
          const dayEvents = eventsByDate[dateKey] || [];
          const isCurrentMonth = date.getMonth() === viewDate.getMonth();
          const isSelected = selectedDate === dateKey;
          const isToday = today === dateKey;
          return (
            <button
              key={dateKey}
              onClick={() => onSelectDate(dateKey)}
              className={`group min-h-24 rounded-2xl border p-2 text-left shadow-inner transition hover:-translate-y-0.5 hover:shadow-[0_16px_45px_rgba(202,138,4,0.16)] ${
                isSelected
                  ? "border-[#ca8a04] bg-amber-50 ring-2 ring-[#ca8a04]/20 dark:bg-white/12"
                  : "border-white/50 bg-white/48 dark:border-white/10 dark:bg-white/5"
              } ${isCurrentMonth ? "" : "opacity-38"}`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-sm font-black ${isToday ? "text-[#ca8a04]" : ""}`}>{date.getDate()}</span>
                {dayEvents.length > 0 && (
                  <span className="rounded-full bg-[#ca8a04] px-1.5 py-0.5 text-[10px] font-black text-white">
                    {sumEvents(dayEvents)}
                  </span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {categories.map((category) => {
                  const value = countOnly(dayEvents, category.id);
                  if (!value) return null;
                  return (
                    <span
                      key={category.id}
                      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-black text-white"
                      style={{ backgroundColor: getCategoryColor(category) }}
                    >
                      {category.icon}
                      {value > 1 ? value : ""}
                    </span>
                  );
                })}
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
    <section className="animate-fadeIn rounded-[2rem] border border-white/45 bg-white/62 p-5 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-white/8">
      <h2 className="text-2xl font-black">Неделя</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-7">
        {weekDays.map((date) => {
          const dateKey = toDateKey(date);
          const dayEvents = eventsByDate[dateKey] || [];
          const total = sumEvents(dayEvents);
          return (
            <button
              key={dateKey}
              onClick={() => onSelectDate(dateKey)}
              className="rounded-3xl bg-white/62 p-4 text-left shadow-inner transition hover:-translate-y-0.5 hover:shadow-xl dark:bg-white/8"
            >
              <p className="text-xs font-black uppercase opacity-45">
                {new Intl.DateTimeFormat("ru-RU", { weekday: "short" }).format(date)}
              </p>
              <p className="mt-1 text-lg font-black">{date.getDate()}</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white dark:bg-white/10">
                <div className="h-full rounded-full bg-[#ca8a04]" style={{ width: `${Math.min(100, total * 18)}%` }} />
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {categories.map((category) => {
                  const value = countOnly(dayEvents, category.id);
                  return value ? (
                    <span key={category.id} className="text-sm" title={`${category.name}: ${value}`}>
                      {category.icon}
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
    <section className="animate-fadeIn rounded-[2rem] border border-white/45 bg-white/62 p-5 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-white/8">
      <h2 className="text-2xl font-black">{formatDate(selectedDate)}</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-4">
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
    <div className="rounded-3xl border border-white/45 bg-white/62 p-4 shadow-inner transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-white/8">
      <div className="flex items-center gap-3">
        <span
          className="grid h-12 w-12 place-items-center rounded-2xl text-2xl text-white shadow-lg"
          style={{ backgroundColor: getCategoryColor(category) }}
        >
          {category.icon}
        </span>
        <div>
          <p className="font-black">{category.name}</p>
          <p className="text-sm font-semibold opacity-55">{value} отметок</p>
        </div>
      </div>
      <ActivityCounter value={value} onMinus={onMinus} onPlus={onPlus} color={getCategoryColor(category)} />
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
    <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/60 p-2 shadow-inner dark:bg-white/8">
      <button onClick={onMinus} className="grid h-10 w-10 place-items-center rounded-xl bg-white font-black shadow dark:bg-white/10">
        -
      </button>
      <span className="text-2xl font-black tabular-nums transition-transform">{value}</span>
      <button
        onClick={onPlus}
        className="grid h-10 w-10 place-items-center rounded-xl font-black text-white shadow transition active:scale-95"
        style={{ backgroundColor: color }}
      >
        +
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
  onUpdate,
}: {
  selectedDate: string;
  categories: TrackerCategory[];
  events: TrackerEvent[];
  currentUserId: string;
  editingNames: Record<string, string>;
  onEditingNameChange: (categoryId: string, name: string) => void;
  onSaveCategoryName: (category: TrackerCategory) => void;
  onAdjust: (category: TrackerCategory, delta: 1 | -1) => void;
  onUpdate: (eventId: string, patch: Partial<TrackerEvent>) => void;
}) {
  const myEvents = events.filter((event) => event.created_by === currentUserId);
  const partnerEvents = events.filter((event) => event.created_by !== currentUserId);

  return (
    <aside className="animate-zoomIn rounded-[2rem] border border-white/45 bg-white/72 p-5 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-white/8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-600/70">День</p>
          <h2 className="mt-1 text-2xl font-black">{formatDate(selectedDate)}</h2>
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-700 dark:bg-white/10 dark:text-white">
          {myEvents.length} моих · {partnerEvents.length} партнёра
        </span>
      </div>

      <div className="mt-5 space-y-4">
        {categories.map((category) => {
          const event = myEvents.find((item) => item.category_id === category.id);
          const partnerCategoryEvents = partnerEvents.filter((item) => item.category_id === category.id);

          return (
            <div key={category.id} className="rounded-3xl bg-white/62 p-4 shadow-inner dark:bg-white/8">
              <div className="flex items-center gap-3">
                <span
                  className="grid h-12 w-12 place-items-center rounded-2xl text-2xl text-white shadow-lg"
                  style={{ backgroundColor: getCategoryColor(category) }}
                >
                  {category.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <input
                    value={editingNames[category.id] || ""}
                    onChange={(event) => onEditingNameChange(category.id, event.target.value)}
                    onBlur={() => onSaveCategoryName(category)}
                    className="w-full rounded-xl bg-white/60 px-3 py-2 font-black outline-none transition focus:shadow-[0_0_0_4px_rgba(202,138,4,0.12)] dark:bg-white/10"
                  />
                </div>
              </div>
              <ActivityCounter
                value={event?.count || 0}
                onMinus={() => onAdjust(category, -1)}
                onPlus={() => onAdjust(category, 1)}
                color={getCategoryColor(category)}
              />
              {event && (
                <div className="mt-4 space-y-3">
                  <MoodSelector value={event.mood} onChange={(mood) => onUpdate(event.id, { mood })} />
                  <textarea
                    value={event.note || ""}
                    onChange={(input) => onUpdate(event.id, { note: input.target.value })}
                    rows={3}
                    placeholder="Заметка к дню"
                    className="w-full resize-none rounded-2xl border border-white/45 bg-white/70 p-3 font-semibold outline-none transition focus:shadow-[0_0_0_4px_rgba(202,138,4,0.12)] dark:border-white/10 dark:bg-white/10"
                  />
                </div>
              )}
              {partnerCategoryEvents.length > 0 && (
                <div className="mt-4 rounded-2xl bg-amber-50/70 p-3 text-sm font-bold shadow-inner dark:bg-white/8">
                  <p className="text-xs font-black uppercase tracking-wide opacity-50">Отметки партнёра</p>
                  <div className="mt-2 space-y-2">
                    {partnerCategoryEvents.map((partnerEvent) => {
                      const mood = moods.find((item) => item.key === partnerEvent.mood);
                      return (
                        <div key={partnerEvent.id} className="rounded-xl bg-white/65 px-3 py-2 dark:bg-white/10">
                          <div className="flex items-center justify-between gap-3">
                            <span>
                              {partnerEvent.count} раз
                              {partnerEvent.duration_minutes ? ` · ${partnerEvent.duration_minutes} мин` : ""}
                            </span>
                            <span>
                              {mood?.icon} {mood?.label}
                            </span>
                          </div>
                          {partnerEvent.note && <p className="mt-1 opacity-70">{partnerEvent.note}</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
function MoodSelector({ value, onChange }: { value: Mood; onChange: (mood: Mood) => void }) {
  return (
    <div>
      <p className="mb-2 text-xs font-black uppercase tracking-wide opacity-45">Настроение</p>
      <div className="grid grid-cols-5 gap-2">
        {moods.map((mood) => (
          <button
            key={mood.key}
            onClick={() => onChange(mood.key)}
            className={`rounded-2xl px-2 py-2 text-sm font-black transition ${
              value === mood.key ? "bg-[#ca8a04] text-white shadow-lg" : "bg-white/60 hover:bg-amber-50 dark:bg-white/10 dark:hover:bg-amber-500/15"
            }`}
            title={mood.label}
          >
            <span className="block text-lg">{mood.icon}</span>
          </button>
        ))}
      </div>
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
    <section className="animate-fadeIn rounded-[2rem] border border-white/45 bg-white/62 p-5 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-white/8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="text-2xl font-black">Годовая heatmap</h2>
        <div className="flex flex-wrap gap-2">
          {[{ id: "all", name: "Все", icon: "·" }, ...categories.map((category) => ({ id: category.id, name: category.name, icon: category.icon }))].map((item) => (
            <button
              key={item.id}
              onClick={() => onFilter(item.id)}
              className={`rounded-full px-3 py-2 text-xs font-black transition ${
                filter === item.id ? "bg-[#ca8a04] text-white" : "bg-white/60 dark:bg-white/10"
              }`}
            >
              {item.icon} {item.name}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-5 grid grid-cols-[repeat(26,minmax(0,1fr))] gap-1 md:grid-cols-[repeat(53,minmax(0,1fr))]">
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
    <section className="rounded-[2rem] border border-white/45 bg-white/62 p-5 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-white/8">
      <h2 className="text-2xl font-black">Графики и сводка</h2>
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <BarChart title="По дням недели" items={byWeekday} max={max} />
        <div className="rounded-3xl bg-white/55 p-4 shadow-inner dark:bg-white/8">
          <p className="font-black">По категориям</p>
          <div className="mt-4 space-y-3">
            {byCategory.map(({ category, value }) => (
              <div key={category.id}>
                <div className="mb-1 flex justify-between text-sm font-black">
                  <span>{category.icon} {category.name}</span>
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
    <div className="rounded-3xl bg-white/55 p-4 shadow-inner dark:bg-white/8">
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
    <section className="rounded-[2rem] border border-white/45 bg-white/68 p-5 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-white/8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black">История отметок</h2>
        <button onClick={onReload} className="rounded-full bg-white/70 px-3 py-1.5 text-xs font-black shadow dark:bg-white/10">
          обновить
        </button>
      </div>
      <div className="mt-4 space-y-3">
        {recent.length === 0 ? (
          <div className="rounded-2xl bg-white/55 p-4 text-sm font-bold opacity-60 dark:bg-white/8">
            История появится после первой отметки.
          </div>
        ) : (
          recent.map((event) => {
            const category = categories.find((item) => item.id === event.category_id);
            const mood = moods.find((item) => item.key === event.mood);
            const isMine = event.created_by === currentUserId;
            return (
              <div key={event.id} className="rounded-2xl bg-white/58 p-4 shadow-inner dark:bg-white/8">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-black">
                    {category?.icon} {category?.name || "Активность"}
                  </p>
                  <span className="rounded-full bg-white/70 px-2 py-1 text-xs font-black opacity-70 dark:bg-white/10">
                    {isMine ? "моё" : "партнёр"}
                  </span>
                </div>
                <p className="mt-1 text-xs font-black opacity-45">{formatShortDate(parseDateKey(event.date))}</p>
                <p className="mt-1 text-sm font-semibold opacity-68">
                  {event.count} раз · {event.duration_minutes} мин · {mood?.icon} {mood?.label}
                </p>
                {event.note && <p className="mt-2 text-sm font-semibold">{event.note}</p>}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
