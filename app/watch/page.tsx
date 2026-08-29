"use client";

import {
  findDuplicateWatchTitle,
  getRandomWatchItem,
  normalizeWatchTitle,
  shouldOpenAddWatch,
  shouldAutoSpinWatch,
} from "@/lib/watchList";
import { AnimatedText, CountUp } from "@/components/AnimeWidgets";
import { supabase } from "@/lib/supabaseClient";
import { authorizedFetch } from "@/lib/authorizedFetch";
import type { WatchSearchResult } from "@/lib/watchSearch";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Film, Shuffle, Sparkles, Trash2, Tv } from "lucide-react";

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
  external_url: string | null;
  poster_url: string | null;
  created_at: string;
  updated_at: string;
};

const contentTypes: Array<{ key: ContentType; label: string }> = [
  { key: "movie", label: "Фильм" },
  { key: "series", label: "Сериал" },
  { key: "cartoon", label: "Мультфильм" },
  { key: "anime", label: "Аниме" },
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

function ContentTypeIcon({ type, size = 18 }: { type: ContentType; size?: number }) {
  const Icon = type === "series" ? Tv : type === "anime" || type === "cartoon" ? Sparkles : Film;
  return <Icon aria-hidden="true" size={size} strokeWidth={2.2} />;
}

export default function WatchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [rouletteTitle, setRouletteTitle] = useState("Готовы довериться случаю?");
  const [selectedItem, setSelectedItem] = useState<WatchItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<WatchItem | null>(null);
  const [searchResults, setSearchResults] = useState<WatchSearchResult[]>([]);
  const [selectedSearchResult, setSelectedSearchResult] = useState<WatchSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [mobileList, setMobileList] = useState<"wish" | "watched">("wish");
  const deleteTimerRef = useRef<number | null>(null);
  const autoSpinDoneRef = useRef(false);
  const autoAddDoneRef = useRef(false);

  const visibleItems = useMemo(
    () => items.filter((item) => item.id !== pendingDelete?.id),
    [items, pendingDelete],
  );
  const wishItems = useMemo(
    () => visibleItems.filter((item) => !item.is_watched),
    [visibleItems],
  );
  const watchedItems = useMemo(
    () => visibleItems.filter((item) => item.is_watched),
    [visibleItems],
  );

  useEffect(() => {
    document.title = "Что посмотрим? · Couple Space";
    let ignore = false;

    async function loadPage() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (ignore) return;

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

      if (ignore) return;

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

      if (ignore) return;

      setProfile(profileData || null);
      setItems((watchData || []) as WatchItem[]);
      setIsLoading(false);
    }

    loadPage();

    return () => {
      ignore = true;
      if (deleteTimerRef.current) window.clearTimeout(deleteTimerRef.current);
    };
  }, [router]);

  useEffect(() => {
    if (!couple?.id) return;

    const channel = supabase
      .channel(`watch-items:${couple.id}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "watch_items",
          filter: `couple_id=eq.${couple.id}`,
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
  }, [couple?.id]);

  useEffect(() => {
    const normalizedTitle = normalizeWatchTitle(title);

    if (normalizedTitle.length < 2) {
      return;
    }

    let ignore = false;
    const timerId = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await authorizedFetch(
          `/api/watch/search?q=${encodeURIComponent(title.trim())}`,
        );
        const data = (await response.json().catch(() => null)) as {
          results?: WatchSearchResult[];
        } | null;

        if (!ignore) {
          setSearchResults(data?.results || []);
          setIsSearchOpen(true);
        }
      } catch {
        if (!ignore) setSearchResults([]);
      } finally {
        if (!ignore) setIsSearching(false);
      }
    }, 320);

    return () => {
      ignore = true;
      window.clearTimeout(timerId);
    };
  }, [title]);

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
          content_type: selectedSearchResult?.contentType || contentType,
          added_by: currentUserId,
          external_url: selectedSearchResult?.externalUrl || null,
          poster_url: selectedSearchResult?.posterUrl || null,
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
    setSelectedSearchResult(null);
    setSearchResults([]);
    setIsSearchOpen(false);
    setMessage("Добавлено в список на просмотр.");
    setIsAddOpen(false);
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

  function restoreDeletedItem() {
    if (deleteTimerRef.current) {
      window.clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
    }
    setPendingDelete(null);
    setMessage("Удаление отменено.");
  }

  async function finishDelete(item: WatchItem) {
    const previous = items;
    setItems((current) => current.filter((row) => row.id !== item.id));
    setPendingDelete(null);

    const { error } = await supabase.from("watch_items").delete().eq("id", item.id);
    if (error) {
      setItems(previous);
      setMessage("Не удалось удалить элемент.");
    }
  }

  function deleteItem(item: WatchItem) {
    if (deleteTimerRef.current && pendingDelete) {
      window.clearTimeout(deleteTimerRef.current);
      void finishDelete(pendingDelete);
    }

    setSelectedItem((current) => (current?.id === item.id ? null : current));
    setPendingDelete(item);
    setMessage("");
    deleteTimerRef.current = window.setTimeout(() => {
      void finishDelete(item);
      deleteTimerRef.current = null;
    }, 6000);
  }

  const spinRoulette = useCallback(() => {
    if (wishItems.length === 0 || isSpinning) return;

    setIsSpinning(true);
    setSelectedItem(null);
    setMessage("");

    let ticks = 0;
    const intervalId = window.setInterval(() => {
      const preview = getRandomWatchItem(wishItems);
      setRouletteTitle(preview?.title || "Готовы довериться случаю?");
      ticks += 1;

      if (ticks >= 18) {
        window.clearInterval(intervalId);
        const winner = getRandomWatchItem(wishItems);
        setSelectedItem(winner);
        setRouletteTitle(winner?.title || "Готовы довериться случаю?");
        setIsSpinning(false);
      }
    }, 90);
  }, [isSpinning, wishItems]);

  useEffect(() => {
    if (autoSpinDoneRef.current || isLoading || isSpinning || wishItems.length === 0) return;
    if (!shouldAutoSpinWatch(searchParams)) return;

    autoSpinDoneRef.current = true;
    const timerId = window.setTimeout(() => {
      spinRoulette();
    }, 250);

    return () => window.clearTimeout(timerId);
  }, [isLoading, isSpinning, searchParams, spinRoulette, wishItems.length]);

  useEffect(() => {
    if (autoAddDoneRef.current || isLoading || !shouldOpenAddWatch(searchParams)) return;
    autoAddDoneRef.current = true;
    const timerId = window.setTimeout(() => setIsAddOpen(true), 0);
    return () => window.clearTimeout(timerId);
  }, [isLoading, searchParams]);

  function renderCard(item: WatchItem, variant: "default" | "compact" = "default") {
    const isSelected = selectedItem?.id === item.id;

    return (
      <article
        key={item.id}
        data-anime-draggable={!item.is_watched ? "true" : undefined}
        className={`watch-card ${variant === "compact" ? "watch-card-compact" : ""} ${item.is_watched ? "is-watched" : "is-wish"} performance-list-item group rounded-[1.4rem] border p-4 shadow-[0_18px_45px_rgba(77,124,15,0.12)] transition duration-300 hover:-translate-y-1 dark:shadow-black/20 ${
          item.is_watched
            ? "border-lime-200/60 bg-white/58 opacity-78 dark:border-lime-100/10 dark:bg-white/7"
            : "border-white/65 bg-white/68 dark:border-white/10 dark:bg-white/8"
        } ${isSelected ? "ring-4 ring-lime-300/55" : ""}`}
      >
        {item.poster_url ? (
          <div
            className="watch-card-poster mb-4 aspect-[16/10] rounded-[1rem] bg-lime-100 bg-cover bg-center shadow-inner dark:bg-white/8"
            style={{ backgroundImage: `url("${item.poster_url}")` }}
            aria-label={`Постер: ${item.title}`}
          />
        ) : (
          <div className="watch-card-poster watch-card-poster-placeholder mb-4 grid aspect-[16/10] place-items-center rounded-[1rem] bg-lime-100 text-lime-700 shadow-inner dark:bg-white/8 dark:text-lime-100">
            <ContentTypeIcon type={item.content_type} size={34} />
          </div>
        )}
        <div className="watch-card-status flex items-start justify-between gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-lime-100 text-xl text-lime-700 shadow-inner dark:bg-lime-400/12 dark:text-lime-100">
            <ContentTypeIcon type={item.content_type} />
          </span>
          <span
            className={`max-w-[11rem] rounded-full px-3 py-1 text-center text-xs font-black leading-tight sm:max-w-[12rem] ${
              item.is_watched
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-100"
                : "bg-lime-100 text-lime-700 dark:bg-lime-400/15 dark:text-lime-100"
            }`}
          >
            {item.is_watched ? "Уже посмотрели" : "Хотим посмотреть"}
          </span>
        </div>

        <h3 className="mt-4 min-w-0 break-words text-2xl font-black leading-tight text-lime-950 dark:text-white [overflow-wrap:anywhere]">
          {item.title}
        </h3>
        <div className="mt-3 flex min-w-0 flex-wrap gap-2 text-xs font-black uppercase tracking-wide text-lime-900/55 dark:text-white/45">
          <span className="min-w-0 [overflow-wrap:anywhere]">{getContentTypeLabel(item.content_type)}</span>
          <span className="min-w-0 [overflow-wrap:anywhere]">Добавил: {getAddedByName(item.added_by)}</span>
        </div>

        <div className={`watch-card-actions mt-5 grid gap-2 ${item.is_watched ? "grid-cols-1" : "grid-cols-2"}`}>
          {!item.is_watched && (
            <button
              type="button"
              onClick={() => markWatched(item)}
              aria-label={`Отметить ${item.title} как просмотренное`}
              title="Отметить как просмотренное"
              className="watch-card-action min-w-0 rounded-full bg-lime-600 px-2.5 py-2.5 text-center text-xs font-black leading-none text-white shadow-lg transition hover:-translate-y-0.5"
            >
              <Check aria-hidden="true" size={16} />
              <span className="min-w-0 truncate">Просмотрено</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => deleteItem(item)}
            aria-label={`Удалить ${item.title}`}
            title="Удалить"
            className="watch-card-action min-w-0 rounded-full bg-white/75 px-2.5 py-2.5 text-center text-xs font-black leading-none text-lime-800 shadow-inner transition hover:-translate-y-0.5 dark:bg-white/10 dark:text-white"
          >
            <Trash2 aria-hidden="true" size={16} />
            <span className="min-w-0 truncate">Удалить</span>
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
    <main className="watch-page mobile-redesign-page min-h-screen bg-[#f7fee7] px-4 pb-28 pt-24 text-lime-950 dark:bg-[#0b1303] dark:text-white md:px-6 md:pt-28">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_10%,rgba(132,204,22,0.24),transparent_30%),radial-gradient(circle_at_88%_16%,rgba(190,242,100,0.18),transparent_28%),linear-gradient(135deg,#f7fee7_0%,#ecfccb_48%,#f0fdf4_100%)] dark:bg-[radial-gradient(circle_at_18%_10%,rgba(132,204,22,0.16),transparent_30%),linear-gradient(135deg,#0b1303_0%,#132006_48%,#071002_100%)]" />

      <section className="mx-auto max-w-6xl">
        <div className="mobile-page-header watch-header text-center">
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

        <div className="watch-stats mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {[
            ["Всего в списке", visibleItems.length],
            ["Осталось посмотреть", wishItems.length],
            ["Уже посмотрели", watchedItems.length],
          ].map(([label, value]) => (
            <div
              key={label}
              className="watch-stat-inline flex items-baseline gap-2"
            >
              <p className="text-xl font-black text-lime-800 dark:text-white">
                {typeof value === "number" ? <CountUp value={value} /> : value}
              </p>
              <p className="text-[11px] font-black uppercase tracking-[0.08em] text-lime-900/48 dark:text-white/45">
                {label}
              </p>
            </div>
          ))}
        </div>

        <article className="watch-roulette-stage watch-official-roulette mt-7 overflow-hidden rounded-[2rem] p-5 text-white sm:p-7">
          <div className="grid items-center gap-7 md:grid-cols-[17rem_minmax(0,1fr)]">
            <div className="watch-roulette-visual relative mx-auto">
              <span className="watch-roulette-pointer" aria-hidden="true" />
              <div
                className={`watch-official-wheel grid h-64 w-64 place-items-center rounded-full ${isSpinning ? "is-spinning" : ""}`}
                aria-hidden="true"
              >
                <span className="watch-official-hub grid h-20 w-20 place-items-center rounded-full">
                  <Shuffle size={30} strokeWidth={2.4} />
                </span>
              </div>
            </div>

            <div className="watch-roulette-copy min-w-0 text-center md:text-left">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-lime-300">
                Выбор вечера
              </p>
              <h2 className="mt-3 break-words text-3xl font-black leading-tight text-white sm:text-4xl">
                <AnimatedText text={wishItems.length === 0 ? "Сначала добавьте фильм" : rouletteTitle} />
              </h2>
              {selectedItem && (
                <p className="mt-3 text-sm font-semibold text-white/58">
                  {getContentTypeLabel(selectedItem.content_type)} · добавил {getAddedByName(selectedItem.added_by)}
                </p>
              )}
              <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row md:justify-start">
                <button
                  type="button"
                  onClick={spinRoulette}
                  disabled={wishItems.length === 0 || isSpinning}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-lime-400 px-7 font-black text-lime-950 shadow-[0_16px_42px_rgba(132,204,22,0.28)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Sparkles size={18} aria-hidden="true" />
                  {isSpinning ? "Выбираем…" : "Крутить"}
                </button>
                {selectedItem && (
                  <Link
                    href={`/watch/${selectedItem.id}`}
                    className="inline-flex min-h-12 items-center justify-center rounded-full border border-lime-200/20 px-5 font-black text-white/85 transition hover:-translate-y-0.5 hover:bg-white/8"
                  >
                    О выбранном фильме
                  </Link>
                )}
              </div>
            </div>
          </div>
        </article>

        <Link href="/watch/new" className="watch-add-mobile">
          <span aria-hidden="true">+</span>
          Добавить фильм
        </Link>
        {isAddOpen && <button type="button" className="watch-add-backdrop" onClick={() => setIsAddOpen(false)} aria-label="Закрыть добавление фильма" />}
        <section className={`watch-add-sheet mt-6 rounded-[1.7rem] border border-white/70 bg-white/64 p-4 shadow-inner backdrop-blur-xl dark:border-white/10 dark:bg-white/8 md:p-5 ${isAddOpen ? "is-open" : ""}`}>
          <div className="watch-add-mobile-head">
            <div><p>Новый вариант</p><strong>Добавить фильм</strong></div>
            <button type="button" onClick={() => setIsAddOpen(false)} aria-label="Закрыть">×</button>
          </div>
          <div className="grid gap-3 lg:grid-cols-[1fr_220px_auto]">
            <div className="relative">
              <input
                value={title}
                onChange={(event) => {
                  const nextTitle = event.target.value;
                  const nextNormalizedTitle = normalizeWatchTitle(nextTitle);
                  setTitle(nextTitle);
                  if (
                    selectedSearchResult &&
                    normalizeWatchTitle(selectedSearchResult.title) !== nextNormalizedTitle
                  ) {
                    setSelectedSearchResult(null);
                  }
                  if (nextNormalizedTitle.length < 2) {
                    setSearchResults([]);
                    setIsSearching(false);
                  }
                  setIsSearchOpen(true);
                  if (message) setMessage("");
                }}
                onFocus={() => {
                  if (searchResults.length > 0) setIsSearchOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void addItem();
                  if (event.key === "Escape") setIsSearchOpen(false);
                }}
                placeholder="Название фильма, сериала, мультфильма..."
                className="h-13 w-full rounded-2xl border border-lime-200/70 bg-white/82 px-4 font-semibold text-lime-950 outline-none transition placeholder:text-lime-900/35 focus:border-lime-500 dark:border-white/10 dark:bg-black/20 dark:text-white"
              />
              {(isSearchOpen || isSearching) && normalizeWatchTitle(title).length >= 2 && (
                <div className="watch-search-results absolute left-0 right-0 z-30 rounded-[1.25rem] border border-lime-200/70 bg-white/96 p-2 shadow-[0_24px_70px_rgba(77,124,15,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-[#101906]/96">
                  {isSearching && (
                    <div className="rounded-2xl px-3 py-3 text-sm font-black text-lime-800/70 dark:text-white/60">
                      Ищем варианты...
                    </div>
                  )}
                  {!isSearching && searchResults.length === 0 && (
                    <div className="rounded-2xl px-3 py-3 text-sm font-black text-lime-800/70 dark:text-white/60">
                      Ничего не нашли. Можно добавить вручную.
                    </div>
                  )}
                  {!isSearching &&
                    searchResults.map((result) => (
                      <button
                        key={`${result.contentType}-${result.id}`}
                        type="button"
                        onClick={() => {
                          setTitle(result.title);
                          setContentType(result.contentType);
                          setSelectedSearchResult(result);
                          setIsSearchOpen(false);
                          setMessage("");
                        }}
                        className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition hover:bg-lime-50 dark:hover:bg-white/10"
                      >
                        {result.posterUrl ? (
                          <span
                            className="h-16 w-11 shrink-0 rounded-lg bg-lime-100 bg-cover bg-center shadow-inner dark:bg-white/8"
                            style={{ backgroundImage: `url("${result.posterUrl}")` }}
                            aria-hidden="true"
                          />
                        ) : (
                          <span className="grid h-16 w-11 shrink-0 place-items-center rounded-lg bg-lime-100 text-lime-700 shadow-inner dark:bg-white/8 dark:text-lime-100">
                            <ContentTypeIcon type={result.contentType} />
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block truncate font-black text-lime-950 dark:text-white">
                            {result.title}
                          </span>
                          <span className="mt-1 block truncate text-xs font-bold text-lime-800/55 dark:text-white/50">
                            {result.subtitle || getContentTypeLabel(result.contentType)}
                          </span>
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </div>
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
          {selectedSearchResult && (
            <p className="mt-3 text-sm font-black text-lime-800/70 dark:text-lime-100/70">
              Выбрано: {selectedSearchResult.title}
              {selectedSearchResult.year ? ` · ${selectedSearchResult.year}` : ""}. Постер добавится автоматически.
            </p>
          )}
        </section>

        <div className="watch-mobile-tabs" role="tablist" aria-label="Списки фильмов">
          <button type="button" role="tab" aria-selected={mobileList === "wish"} onClick={() => setMobileList("wish")}>Хотим · {wishItems.length}</button>
          <button type="button" role="tab" aria-selected={mobileList === "watched"} onClick={() => setMobileList("watched")}>Посмотрели · {watchedItems.length}</button>
        </div>
        <div className="watch-lists mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className={`watch-list-section ${mobileList === "wish" ? "is-mobile-active" : ""}`}>
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
            <div className="watch-card-grid mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {wishItems.length ? (
                wishItems.map((item) => renderCard(item))
              ) : (
                <div className="rounded-[1.4rem] bg-white/62 p-5 text-center font-black shadow-inner dark:bg-white/8 md:col-span-2 lg:col-span-1 xl:col-span-2">
                  Пока пусто. Добавьте первый вариант для вечера.
                </div>
              )}
            </div>
          </section>

          <section className={`watch-list-section ${mobileList === "watched" ? "is-mobile-active" : ""}`}>
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
            <div className="watch-card-grid watch-archive-grid mt-4 grid grid-cols-2 gap-3">
              {watchedItems.length ? (
                watchedItems.map((item) => renderCard(item, "compact"))
              ) : (
                <div className="col-span-2 rounded-[1.4rem] bg-white/62 p-5 text-center font-black shadow-inner dark:bg-white/8">
                  Здесь появится то, что вы уже посмотрели вместе.
                </div>
              )}
            </div>
          </section>
        </div>

      </section>

      {pendingDelete && (
        <div className="fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-xl items-center justify-between gap-3 rounded-2xl border border-white/70 bg-lime-950 px-4 py-3 text-white shadow-[0_22px_70px_rgba(0,0,0,0.28)] dark:border-white/10">
          <p className="min-w-0 truncate text-sm font-black">
            Удалено: {pendingDelete.title}
          </p>
          <button
            type="button"
            onClick={restoreDeletedItem}
            className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-black text-lime-900"
          >
            Вернуть
          </button>
        </div>
      )}
    </main>
  );
}
