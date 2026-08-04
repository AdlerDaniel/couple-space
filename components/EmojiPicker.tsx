"use client";

import {
  Clock3,
  Coffee,
  Flag,
  Lightbulb,
  LoaderCircle,
  MapPinned,
  Search,
  Shapes,
  Smile,
  Trees,
  UserRound,
  Volleyball,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FluentEmoji } from "@/components/FluentEmoji";

type EmojiTone = "pink" | "red" | "blue" | "emerald" | "sky" | "amber";
type EmojiItem = {
  emoji: string;
  label: string;
  tags: string[];
  group: number;
  order: number;
  asset: string;
  skins?: unknown[];
};
type EmojiCatalog = {
  version: string;
  groups: { id: number; label: string }[];
  emojis: EmojiItem[];
};

const toneClasses: Record<EmojiTone, { active: string; focus: string; soft: string; text: string }> = {
  pink: { active: "bg-pink-600 text-white", focus: "focus-visible:ring-pink-400", soft: "bg-pink-50 dark:bg-pink-400/10", text: "text-pink-700 dark:text-pink-200" },
  red: { active: "bg-red-600 text-white", focus: "focus-visible:ring-red-400", soft: "bg-red-50 dark:bg-red-400/10", text: "text-red-700 dark:text-red-200" },
  blue: { active: "bg-blue-600 text-white", focus: "focus-visible:ring-blue-400", soft: "bg-blue-50 dark:bg-blue-400/10", text: "text-blue-700 dark:text-blue-200" },
  emerald: { active: "bg-emerald-600 text-white", focus: "focus-visible:ring-emerald-400", soft: "bg-emerald-50 dark:bg-emerald-400/10", text: "text-emerald-700 dark:text-emerald-200" },
  sky: { active: "bg-sky-600 text-white", focus: "focus-visible:ring-sky-400", soft: "bg-sky-50 dark:bg-sky-400/10", text: "text-sky-700 dark:text-sky-200" },
  amber: { active: "bg-amber-500 text-white", focus: "focus-visible:ring-amber-400", soft: "bg-amber-50 dark:bg-amber-400/10", text: "text-amber-700 dark:text-amber-200" },
};

const groupIcons = [Smile, UserRound, Trees, Coffee, MapPinned, Volleyball, Lightbulb, Shapes, Flag];
const RECENT_KEY = "couple-space:fluent-emoji-recent:v1";

export default function EmojiPicker({
  onSelect,
  selectedEmoji,
  tone = "pink",
  className = "",
  compact = false,
  multiple = false,
  portal = false,
}: {
  onSelect: (emoji: string) => void;
  selectedEmoji?: string;
  tone?: EmojiTone;
  className?: string;
  compact?: boolean;
  multiple?: boolean;
  portal?: boolean;
}) {
  const [catalog, setCatalog] = useState<EmojiCatalog | null>(null);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase("ru"));
  const [activeGroup, setActiveGroup] = useState<number | "recent">("recent");
  const [recent, setRecent] = useState<string[]>([]);
  const styles = toneClasses[tone];

  useEffect(() => {
    let cancelled = false;
    fetch("/fluent-emoji/index.json")
      .then((response) => {
        if (!response.ok) throw new Error("Emoji catalog is unavailable");
        return response.json() as Promise<EmojiCatalog>;
      })
      .then((data) => {
        if (!cancelled) setCatalog(data);
      })
      .catch(() => {
        if (!cancelled) setCatalog({ version: "fallback", groups: [], emojis: [] });
      });
    const recentFrame = window.requestAnimationFrame(() => {
      try {
        setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"));
      } catch {
        setRecent([]);
      }
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(recentFrame);
    };
  }, []);

  const visible = useMemo(() => {
    if (!catalog) return [];
    if (deferredQuery) {
      return catalog.emojis.filter((item) =>
        `${item.label} ${item.tags.join(" ")} ${item.emoji}`.toLocaleLowerCase("ru").includes(deferredQuery),
      );
    }
    if (activeGroup === "recent") {
      return recent
        .map((emoji) => catalog.emojis.find((item) => item.emoji === emoji))
        .filter((item): item is EmojiItem => Boolean(item));
    }
    return catalog.emojis.filter((item) => item.group === activeGroup);
  }, [activeGroup, catalog, deferredQuery, recent]);

  function choose(item: EmojiItem) {
    onSelect(item.emoji);
    const next = [item.emoji, ...recent.filter((emoji) => emoji !== item.emoji)].slice(0, 36);
    setRecent(next);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    if (!multiple) setQuery("");
  }

  const picker = (
    <div
      className={`emoji-picker overflow-hidden rounded-2xl border border-black/8 bg-white/96 text-slate-900 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-[#0d1117]/96 dark:text-white ${className}`}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className={compact ? "p-2.5" : "p-3"}>
        <label className="relative block">
          <span className="sr-only">Поиск эмодзи</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-45" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Найти эмодзи"
            className={`h-11 w-full rounded-xl border border-black/8 bg-black/[0.035] pl-9 pr-3 text-sm font-bold outline-none focus-visible:ring-2 ${styles.focus} dark:border-white/10 dark:bg-white/7`}
          />
        </label>

        <div className="emoji-picker-categories mt-2 flex gap-1 overflow-x-auto pb-1">
          <button type="button" onPointerDown={(event) => event.preventDefault()} onClick={() => { setActiveGroup("recent"); setQuery(""); }} className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition ${activeGroup === "recent" && !query ? styles.active : styles.soft}`} title="Недавние" aria-label="Недавние" aria-pressed={activeGroup === "recent" && !query}>
            <Clock3 className="h-4 w-4" aria-hidden="true" />
          </button>
          {catalog?.groups.filter((group) => group.id !== 2).map((group, index) => {
            const Icon = groupIcons[index] || Flag;
            return (
              <button key={group.id} type="button" onPointerDown={(event) => event.preventDefault()} onClick={() => { setActiveGroup(group.id); setQuery(""); }} className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition ${activeGroup === group.id && !query ? styles.active : styles.soft}`} title={group.label} aria-label={group.label} aria-pressed={activeGroup === group.id && !query}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </button>
            );
          })}
        </div>

        <div className="emoji-picker-grid mt-2 grid max-h-[min(22rem,48vh)] grid-cols-7 gap-1 overflow-y-auto overscroll-contain pr-1 sm:grid-cols-8" role="listbox" aria-label="Microsoft Fluent Emojis">
          {!catalog ? (
            <div className="col-span-full grid h-40 place-items-center">
              <LoaderCircle className={`h-7 w-7 animate-spin ${styles.text}`} aria-label="Загружаем эмодзи" />
            </div>
          ) : visible.length ? (
            visible.map((item) => (
              <button key={item.emoji} type="button" onPointerDown={(event) => event.preventDefault()} onClick={() => choose(item)} className={`grid aspect-square min-h-10 place-items-center rounded-xl transition hover:scale-110 hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 ${styles.focus} dark:hover:bg-white/8 ${selectedEmoji === item.emoji ? styles.soft : ""}`} title={item.label} aria-label={item.label} role="option" aria-selected={selectedEmoji === item.emoji}>
                <FluentEmoji emoji={item.emoji} label={item.label} size={compact ? 28 : 32} />
              </button>
            ))
          ) : (
            <div className="col-span-full grid h-40 place-items-center px-6 text-center text-sm font-bold opacity-55">
              {deferredQuery ? "Ничего не найдено" : "Выбранные эмодзи появятся здесь"}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return portal && typeof document !== "undefined" ? createPortal(picker, document.body) : picker;
}
