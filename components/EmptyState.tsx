import Link from "next/link";

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
  return (
    <div
      className="app-glass rounded-3xl border p-5 text-center shadow-inner backdrop-blur-xl"
      style={{
        borderColor: `${accent}33`,
        background: `linear-gradient(135deg, ${accent}18, rgba(255,255,255,0.46))`,
        color: accent,
      }}
    >
      <div
        className="mx-auto grid h-12 w-12 place-items-center rounded-2xl text-2xl text-white shadow-lg"
        style={{ backgroundColor: accent }}
      >
        {icon}
      </div>
      <p className="app-empty-title mt-4 text-lg font-black">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm font-bold opacity-70">{text}</p>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="ui-pressable mt-4 inline-flex min-h-11 items-center justify-center rounded-full px-5 py-2 text-sm font-black text-white shadow-lg max-sm:w-full"
          style={{ backgroundColor: accent }}
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
