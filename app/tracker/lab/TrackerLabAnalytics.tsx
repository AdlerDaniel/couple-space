"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { BarChart3, CalendarDays, Clock3, Flame, History, Sparkles, Trophy } from "lucide-react";

import {
  getCategoryColor,
  getVisibleEventNote,
  type TrackerCategory,
  type TrackerEvent,
} from "../trackerDomain";
import { addTrackerDays, formatTrackerDate, parseTrackerDateKey, toTrackerDateKey } from "@/lib/trackerPlanDomain";

type Props = {
  events: TrackerEvent[];
  categories: TrackerCategory[];
  selectedDate: string;
  getPersonMeta: (id: string | null) => { name: string; avatar: string | null; initial: string };
  onDateChange: (date: string) => void;
};

function count(rows: TrackerEvent[]) {
  return rows.reduce((total, row) => total + Math.max(0, row.count), 0);
}

function monthKey(value: Date) {
  return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, "0")].join("-");
}

function BarChart({ title, values }: { title: string; values: Array<{ label: string; value: number }> }) {
  const maximum = Math.max(1, ...values.map((item) => item.value));
  return (
    <section className="tracker-lab-chart" aria-label={title}>
      <h3>{title}</h3>
      <div className="tracker-lab-bars">
        {values.map((item) => (
          <div key={item.label} title={`${item.label}: ${item.value}`}>
            <span><i style={{ height: `${item.value ? Math.max(8, item.value / maximum * 100) : 2}%` }} /></span>
            <small>{item.label}</small><b>{item.value || ""}</b>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function TrackerLabAnalytics({
  events, categories, selectedDate, getPersonMeta, onDateChange,
}: Props) {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const heatmapRef = useRef<HTMLDivElement | null>(null);
  const year = parseTrackerDateKey(selectedDate).getFullYear();
  const yearFrom = `${year}-01-01`;
  const yearTo = `${year}-12-31`;
  const activityEvents = useMemo(
    () => events.filter((row) => row.date >= yearFrom && row.date <= yearTo && row.count > 0),
    [events, yearFrom, yearTo],
  );
  const byDate = useMemo(() => {
    const result = new Map<string, TrackerEvent[]>();
    for (const row of activityEvents) result.set(row.date, [...(result.get(row.date) || []), row]);
    return result;
  }, [activityEvents]);
  const days = useMemo(() => {
    const first = parseTrackerDateKey(yearFrom);
    const length = Math.round((parseTrackerDateKey(yearTo).getTime() - first.getTime()) / 86_400_000) + 1;
    return Array.from({ length }, (_, index) => {
      const date = addTrackerDays(first, index);
      const dateKey = toTrackerDateKey(date);
      const rows = (byDate.get(dateKey) || []).filter((row) => categoryFilter === "all" || row.category_id === categoryFilter);
      return { dateKey, value: count(rows) };
    });
  }, [byDate, categoryFilter, yearFrom, yearTo]);
  const maxDay = Math.max(1, ...days.map((day) => day.value));
  const selected = parseTrackerDateKey(selectedDate);
  const currentMonth = monthKey(selected);
  const previousMonthDate = new Date(selected.getFullYear(), selected.getMonth() - 1, 1, 12);
  const previousMonth = monthKey(previousMonthDate);
  const currentCount = count(events.filter((row) => row.date.startsWith(currentMonth)));
  const previousCount = count(events.filter((row) => row.date.startsWith(previousMonth)));
  const comparison = previousCount
    ? `${currentCount >= previousCount ? "+" : ""}${Math.round((currentCount - previousCount) / previousCount * 100)}%`
    : currentCount ? "+100%" : "—";
  const bestDay = [...byDate.entries()].map(([date, rows]) => ({ date, value: count(rows) }))
    .sort((a, b) => b.value - a.value || b.date.localeCompare(a.date))[0];
  const categoriesByCount = categories.map((category) => ({
    category, value: count(activityEvents.filter((row) => row.category_id === category.id)),
  })).sort((a, b) => b.value - a.value);
  const favorite = categoriesByCount[0]?.value ? categoriesByCount[0].category.name : "Пока нет";
  let streak = 0;
  for (let cursor = selectedDate, guard = 0; cursor >= yearFrom && guard < 366; cursor = toTrackerDateKey(addTrackerDays(parseTrackerDateKey(cursor), -1)), guard += 1) {
    if (!byDate.has(cursor)) break;
    streak += 1;
  }
  const weekLabels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const weekdays = weekLabels.map((label, index) => ({
    label,
    value: count(activityEvents.filter((row) => (parseTrackerDateKey(row.date).getDay() || 7) === index + 1)),
  }));
  const months = Array.from({ length: 12 }, (_, index) => {
    const key = `${year}-${String(index + 1).padStart(2, "0")}`;
    const label = new Intl.DateTimeFormat("ru-RU", { month: "short" }).format(new Date(year, index, 1, 12)).replace(".", "");
    return { label, value: count(activityEvents.filter((row) => row.date.startsWith(key))) };
  });
  const history = [...events].filter((row) => row.count > 0 || getVisibleEventNote(row))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.time || "").localeCompare(a.time || "") || b.created_at.localeCompare(a.created_at))
    .slice(0, 16);
  const heatMonths = Array.from({ length: 12 }, (_, index) => {
    const key = `${year}-${String(index + 1).padStart(2, "0")}`;
    const first = new Date(year, index, 1, 12);
    return {
      key,
      label: new Intl.DateTimeFormat("ru-RU", { month: "long" }).format(first),
      offset: (first.getDay() + 6) % 7,
      days: days.filter((day) => day.dateKey.startsWith(key)),
    };
  });

  useEffect(() => {
    if (!window.matchMedia("(max-width: 520px)").matches) return;
    const selectedMonth = heatmapRef.current?.querySelector<HTMLElement>(
      `[data-heat-month="${selectedDate.slice(0, 7)}"]`,
    );
    selectedMonth?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [selectedDate]);

  function handleHeatKeyDown(event: KeyboardEvent<HTMLButtonElement>, dateKey: string) {
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let target = dateKey;
    if (event.key in offsets) target = toTrackerDateKey(addTrackerDays(parseTrackerDateKey(dateKey), offsets[event.key]));
    else if (event.key === "Home") target = yearFrom;
    else if (event.key === "End") target = yearTo;
    else return;
    if (target < yearFrom || target > yearTo) return;
    event.preventDefault();
    onDateChange(target);
  }

  return (
    <div className="tracker-lab-analytics">
      <section className="tracker-lab-analytics-summary" aria-label="Сводка активности">
        <article><CalendarDays /><span><small>Активных дней за год</small><strong>{byDate.size}</strong></span></article>
        <article><Flame /><span><small>Серия до выбранного дня</small><strong>{streak} дн.</strong></span></article>
        <article><Trophy /><span><small>Лучший день года</small><strong>{bestDay ? `${formatTrackerDate(bestDay.date, { day: "numeric", month: "short" })} · ${bestDay.value}` : "Пока нет"}</strong></span></article>
        <article><Sparkles /><span><small>Категория года</small><strong>{favorite}</strong></span></article>
        <article><BarChart3 /><span><small>Месяц к предыдущему</small><strong>{comparison}</strong></span></article>
      </section>

      <section className="tracker-lab-year-heatmap">
        <div className="tracker-lab-section-heading"><div><span>Каждый день</span><h2>Карта {year} года</h2></div><CalendarDays /></div>
        <div className="tracker-lab-analytics-filters" aria-label="Фильтр карты по категориям">
          <button type="button" className={categoryFilter === "all" ? "is-active" : ""} aria-pressed={categoryFilter === "all"} onClick={() => setCategoryFilter("all")}>Все</button>
          {categories.map((category) => <button type="button" key={category.id} className={categoryFilter === category.id ? "is-active" : ""} aria-pressed={categoryFilter === category.id} onClick={() => setCategoryFilter(category.id)}><i style={{ background: getCategoryColor(category) }} />{category.name}</button>)}
        </div>
        <div className="tracker-lab-heat-months" ref={heatmapRef}>
          {heatMonths.map((month) => (
            <section key={month.key} data-heat-month={month.key} className="tracker-lab-heat-month" aria-label={`${month.label} ${year}`}>
              <h3>{month.label}</h3>
              <div className="tracker-lab-heat-weekdays" aria-hidden="true">
                {weekLabels.map((label) => <span key={label}>{label.slice(0, 1)}</span>)}
              </div>
              <div className="tracker-lab-heat-grid">
                {Array.from({ length: month.offset }, (_, index) => <span key={`empty-${index}`} aria-hidden="true" />)}
                {month.days.map((day) => {
                  const level = day.value ? Math.max(1, Math.ceil(day.value / maxDay * 4)) : 0;
                  const label = `${formatTrackerDate(day.dateKey)}: ${day.value} отметок`;
                  const isSelected = day.dateKey === selectedDate;
                  return (
                    <button
                      type="button"
                      key={day.dateKey}
                      data-level={level}
                      data-heat-date={day.dateKey}
                      className={isSelected ? "is-selected" : ""}
                      title={label}
                      aria-label={`Открыть ${label}`}
                      aria-current={isSelected ? "date" : undefined}
                      tabIndex={isSelected ? 0 : -1}
                      onKeyDown={(event) => handleHeatKeyDown(event, day.dateKey)}
                      onClick={() => onDateChange(day.dateKey)}
                    >
                      <span>{Number(day.dateKey.slice(-2))}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        <div className="tracker-lab-heat-legend" aria-hidden="true"><span>Меньше</span>{[0,1,2,3,4].map((level) => <i key={level} data-level={level} />)}<span>Больше</span></div>
      </section>

      <section className="tracker-lab-analytics-charts">
        <div className="tracker-lab-section-heading"><div><span>Ритм</span><h2>Графики и категории</h2></div><BarChart3 /></div>
        <BarChart title="По дням недели" values={weekdays} />
        <BarChart title="По месяцам" values={months} />
        <section className="tracker-lab-category-chart" aria-label="По категориям">
          <h3>По категориям</h3>
          {categoriesByCount.map(({ category, value }) => {
            const maximum = Math.max(1, ...categoriesByCount.map((item) => item.value));
            return <div key={category.id}><span><i style={{ background: getCategoryColor(category) }} />{category.name}</span><b>{value}</b><em><i style={{ width: `${value / maximum * 100}%`, background: getCategoryColor(category) }} /></em></div>;
          })}
        </section>
      </section>

      <section className="tracker-lab-analytics-history">
        <div className="tracker-lab-section-heading"><div><span>События трекера</span><h2>История отметок</h2></div><History /></div>
        {!history.length && <p className="tracker-lab-empty-inline">История появится после первой отметки.</p>}
        <div>
          {history.map((row) => {
            const category = categories.find((item) => item.id === row.category_id);
            const note = getVisibleEventNote(row);
            const person = getPersonMeta(row.created_by);
            return <button type="button" key={row.id} onClick={() => onDateChange(row.date)}>
              <i style={{ background: category ? getCategoryColor(category) : "#d97706" }} />
              <span><strong>{category?.name || "Активность"}{row.count > 0 ? ` · ${row.count}` : ""}</strong><small>{person.name} · {formatTrackerDate(row.date, { day: "numeric", month: "short", year: row.date.slice(0,4) === String(year) ? undefined : "numeric" })}{row.time ? ` · ${row.time.slice(0,5)}` : ""}{row.duration_minutes ? ` · ${row.duration_minutes} мин.` : ""}</small>{note && <p>{note}</p>}</span>
              <Clock3 />
            </button>;
          })}
        </div>
      </section>
    </div>
  );
}
