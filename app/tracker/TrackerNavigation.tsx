"use client";

import { ArrowLeft, ArrowRight, CalendarDays } from "lucide-react";

export type TrackerPeriod = "day" | "week" | "month" | "year";

const panelClass =
  "border border-amber-900/12 bg-white/64 shadow-[0_20px_55px_rgba(146,64,14,0.09)] backdrop-blur-xl dark:border-amber-200/10 dark:bg-[#211a0c]/78 dark:shadow-[0_24px_70px_rgba(0,0,0,0.26)]";

const tabs: { key: TrackerPeriod; label: string }[] = [
  { key: "day", label: "День" },
  { key: "week", label: "Неделя" },
  { key: "month", label: "Месяц" },
  { key: "year", label: "Год" },
];

export function TrackerNavigation({
  period,
  label,
  onShift,
  onChange,
}: {
  period: TrackerPeriod;
  label: string;
  onShift: (direction: -1 | 1) => void;
  onChange: (period: TrackerPeriod) => void;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(17rem,0.68fr)_minmax(32rem,1fr)] lg:items-center">
      <div className={`${panelClass} flex h-14 items-center justify-between rounded-full p-1.5`}>
        <button
          type="button"
          onClick={() => onShift(-1)}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[#713f12]/70 transition hover:bg-amber-100/75 hover:text-[#a16207] active:scale-95 dark:text-amber-100/70 dark:hover:bg-amber-300/10"
          aria-label="Предыдущий период"
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
        >
          <ArrowRight aria-hidden="true" size={18} />
        </button>
      </div>

      <div className={`${panelClass} grid h-14 grid-cols-4 gap-1 rounded-full p-1.5`} role="tablist" aria-label="Период трекера">
        {tabs.map((tab) => (
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
    </div>
  );
}
