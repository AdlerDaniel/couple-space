"use client";

import { CountUp } from "@/components/AnimeWidgets";
import Link from "next/link";

type CouplePulseProps = {
  title?: string;
  status: "empty" | "waiting" | "active" | "new";
  stats: Array<{ label: string; value: number | string; tone?: string }>;
  actionHref?: string;
  actionLabel?: string;
  accent?: string;
};

const statusCopy = {
  empty: {
    label: "Нужно начать",
    text: "Добавьте первый общий шаг, чтобы пространство стало живым.",
  },
  waiting: {
    label: "Ждём партнёра",
    text: "Ваш ход уже сделан, теперь полезно мягко напомнить или вернуться позже.",
  },
  active: {
    label: "Ритм есть",
    text: "Сегодня уже есть движение: можно продолжить с самого важного действия.",
  },
  new: {
    label: "Есть новое",
    text: "Появилось событие, реакция или ответ, который стоит открыть первым.",
  },
};

export default function CouplePulse({
  title = "Пульс пары",
  status,
  stats,
  actionHref,
  actionLabel,
  accent = "#ea580c",
}: CouplePulseProps) {
  const copy = statusCopy[status];

  return (
    <section
      className="ui-card couple-pulse overflow-hidden p-4 md:p-5"
      style={{ ["--scroll-accent" as string]: accent }}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="ui-eyebrow">{title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="couple-pulse-orb" style={{ backgroundColor: accent }} />
            <h2 className="ui-section-title text-2xl md:text-3xl">{copy.label}</h2>
          </div>
          <p className="ui-muted mt-2 max-w-2xl text-sm leading-6">{copy.text}</p>
        </div>

        <div className="grid min-w-0 grid-cols-3 gap-2 md:min-w-[20rem]">
          {stats.map((item) => (
            <div key={item.label} className="rounded-[1rem] bg-white/62 p-3 text-center shadow-inner dark:bg-white/8">
              <p className="text-xl font-black" style={{ color: item.tone || accent }}>
                {typeof item.value === "number" ? <CountUp value={item.value} /> : item.value}
              </p>
              <p className="mt-1 truncate text-[10px] font-black uppercase opacity-55">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {actionHref && actionLabel && (
        <Link href={actionHref} className="ui-button mt-4 max-sm:w-full">
          {actionLabel}
        </Link>
      )}
    </section>
  );
}
