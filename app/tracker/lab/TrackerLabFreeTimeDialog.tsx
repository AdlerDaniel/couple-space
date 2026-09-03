"use client";

import { useEffect, useState } from "react";
import { Clock3, Lock, RefreshCw, X } from "lucide-react";
import { fetchTrackerFreeSlots } from "@/lib/trackerRepository";
import { formatTrackerClock, formatTrackerDate, getTrackerToday } from "@/lib/trackerPlanDomain";
import TrackerLabDialog from "./TrackerLabDialog";

type Query = { from: string; to: string; duration: number; dayStart: string; dayEnd: string; version: number };
type Slot = { starts_at: string; ends_at: string };

export default function TrackerLabFreeTimeDialog({
  coupleId, date, timeZone, onClose, onChoose,
}: {
  coupleId: string;
  date: string;
  timeZone: string;
  onClose: () => void;
  onChoose: (slot: Slot) => void;
}) {
  const [draft, setDraft] = useState<Query>({ from: date, to: date, duration: 60, dayStart: "09:00", dayEnd: "22:00", version: 0 });
  const [query, setQuery] = useState(draft);
  const [result, setResult] = useState<{ query: Query; slots: Slot[]; error: string | null } | null>(null);
  const [limit, setLimit] = useState(24);
  const loading = result?.query !== query;

  useEffect(() => {
    let ignore = false;
    void fetchTrackerFreeSlots(coupleId, query).then((slots) => {
      if (!ignore) setResult({ query, slots, error: null });
    }).catch((error: unknown) => {
      if (!ignore) setResult({ query, slots: [], error: error instanceof Error ? error.message : "Не удалось найти свободное время." });
    });
    return () => { ignore = true; };
  }, [coupleId, query]);

  function search() {
    setLimit(24);
    setQuery({ ...draft, version: query.version + 1 });
  }

  return (
    <TrackerLabDialog className="tracker-lab-composer-sheet" label="Наше свободное время" onClose={onClose}>
      <button type="button" className="tracker-lab-sheet-close" onClick={onClose} aria-label="Закрыть"><X /></button>
      <p>Наше свободное время</p><h2>Найдём время друг для друга</h2>
      <span className="tracker-lab-privacy-note"><Lock />Приватные планы учитываются как занятость, но их содержание не раскрывается.</span>
      <div className="tracker-lab-form-grid">
        <label><span>Начиная с</span><input type="date" value={draft.from} onChange={(event) => setDraft({ ...draft, from: event.target.value })} /></label>
        <label><span>До даты</span><input type="date" min={draft.from} value={draft.to} onChange={(event) => setDraft({ ...draft, to: event.target.value })} /></label>
        <label><span>Свободны после</span><input type="time" value={draft.dayStart} onChange={(event) => setDraft({ ...draft, dayStart: event.target.value })} /></label>
        <label><span>Свободны до</span><input type="time" value={draft.dayEnd} onChange={(event) => setDraft({ ...draft, dayEnd: event.target.value })} /></label>
        <label className="is-wide"><span>Сколько времени нужно</span><select value={draft.duration} onChange={(event) => setDraft({ ...draft, duration: Number(event.target.value) })}><option value={30}>30 минут</option><option value={60}>1 час</option><option value={90}>1,5 часа</option><option value={120}>2 часа</option><option value={180}>3 часа</option></select></label>
      </div>
      <p className="tracker-lab-form-hint">До 14 дней за один поиск. Часовой пояс пары: {timeZone}.</p>
      <button type="button" className="tracker-lab-primary-button" onClick={search} disabled={loading}><RefreshCw size={18} />{loading ? "Ищем свободные окна…" : "Найти время"}</button>
      {!loading && result?.error && <p role="alert" className="tracker-lab-privacy-note">{result.error}</p>}
      <div className="tracker-lab-free-slots" aria-busy={loading}>
        {!loading && !result?.error && (result?.slots.length ? result.slots.slice(0, limit).map((slot) => (
          <button type="button" key={slot.starts_at} onClick={() => onChoose(slot)}>
            <Clock3 /><strong>{formatTrackerClock(slot.starts_at, timeZone)}–{formatTrackerClock(slot.ends_at, timeZone)}</strong><span>{formatTrackerDate(getTrackerToday(timeZone, new Date(slot.starts_at)), { day: "numeric", month: "short" })}</span>
          </button>
        )) : <div className="tracker-lab-empty"><Clock3 /><strong>Общих окон пока нет</strong><span>Измените даты, время или длительность.</span></div>)}
      </div>
      {!loading && (result?.slots.length || 0) > limit && <button type="button" className="tracker-lab-primary-button" onClick={() => setLimit((value) => value + 24)}>Ещё варианты</button>}
    </TrackerLabDialog>
  );
}
