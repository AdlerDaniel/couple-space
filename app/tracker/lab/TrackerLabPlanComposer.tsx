"use client";

import { CalendarDays, ChevronDown } from "lucide-react";
import type { TrackerPlan, TrackerPlanKind, TrackerPlanRepeat, TrackerParticipantScope } from "@/lib/trackerPlanDomain";

export type TrackerPlanDraft = {
  title: string;
  description: string;
  kind: TrackerPlanKind;
  date: string;
  time: string;
  endTime: string;
  scope: TrackerParticipantScope;
  visibility: "couple" | "private";
  repeat: TrackerPlanRepeat;
  repeatInterval: number;
  repeatWeekdays: number[];
  repeatUntil: string;
  reminder: number;
  status: TrackerPlan["status"];
  editScope: TrackerPlan["edit_scope"];
  assigneeId: string;
};

const kinds = { event: "Событие", date: "Свидание", task: "Задача", reminder: "Важная дата" } as const;
const repeats = { none: "Не повторять", daily: "Каждый день", weekly: "По дням недели", monthly: "Каждый месяц", yearly: "Каждый год" } as const;
const statuses = { idea: "Идея", tentative: "Обсуждаем", planned: "Запланировано", done: "Завершено", cancelled: "Отменено" } as const;

export default function TrackerLabPlanComposer({
  value, onChange, onSubmit, saving, editing, ownsPlan, timeZone, people,
}: {
  value: TrackerPlanDraft;
  onChange: (patch: Partial<TrackerPlanDraft>) => void;
  onSubmit: () => void;
  saving: boolean;
  editing: boolean;
  ownsPlan: boolean;
  timeZone: string;
  people: Array<{ id: string; label: string }>;
}) {
  return (
    <>
      <p>{editing ? "Редактирование серии" : "Новый план"}</p>
      <h2>{editing ? "Изменить весь план" : "Добавить в календарь"}</h2>
      <div className="tracker-lab-form-grid">
        <label className="is-wide"><span>Название</span><input value={value.title} onChange={(event) => onChange({ title: event.target.value })} maxLength={120} placeholder="Например, вечерняя прогулка" autoFocus /></label>
        <label><span>Тип</span><select value={value.kind} onChange={(event) => onChange({ kind: event.target.value as TrackerPlanKind })}>{Object.entries(kinds).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label><span>Дата</span><input type="date" required value={value.date} onChange={(event) => onChange({ date: event.target.value })} /></label>
        <label><span>Начало</span><input type="time" value={value.time} onChange={(event) => onChange({ time: event.target.value })} /></label>
        <label><span>Конец</span><input type="time" value={value.endTime} onChange={(event) => onChange({ endTime: event.target.value })} disabled={!value.time} /></label>
        <label className="is-wide"><span>Описание</span><textarea value={value.description} onChange={(event) => onChange({ description: event.target.value })} maxLength={10000} placeholder="Детали, адрес или небольшая заметка" rows={3} /></label>
      </div>
      <p className="tracker-lab-form-hint"><CalendarDays size={15} />{value.time ? "Если конец не указан — длительность 1 час." : "Без времени — событие на весь день."} Часовой пояс: {timeZone}.</p>
      <details className="tracker-lab-advanced" open={editing || undefined}>
        <summary>Дополнительные параметры<ChevronDown size={18} /></summary>
        <div className="tracker-lab-form-grid">
          <label><span>Для кого</span><select value={value.scope} onChange={(event) => onChange({ scope: event.target.value as TrackerParticipantScope })} disabled={!ownsPlan || value.visibility === "private"}><option value="both">Для нас двоих</option><option value="me">{ownsPlan ? "Для меня" : "Для автора плана"}</option><option value="partner">{ownsPlan ? "Для партнёра" : "Для партнёра автора"}</option></select></label>
          <label><span>Видимость</span><select value={value.visibility} onChange={(event) => onChange({ visibility: event.target.value as "couple" | "private" })} disabled={!ownsPlan}><option value="couple">Общее</option><option value="private">Только мне</option></select></label>
          <label><span>Ответственный</span><select value={value.assigneeId} onChange={(event) => onChange({ assigneeId: event.target.value })} disabled={!ownsPlan || value.visibility === "private"}><option value="">Без ответственного</option>{people.map((person) => <option key={person.id} value={person.id}>{person.label}</option>)}</select></label>
          <label><span>Кто редактирует</span><select value={value.editScope} onChange={(event) => onChange({ editScope: event.target.value as TrackerPlan["edit_scope"] })} disabled={!ownsPlan}><option value="participants">Принявшие приглашение</option><option value="creator">Только автор</option></select></label>
          <label><span>Статус{editing ? " всей серии" : ""}</span><select value={value.status} onChange={(event) => onChange({ status: event.target.value as TrackerPlan["status"] })}>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label><span>Повторение</span><select value={value.repeat} onChange={(event) => onChange({ repeat: event.target.value as TrackerPlanRepeat })}>{Object.entries(repeats).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          {value.repeat !== "none" && <>
            <label><span>Интервал повторения</span><input type="number" min={1} max={365} value={value.repeatInterval} onChange={(event) => onChange({ repeatInterval: Number(event.target.value) })} /></label>
            <label><span>Повторять до</span><input type="date" min={value.date} value={value.repeatUntil} onChange={(event) => onChange({ repeatUntil: event.target.value })} /></label>
          </>}
          {value.repeat === "weekly" && <fieldset className="tracker-lab-weekday-picker is-wide"><legend>Дни недели</legend>{["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day, index) => <button type="button" key={day} aria-pressed={value.repeatWeekdays.includes(index + 1)} onClick={() => onChange({ repeatWeekdays: value.repeatWeekdays.includes(index + 1) ? value.repeatWeekdays.filter((item) => item !== index + 1) : [...value.repeatWeekdays, index + 1].sort() })}>{day}</button>)}</fieldset>}
          <label className="is-wide"><span>Моё напоминание в календаре</span><select value={value.reminder} onChange={(event) => onChange({ reminder: Number(event.target.value) })}><option value={0}>В момент события</option><option value={30}>За 30 минут</option><option value={60}>За час</option><option value={1440}>За день</option><option value={10080}>За неделю</option></select></label>
        </div>
        <p className="tracker-lab-form-hint">Точное напоминание включится после «Добавить в календарь». На сайте — ежедневный дайджест.</p>
      </details>
      <button type="button" className="tracker-lab-primary-button" disabled={saving || !value.title.trim() || !value.date || (value.repeat === "weekly" && !value.repeatWeekdays.length) || !Number.isInteger(value.repeatInterval) || value.repeatInterval < 1 || value.repeatInterval > 365} onClick={onSubmit}>{saving ? "Сохраняем…" : editing ? "Сохранить всю серию" : "Добавить в календарь"}</button>
    </>
  );
}
