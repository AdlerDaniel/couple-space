"use client";

import AppSkeleton from "@/components/AppSkeleton";
import EmptyState from "@/components/EmptyState";
import { CountUp } from "@/components/AnimeWidgets";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Couple = {
  id: string;
  partner_one_id: string | null;
  partner_two_id: string | null;
};

type CalendarEvent = {
  id: string;
  date: string;
  title: string;
  type: "memory" | "question" | "tracker" | "watch";
  icon: string;
  href: string;
};

const accent = "#0891b2";

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function monthTitle(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(date);
}

function getMonthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: dateKey(start), end: dateKey(end) };
}

function buildMonthGrid(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const firstWeekday = start.getDay() || 7;
  const gridStart = new Date(start);
  gridStart.setDate(start.getDate() - firstWeekday + 1);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });
}

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  const { start, end } = useMemo(() => getMonthRange(currentMonth), [currentMonth]);
  const days = useMemo(() => buildMonthGrid(currentMonth), [currentMonth]);
  const groupedEvents = useMemo(
    () =>
      events.reduce<Record<string, CalendarEvent[]>>((groups, event) => {
        groups[event.date] = [...(groups[event.date] || []), event];
        return groups;
      }, {}),
    [events],
  );

  useEffect(() => {
    document.title = "Календарь | Couple Space";
    let ignore = false;

    async function loadCalendar() {
      setIsLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!ignore) {
          setCouple(null);
          setEvents([]);
          setIsLoading(false);
        }
        return;
      }

      const { data: coupleData } = await supabase
        .from("couples")
        .select("id, partner_one_id, partner_two_id")
        .or(`partner_one_id.eq.${user.id},partner_two_id.eq.${user.id}`)
        .limit(1)
        .maybeSingle<Couple>();

      if (!coupleData) {
        if (!ignore) {
          setCouple(null);
          setEvents([]);
          setIsLoading(false);
        }
        return;
      }

      const [memoriesResult, answersResult, trackerResult, watchResult] = await Promise.all([
        supabase
          .from("memories")
          .select("id, title, event_date, created_at")
          .eq("couple_id", coupleData.id)
          .gte("event_date", start)
          .lte("event_date", end),
        supabase
          .from("question_answers")
          .select("id, date, question")
          .eq("couple_id", coupleData.id)
          .gte("date", start)
          .lte("date", end),
        supabase
          .from("tracker_events")
          .select("id, date, note, count")
          .eq("couple_id", coupleData.id)
          .gte("date", start)
          .lte("date", end),
        supabase
          .from("watch_items")
          .select("id, title, watched_at, updated_at")
          .eq("couple_id", coupleData.id)
          .not("watched_at", "is", null)
          .gte("watched_at", `${start}T00:00:00`)
          .lte("watched_at", `${end}T23:59:59`),
      ]);

      if (ignore) return;

      const nextEvents: CalendarEvent[] = [
        ...((memoriesResult.data || []) as Array<{ id: string; title: string | null; event_date: string | null; created_at: string }>).map((memory) => ({
          id: `memory-${memory.id}`,
          date: memory.event_date || memory.created_at.slice(0, 10),
          title: memory.title || "Воспоминание",
          type: "memory" as const,
          icon: "▣",
          href: "/memories",
        })),
        ...((answersResult.data || []) as Array<{ id: string; date: string; question: string | null }>).map((answer) => ({
          id: `question-${answer.id}`,
          date: answer.date,
          title: answer.question || "Вопрос дня",
          type: "question" as const,
          icon: "✉",
          href: "/questions/today",
        })),
        ...((trackerResult.data || []) as Array<{ id: string; date: string; note: string | null; count: number | null }>).map((event) => ({
          id: `tracker-${event.id}`,
          date: event.date,
          title: event.note || `${event.count || 1} активность`,
          type: "tracker" as const,
          icon: "◇",
          href: "/tracker",
        })),
        ...((watchResult.data || []) as Array<{ id: string; title: string; watched_at: string | null }>).map((item) => ({
          id: `watch-${item.id}`,
          date: item.watched_at?.slice(0, 10) || start,
          title: item.title,
          type: "watch" as const,
          icon: "▶",
          href: `/watch/${item.id}`,
        })),
      ].sort((first, second) => first.date.localeCompare(second.date));

      setCouple(coupleData);
      setEvents(nextEvents);
      setIsLoading(false);
    }

    loadCalendar();

    return () => {
      ignore = true;
    };
  }, [end, start]);

  function shiftMonth(delta: number) {
    setCurrentMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#ecfeff] px-4 pb-28 pt-24 text-cyan-950 dark:bg-[#061316] dark:text-white md:px-6 md:pt-28">
        <section className="mx-auto max-w-6xl">
          <AppSkeleton rows={5} accent={accent} />
        </section>
      </main>
    );
  }

  if (!couple) {
    return (
      <main className="min-h-screen bg-[#ecfeff] px-4 pb-28 pt-24 text-cyan-950 dark:bg-[#061316] dark:text-white md:px-6 md:pt-28">
        <section className="mx-auto max-w-3xl">
          <EmptyState
            icon="◇"
            title="Календарь появится после создания пары"
            text="Когда появятся вопросы, цели, фильмы и воспоминания, они соберутся здесь по дням."
            actionHref="/profile"
            actionLabel="Открыть профиль"
            accent={accent}
          />
        </section>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen bg-[#ecfeff] px-4 pb-28 pt-24 text-cyan-950 dark:bg-[#061316] dark:text-white md:px-6 md:pt-28"
      style={{ ["--scroll-accent" as string]: accent }}
    >
      <section className="mx-auto max-w-7xl">
        <div className="ui-card p-5 md:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="ui-eyebrow">Календарь пары</p>
              <h1 className="ui-section-title mt-2 text-4xl md:text-5xl">{monthTitle(currentMonth)}</h1>
              <p className="ui-muted mt-3 max-w-2xl leading-7">
                Вопросы, цели, фильмы и воспоминания собраны в один спокойный визуальный ритм.
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => shiftMonth(-1)} className="ui-button-secondary">Назад</button>
              <button type="button" onClick={() => setCurrentMonth(new Date())} className="ui-button-secondary">Сегодня</button>
              <button type="button" onClick={() => shiftMonth(1)} className="ui-button-secondary">Вперёд</button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            {[
              ["Всего событий", events.length],
              ["Вопросов", events.filter((event) => event.type === "question").length],
              ["Воспоминаний", events.filter((event) => event.type === "memory").length],
              ["Просмотров", events.filter((event) => event.type === "watch").length],
            ].map(([label, value]) => (
              <div key={label} className="ui-card-compact p-4 text-center">
                <p className="text-3xl font-black text-cyan-700 dark:text-white">
                  <CountUp value={Number(value)} />
                </p>
                <p className="mt-1 text-xs font-black uppercase opacity-55">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-7 gap-2 text-center text-xs font-black uppercase opacity-55">
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => <div key={day}>{day}</div>)}
        </div>

        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-7">
          {days.map((day) => {
            const key = dateKey(day);
            const dayEvents = groupedEvents[key] || [];
            const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
            const isToday = key === dateKey(new Date());

            return (
              <article
                key={key}
                className={`calendar-day ui-card-compact p-3 ${isCurrentMonth ? "" : "opacity-45"} ${isToday ? "ring-2 ring-cyan-400/60" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-black">{day.getDate()}</span>
                  {dayEvents.length > 0 && (
                    <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-black text-cyan-700 dark:bg-white/10 dark:text-white">
                      {dayEvents.length}
                    </span>
                  )}
                </div>
                <div className="mt-2 space-y-1">
                  {dayEvents.slice(0, 3).map((event) => (
                    <Link
                      key={event.id}
                      href={event.href}
                      className="block truncate rounded-[0.75rem] bg-white/58 px-2 py-1 text-left text-xs font-black shadow-inner dark:bg-white/8"
                      title={event.title}
                    >
                      {event.icon} {event.title}
                    </Link>
                  ))}
                  {dayEvents.length > 3 && (
                    <p className="text-xs font-black opacity-50">+{dayEvents.length - 3} ещё</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
