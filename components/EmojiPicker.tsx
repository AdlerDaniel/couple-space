"use client";

import { emojiCategories, searchEmojiCategories } from "@/lib/emojis";
import { Clock3, Search } from "lucide-react";
import { useMemo, useState } from "react";

type EmojiTone = "pink" | "red" | "blue" | "emerald" | "sky" | "amber";

const toneClasses: Record<EmojiTone, { active: string; hover: string; ring: string; text: string }> = {
  pink: { active: "bg-pink-100 text-pink-700 dark:bg-pink-400/18 dark:text-pink-100", hover: "hover:bg-pink-50 dark:hover:bg-pink-400/12", ring: "focus-visible:ring-pink-400", text: "text-pink-700 dark:text-pink-200" },
  red: { active: "bg-red-100 text-red-700 dark:bg-red-400/18 dark:text-red-100", hover: "hover:bg-red-50 dark:hover:bg-red-400/12", ring: "focus-visible:ring-red-400", text: "text-red-700 dark:text-red-200" },
  blue: { active: "bg-blue-100 text-blue-700 dark:bg-blue-400/18 dark:text-blue-100", hover: "hover:bg-blue-50 dark:hover:bg-blue-400/12", ring: "focus-visible:ring-blue-400", text: "text-blue-700 dark:text-blue-200" },
  emerald: { active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/18 dark:text-emerald-100", hover: "hover:bg-emerald-50 dark:hover:bg-emerald-400/12", ring: "focus-visible:ring-emerald-400", text: "text-emerald-700 dark:text-emerald-200" },
  sky: { active: "bg-sky-100 text-sky-700 dark:bg-sky-400/18 dark:text-sky-100", hover: "hover:bg-sky-50 dark:hover:bg-sky-400/12", ring: "focus-visible:ring-sky-400", text: "text-sky-700 dark:text-sky-200" },
  amber: { active: "bg-amber-100 text-amber-700 dark:bg-amber-400/18 dark:text-amber-100", hover: "hover:bg-amber-50 dark:hover:bg-amber-400/12", ring: "focus-visible:ring-amber-400", text: "text-amber-700 dark:text-amber-200" },
};

function readRecentEmojis(storageKey: string) {
  if (typeof window === "undefined") return [];
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(stored)
      ? stored.filter((emoji): emoji is string => typeof emoji === "string").slice(0, 32)
      : [];
  } catch {
    return [];
  }
}

export default function EmojiPicker({
  onSelect,
  selectedEmoji,
  tone = "pink",
  storageKey = "couple-space:recent-emojis",
  className = "",
  compact = false,
}: {
  onSelect: (emoji: string) => void;
  selectedEmoji?: string;
  tone?: EmojiTone;
  storageKey?: string;
  className?: string;
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(emojiCategories[0].id);
  const [recentEmojis, setRecentEmojis] = useState<string[]>(() => readRecentEmojis(storageKey));
  const styles = toneClasses[tone];

  const visibleCategories = useMemo(() => searchEmojiCategories(query), [query]);
  const visibleEmojis = useMemo(() => {
    if (query) return visibleCategories.flatMap((category) => category.emojis);
    if (activeCategory === "recent") return recentEmojis;
    return emojiCategories.find((category) => category.id === activeCategory)?.emojis || [];
  }, [activeCategory, query, recentEmojis, visibleCategories]);

  function selectEmoji(emoji: string) {
    const nextRecent = [emoji, ...recentEmojis.filter((item) => item !== emoji)].slice(0, 32);
    setRecentEmojis(nextRecent);
    try {
      localStorage.setItem(storageKey, JSON.stringify(nextRecent));
    } catch {
      // Выбор всё равно работает, даже если браузер запретил локальное хранилище.
    }
    onSelect(emoji);
  }

  return (
    <div className={`native-emoji overflow-hidden rounded-2xl border border-black/8 bg-white/88 text-slate-900 shadow-inner backdrop-blur-xl dark:border-white/10 dark:bg-black/22 dark:text-white ${className}`}>
      <div className="p-2.5 pb-2">
        <label className="relative block">
          <Search className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${styles.text}`} aria-hidden="true" />
          <span className="sr-only">Поиск эмодзи</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск: сердце, еда, поездка…"
            className={`h-10 w-full rounded-xl border border-black/8 bg-white/75 pl-9 pr-3 text-sm font-semibold outline-none placeholder:text-slate-400 focus-visible:ring-2 ${styles.ring} dark:border-white/10 dark:bg-white/8 dark:placeholder:text-white/35`}
          />
        </label>
      </div>

      {!query && (
        <div className="flex gap-1 overflow-x-auto px-2.5 pb-2" aria-label="Категории эмодзи">
          {recentEmojis.length > 0 && (
            <button type="button" onClick={() => setActiveCategory("recent")} title="Недавние" aria-label="Недавние эмодзи" aria-pressed={activeCategory === "recent"} className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition focus-visible:outline-none focus-visible:ring-2 ${styles.ring} ${activeCategory === "recent" ? styles.active : styles.hover}`}>
              <Clock3 className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          {emojiCategories.map((category) => (
            <button type="button" key={category.id} onClick={() => setActiveCategory(category.id)} title={category.label} aria-label={category.label} aria-pressed={activeCategory === category.id} className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-lg transition focus-visible:outline-none focus-visible:ring-2 ${styles.ring} ${activeCategory === category.id ? styles.active : styles.hover}`}>
              {category.icon}
            </button>
          ))}
        </div>
      )}

      <div className={`${compact ? "max-h-40" : "max-h-56"} overflow-y-auto border-t border-black/6 p-2.5 dark:border-white/8`}>
        {visibleEmojis.length > 0 ? (
          <div className="grid grid-cols-7 gap-1 sm:grid-cols-8">
            {visibleEmojis.map((emoji, index) => (
              <button key={`${emoji}-${index}`} type="button" onClick={() => selectEmoji(emoji)} aria-label={`Выбрать ${emoji}`} aria-pressed={selectedEmoji === emoji} className={`grid aspect-square min-h-9 place-items-center rounded-xl text-xl transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 active:scale-95 ${styles.ring} ${selectedEmoji === emoji ? styles.active : styles.hover}`}>
                {emoji}
              </button>
            ))}
          </div>
        ) : (
          <p className="px-3 py-7 text-center text-sm font-bold opacity-50">Ничего не найдено</p>
        )}
      </div>

      <p className="border-t border-black/6 px-3 py-2 text-center text-[10px] font-bold opacity-45 dark:border-white/8">
        На iPhone, iPad и Mac используется Apple Emoji
      </p>
    </div>
  );
}
