import Link from "next/link";
import { Activity, Bell, CalendarDays, Circle, Heart, MessageCircle, Play } from "lucide-react";

const legacyIcons = {
  "♡": Heart,
  "🔔": Bell,
  "◌": MessageCircle,
  "◫": Activity,
  "◇": CalendarDays,
  "▶": Play,
  "●": Circle,
} as const;

type EmptyStateProps = {
  icon?: string;
  title: string;
  text: string;
  actionHref?: string;
  actionLabel?: string;
  accent?: string;
};

export default function EmptyState({
  icon = "♡",
  title,
  text,
  actionHref,
  actionLabel,
  accent = "#ca8a04",
}: EmptyStateProps) {
  const Icon = legacyIcons[icon as keyof typeof legacyIcons];

  return (
    <div
      className="ui-card p-5 text-center"
      style={{
        ["--scroll-accent" as string]: accent,
        color: accent,
      }}
    >
      <div
        className="app-empty-scene mx-auto grid h-20 w-20 place-items-center rounded-[1.35rem] text-3xl text-white shadow-lg"
        style={{ backgroundColor: accent }}
      >
        {Icon ? <Icon aria-hidden="true" size={32} strokeWidth={2} /> : icon}
      </div>
      <p className="app-empty-title mt-4 text-lg font-black text-current">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-6 text-[#1f2937]/70 dark:text-white/62">
        {text}
      </p>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="ui-button mt-4 max-sm:w-full"
          style={{ backgroundColor: accent }}
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
