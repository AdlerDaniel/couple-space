"use client";

import { Check, Keyboard, SmilePlus } from "lucide-react";
import { useRef, useState } from "react";

type EmojiTone = "pink" | "red" | "blue" | "emerald" | "sky" | "amber";

const toneClasses: Record<EmojiTone, { button: string; focus: string; soft: string; text: string }> = {
  pink: { button: "from-pink-600 to-rose-500", focus: "focus-visible:ring-pink-400", soft: "bg-pink-50 dark:bg-pink-400/10", text: "text-pink-700 dark:text-pink-200" },
  red: { button: "from-red-600 to-rose-500", focus: "focus-visible:ring-red-400", soft: "bg-red-50 dark:bg-red-400/10", text: "text-red-700 dark:text-red-200" },
  blue: { button: "from-blue-600 to-cyan-500", focus: "focus-visible:ring-blue-400", soft: "bg-blue-50 dark:bg-blue-400/10", text: "text-blue-700 dark:text-blue-200" },
  emerald: { button: "from-emerald-600 to-teal-500", focus: "focus-visible:ring-emerald-400", soft: "bg-emerald-50 dark:bg-emerald-400/10", text: "text-emerald-700 dark:text-emerald-200" },
  sky: { button: "from-sky-600 to-cyan-500", focus: "focus-visible:ring-sky-400", soft: "bg-sky-50 dark:bg-sky-400/10", text: "text-sky-700 dark:text-sky-200" },
  amber: { button: "from-amber-600 to-yellow-500", focus: "focus-visible:ring-amber-400", soft: "bg-amber-50 dark:bg-amber-400/10", text: "text-amber-700 dark:text-amber-200" },
};

function lastGrapheme(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (typeof Intl.Segmenter === "function") {
    const segments = Array.from(
      new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(trimmed),
      (part) => part.segment,
    );
    return segments.at(-1) || "";
  }

  return Array.from(trimmed).at(-1) || "";
}

export default function EmojiPicker({
  onSelect,
  selectedEmoji,
  tone = "pink",
  className = "",
  compact = false,
  multiple = false,
  autoFocus = false,
}: {
  onSelect: (emoji: string) => void;
  selectedEmoji?: string;
  tone?: EmojiTone;
  className?: string;
  compact?: boolean;
  multiple?: boolean;
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState(selectedEmoji || "");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const styles = toneClasses[tone];

  function updateDraft(value: string) {
    setDraft(multiple ? value.slice(0, 64) : lastGrapheme(value));
  }

  function openSystemKeyboard() {
    inputRef.current?.focus();
    inputRef.current?.select();

    const virtualKeyboard = (
      navigator as Navigator & { virtualKeyboard?: { show?: () => void } }
    ).virtualKeyboard;
    virtualKeyboard?.show?.();
  }

  function confirm() {
    const value = draft.trim();
    if (!value) return;
    onSelect(multiple ? value : lastGrapheme(value));
    if (multiple) setDraft("");
  }

  return (
    <div className={`native-emoji overflow-hidden rounded-2xl border border-black/8 bg-white/92 text-slate-900 shadow-inner backdrop-blur-xl dark:border-white/10 dark:bg-[#0d1117]/94 dark:text-white ${className}`}>
      <div className={`${compact ? "p-3" : "p-4"}`}>
        <div className="flex items-start gap-3">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-2xl ${styles.soft}`} aria-hidden="true">
            {draft || selectedEmoji || "😊"}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-black">Системные эмодзи</p>
            <p className="mt-1 text-xs font-semibold leading-5 opacity-55">
              Используйте клавиатуру своего устройства — список ничем не ограничен.
            </p>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Введите или вставьте эмодзи</span>
            <input
              ref={inputRef}
              autoFocus={autoFocus}
              value={draft}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => updateDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  confirm();
                }
              }}
              inputMode="text"
              enterKeyHint="done"
              autoComplete="off"
              spellCheck={false}
              placeholder={multiple ? "Вставьте один или несколько эмодзи" : "Вставьте эмодзи"}
              className={`native-emoji h-12 w-full rounded-xl border border-black/10 bg-white px-3 text-center text-2xl outline-none focus-visible:ring-2 ${styles.focus} dark:border-white/10 dark:bg-white/8`}
            />
          </label>
          <button type="button" onClick={confirm} disabled={!draft.trim()} className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${styles.button} text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40`} aria-label="Использовать эмодзи" title="Использовать">
            <Check className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <button type="button" onClick={openSystemKeyboard} className={`mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-black/8 bg-white/65 px-3 text-xs font-black transition hover:bg-white ${styles.text} ${styles.focus} focus-visible:outline-none focus-visible:ring-2 dark:border-white/10 dark:bg-white/7 dark:hover:bg-white/12`}>
          <SmilePlus className="h-4 w-4" aria-hidden="true" />
          Открыть клавиатуру устройства
        </button>
      </div>

      <div className={`border-t border-black/6 px-3 py-2 text-[10px] font-bold leading-4 opacity-50 dark:border-white/8 ${compact ? "text-center" : "flex flex-wrap items-center justify-center gap-x-3"}`}>
        <span className="inline-flex items-center gap-1"><Keyboard className="h-3 w-3" aria-hidden="true" /> Windows: Win + .</span>
        <span>Mac: Control + Command + Space</span>
        <span>Телефон: кнопка 😊 на клавиатуре</span>
      </div>
    </div>
  );
}
