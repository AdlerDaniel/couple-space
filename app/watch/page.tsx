"use client";

import {
  findDuplicateWatchTitle,
  getRandomWatchItem,
  normalizeWatchTitle,
} from "@/lib/watchList";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type ContentType = "movie" | "series" | "cartoon" | "anime";

type Couple = {
  id: string;
  partner_one_id: string;
  partner_two_id: string | null;
};

type CoupleProfile = {
  partner_one: string | null;
  partner_two: string | null;
};

type WatchItem = {
  id: string;
  couple_id: string;
  title: string;
  content_type: ContentType;
  added_by: string;
  is_watched: boolean;
  watched_at: string | null;
  created_at: string;
  updated_at: string;
};

const contentTypes: Array<{ key: ContentType; label: string; icon: string }> = [
  { key: "movie", label: "Фильм", icon: "◉" },
  { key: "series", label: "Сериал", icon: "▤" },
  { key: "cartoon", label: "Мультфильм", icon: "✿" },
  { key: "anime", label: "Аниме", icon: "✦" },
];

function getReadableName(value?: string | null, fallback = "Партнёр") {
  const name = value?.trim();
  if (!name) return fallback;
  if (/^\d{5,}$/.test(name)) return fallback;
  return name;
}

function getContentTypeLabel(type: ContentType) {
  return contentTypes.find((item) => item.key === type)?.label || "Фильм";
}

function getContentTypeIcon(type: ContentType) {
  return contentTypes.find((item) => item.key === type)?.icon || "◉";
}

export default function WatchPage() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [profile, setProfile] = useState<CoupleProfile | null>(null);
  const [items, setItems] = useState<WatchItem[]>([]);
  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState<ContentType>("movie");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [roulettePreview, setRoulettePreview] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<WatchItem | null>(null);
  const [savedPickId, setSavedPickId] = useState<string | null>(null);

  const wishItems = useMemo(
    () => items.filter((item) => !item.is_watched),
    [items],
  );
  const watchedItems = useMemo(
    () => items.filter((item) => item.is_watched),
    [items],
  );

  useEffect(() => {
    document.title = "Что посмотрим? · Couple Space";

    async function loadPage() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setCurrentUserId(user.id);

      const { data: coupleData } = await supabase
        .from("couples")
        .select("id, partner_one_id, partner_two_id")
        .or(`partner_one_id.eq.${user.id},partner_two_id.eq.${user.id}`)
        .limit(1)
        .maybeSingle<Couple>();

      if (!coupleData) {
        router.push("/couple");
        return;
      }

      setCouple(coupleData);

      const [{ data: profileData }, { data: watchData }] = await Promise.all([
        supabase
          .from("couple_profiles")
          .select("partner_one, partner_two")
          .eq("couple_id", coupleData.id)
          .limit(1)
          .maybeSingle<CoupleProfile>(),
        supabase
          .from("watch_items")
          .select("*")
          .eq("couple_id", coupleData.id)
          .order("is_watched", { ascending: true })
          .order("updated_at", { ascending: false }),
      ]);

      setProfile(profileData || null);
      setItems((watchData || []) as WatchItem[]);
      setIsLoading(false);

      const channel = supabase
        .channel(`watch-items:${coupleData.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "watch_items",
            filter: `couple_id=eq.${coupleData.id}`,
          },
          (payload) => {
            if (payload.eventType === "INSERT") {
              const next = payload.new as WatchItem;
              setItems((current) =>
                current.some((item) => item.id === next.id) ? current : [next, ...current],
              );
            }

            if (payload.eventType === "UPDATE") {
              const next = payload.new as WatchItem;
              setItems((current) =>
                current.map((item) => (item.id === next.id ? next : item)),
              );
              setSelectedItem((current) => (current?.id === next.id ? next : current));
            }

            if (payload.eventType === "DELETE") {
              const removed = payload.old as Pick<WatchItem, "id">;
              setItems((current) => current.filter((item) => item.id !== removed.id));
              setSelectedItem((current) => (current?.id === removed.id ? null : current));
            }
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    let cleanup: (() => void) | undefined;
    loadPage().then((value) => {
      cleanup = value;
    });

    return () => {
      cleanup?.();
    };
  }, [router]);

  function getAddedByName(userId: string) {
    if (!couple || !currentUserId) return "Партнёр";
    if (userId === currentUserId) return "Вы";
    if (userId === couple.partner_one_id) return getReadableName(profile?.partner_one, "Партнёр");
    return getReadableName(profile?.partner_two, "Партнёр");
  }

  async function addItem() {
    if (!couple || !currentUserId) return;

    const trimmedTitle = title.trim().replace(/\s+/g, " ");
    if (!trimmedTitle) {
      setMessage("Введите название фильма или сериала.");
      return;
    }

    if (findDuplicateWatchTitle(items, trimmedTitle)) {
      setMessage("Такое название уже есть в общем списке.");
      return;
    }

    setIsSaving(true);
    const { data, error } = await supabase
      .from("watch_items")
      .insert([
        {
          couple_id: couple.id,
          title: trimmedTitle,
          content_type: contentType,
          added_by: currentUserId,
        },
      ])
      .select("*")
      .single();

    if (error || !data) {
      setMessage(
        error?.code === "23505"
          ? "Такое название уже есть в общем списке."
          : "Не удалось добавить. Попробуйте ещё раз.",
      );
      setIsSaving(false);
      return;
    }

    setItems((current) => [data as WatchItem, ...current]);
    setTitle("");
    setMessage("Добавлено в список на просмотр.");
    setIsSaving(false);
  }

  async function markWatched(item: WatchItem) {
    const previous = items;
    const updatedAt = new Date().toISOString();
    setItems((current) =>
      current.map((row) =>
        row.id === item.id
          ? { ...row, is_watched: true, watched_at: updatedAt, updated_at: updatedAt }
          : row,
      ),
    );

    const { error } = await supabase
      .from("watch_items")
      .update({ is_watched: true, watched_at: updatedAt, updated_at: updatedAt })
      .eq("id", item.id);

    if (error) {
      setItems(previous);
      setMessage("Не удалось отметить просмотренным.");
    }
  }

  async function deleteItem(item: WatchItem) {
    const previous = items;
    setItems((current) => current.filter((row) => row.id !== item.id));

    const { error } = await supabase.from("watch_items").delete().eq("id", item.id);
    if (error) {
      setItems(previous);
      setMessage("Не удалось удалить элемент.");
    }
  }

  function spinRoulette() {
    if (wishItems.length === 0 || isSpinning) return;

    setIsSpinning(true);
    setSelectedItem(null);
    setSavedPickId(null);
    setMessage("");

    let ticks = 0;
    const intervalId = window.setInterval(() => {
      const preview = getRandomWatchItem(wishItems);
      setRoulettePreview(preview?.title || null);
      ticks += 1;

      if (ticks >= 18) {
        window.clearInterval(intervalId);
        const winner = getRandomWatchItem(wishItems);
        setRoulettePreview(null);
        setSelectedItem(winner);
        setIsSpinning(false);
      }
    }, 90);
  }

  async function saveRoulettePick() {
    if (!selectedItem) return;

    const updatedAt = new Date().toISOString();
    setSavedPickId(selectedItem.id);
    setItems((current) =>
      current.map((item) =>
        item.id === selectedItem.id ? { ...item, updated_at: updatedAt } : item,
      ),
    );

    await supabase
      .from("watch_items")
      .update({ updated_at: updatedAt })
      .eq("id", selectedItem.id);

    setMessage(`${selectedItem.title} сохранено в список на просмотр.`);
  }

  function renderCard(item: WatchItem) {
    const isSelected = selectedItem?.id === item.id;

    return (
      <article
        key={item.id}
        className={`group rounded-[1.4rem] border p-4 shadow-[0_18px_45px_rgba(77,124,15,0.12)] transition duration-300 hover:-translate-y-1 dark:shadow-black/20 ${
          item.is_watched
            ? "border-lime-200/60 bg-white/58 opacity-78 dark:border-lime-100/10 dark:bg-white/7"
            : "border-white/65 bg-white/68 dark:border-white/10 dark:bg-white/8"
        } ${isSelected ? "ring-4 ring-lime-300/55" : ""}`}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-lime-100 text-xl text-lime-700 shadow-inner dark:bg-lime-400/12 dark:text-lime-100">
            {getContentTypeIcon(item.content_type)}
          </span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-black ${
              item.is_watched
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-100"
                : "bg-lime-100 text-lime-700 dark:bg-lime-400/15 dark:text-lime-100"
            }`}
          >
            {item.is_watched ? "Уже посмотрели" : "Хотим посмотреть"}
          </span>
        </div>

        <h3 className="mt-4 break-words text-2xl font-black text-lime-950 dark:text-white">
          {item.title}
        </h3>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-black uppercase tracking-wide text-lime-900/55 dark:text-white/45">
          <span>{getContentTypeLabel(item.content_type)}</span>
          <span>Добавил: {getAddedByName(item.added_by)}</span>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          {!item.is_watched && (
            <button
              type="button"
              onClick={() => markWatched(item)}
              className="rounded-full bg-lime-600 px-4 py-2.5 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5"
            >
              Отметить как просмотрено
            </button>
          )}
          <button
            type="button"
            onClick={() => deleteItem(item)}
            className="rounded-full bg-white/75 px-4 py-2.5 text-sm font-black text-lime-800 shadow-inner transition hover:-translate-y-0.5 dark:bg-white/10 dark:text-white"
          >
            Удалить
          </button>
        </div>
      </article>
    );
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7fee7] px-6 text-lime-800 dark:bg-[#0b1303] dark:text-white">
        <div className="rounded-3xl bg-white/65 p-8 font-black shadow-xl dark:bg-white/8">
          Загружаем список для вечера...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7fee7] px-4 pb-28 pt-24 text-lime-950 dark:bg-[#0b1303] dark:text-white md:px-6 md:pt-28">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_10%,rgba(132,204,22,0.24),transparent_30%),radial-gradient(circle_at_88%_16%,rgba(190,242,100,0.18),transparent_28%),linear-gradient(135deg,#f7fee7_0%,#ecfccb_48%,#f0fdf4_100%)] dark:bg-[radial-gradient(circle_at_18%_10%,rgba(132,204,22,0.16),transparent_30%),linear-gradient(135deg,#0b1303_0%,#132006_48%,#071002_100%)]" />

      <section className="mx-auto max-w-6xl">
        <div className="text-center">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-lime-700/58 dark:text-lime-100/58">
            Что посмотрим?
          </p>
          <h1 className="mt-3 text-4xl font-black text-lime-800 dark:text-white md:text-6xl">
            Что посмотрим сегодня?
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-lg font-semibold leading-8 text-lime-950/62 dark:text-white/55">
            Наш общий список фильмов и сериалов для уютных вечеров
          </p>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {[
            ["Всего в списке", items.length],
            ["Осталось посмотреть", wishItems.length],
            ["Уже посмотрели", watchedItems.length],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-[1.35rem] border border-white/60 bg-white/62 p-4 text-center shadow-inner backdrop-blur-xl dark:border-white/10 dark:bg-white/8"
            >
              <p className="text-3xl font-black text-lime-800 dark:text-white">{value}</p>
              <p className="mt-1 text-xs font-black uppercase tracking-wide text-lime-900/50 dark:text-white/45">
                {label}
              </p>
            </div>
          ))}
        </div>

        <section className="mt-6 overflow-hidden rounded-[2rem] border border-white/70 bg-white/68 p-5 text-center shadow-[0_28px_100px_rgba(77,124,15,0.18)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/8 md:p-7">
          <div className="mx-auto grid min-h-64 max-w-3xl place-items-center rounded-[1.7rem] border border-lime-200/70 bg-gradient-to-br from-lime-100 via-white to-emerald-100 p-6 shadow-inner dark:border-lime-100/10 dark:from-lime-500/12 dark:via-white/8 dark:to-emerald-500/12">
            {wishItems.length === 0 ? (
              <div>
                <p className="text-5xl">✦</p>
                <p className="mt-4 text-2xl font-black">Сначала добавьте что-нибудь в список</p>
              </div>
            ) : (
              <div className="w-full">
                <div
                  className={`mx-auto grid h-36 w-36 place-items-center rounded-full border-[10px] border-lime-300 bg-white text-5xl shadow-[0_20px_70px_rgba(77,124,15,0.2)] transition dark:border-lime-400/35 dark:bg-white/10 ${
                    isSpinning ? "animate-spin" : ""
                  }`}
                >
                  ✦
                </div>
                <p className="mt-5 text-sm font-black uppercase tracking-[0.18em] text-lime-800/55 dark:text-white/45">
                  {isSpinning ? "Крутим..." : selectedItem ? "Сегодня выбираем" : "Рулетка вечера"}
                </p>
                <h2 className="mx-auto mt-2 max-w-xl break-words text-3xl font-black text-lime-900 dark:text-white md:text-4xl">
                  {roulettePreview || selectedItem?.title || "Пусть решит случай"}
                </h2>
                {selectedItem && (
                  <p className="mt-2 font-black text-lime-700 dark:text-lime-100">
                    {getContentTypeLabel(selectedItem.content_type)} · добавил {getAddedByName(selectedItem.added_by)}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={spinRoulette}
              disabled={wishItems.length === 0 || isSpinning}
              className="rounded-full bg-lime-600 px-7 py-3.5 text-base font-black text-white shadow-[0_18px_55px_rgba(77,124,15,0.24)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Крутить рулетку
            </button>
            {selectedItem && (
              <button
                type="button"
                onClick={saveRoulettePick}
                disabled={savedPickId === selectedItem.id}
                className="rounded-full bg-white/82 px-7 py-3.5 text-base font-black text-lime-800 shadow-inner transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55 dark:bg-white/10 dark:text-white"
              >
                {savedPickId === selectedItem.id ? "Сохранено" : "Сохранить"}
              </button>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-[1.7rem] border border-white/70 bg-white/64 p-4 shadow-inner backdrop-blur-xl dark:border-white/10 dark:bg-white/8 md:p-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px_auto]">
            <input
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                if (message) setMessage("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") void addItem();
              }}
              placeholder="Название фильма, сериала, мультфильма..."
              className="h-13 rounded-2xl border border-lime-200/70 bg-white/82 px-4 font-semibold text-lime-950 outline-none transition placeholder:text-lime-900/35 focus:border-lime-500 dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
            <select
              value={contentType}
              onChange={(event) => setContentType(event.target.value as ContentType)}
              className="h-13 rounded-2xl border border-lime-200/70 bg-white/82 px-4 font-black text-lime-950 outline-none transition focus:border-lime-500 dark:border-white/10 dark:bg-black/20 dark:text-white"
            >
              {contentTypes.map((type) => (
                <option key={type.key} value={type.key}>
                  {type.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addItem}
              disabled={isSaving || !normalizeWatchTitle(title)}
              className="rounded-2xl bg-lime-600 px-6 py-3 font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Добавить
            </button>
          </div>
          {message && (
            <p className="mt-3 text-sm font-black text-lime-800 dark:text-lime-100">
              {message}
            </p>
          )}
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-lime-800/55 dark:text-white/45">
                  Список желаний
                </p>
                <h2 className="text-3xl font-black text-lime-900 dark:text-white">
                  Хотим посмотреть
                </h2>
              </div>
              <span className="rounded-full bg-lime-100 px-3 py-1 text-sm font-black text-lime-700 dark:bg-lime-400/12 dark:text-lime-100">
                {wishItems.length}
              </span>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {wishItems.length ? (
                wishItems.map(renderCard)
              ) : (
                <div className="rounded-[1.4rem] bg-white/62 p-5 text-center font-black shadow-inner dark:bg-white/8 md:col-span-2 lg:col-span-1 xl:col-span-2">
                  Пока пусто. Добавьте первый вариант для вечера.
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-lime-800/55 dark:text-white/45">
                  Уже посмотрели
                </p>
                <h2 className="text-3xl font-black text-lime-900 dark:text-white">
                  Архив вечеров
                </h2>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-black text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-100">
                {watchedItems.length}
              </span>
            </div>
            <div className="mt-4 grid gap-4">
              {watchedItems.length ? (
                watchedItems.map(renderCard)
              ) : (
                <div className="rounded-[1.4rem] bg-white/62 p-5 text-center font-black shadow-inner dark:bg-white/8">
                  Здесь появится то, что вы уже посмотрели вместе.
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/today"
            className="inline-flex rounded-full bg-white/70 px-5 py-3 text-sm font-black text-lime-800 shadow-inner transition hover:-translate-y-0.5 dark:bg-white/10 dark:text-white"
          >
            Вернуться в Сегодня
          </Link>
        </div>
      </section>
    </main>
  );
}
