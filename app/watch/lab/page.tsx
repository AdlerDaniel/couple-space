"use client";

import { authorizedFetch } from "@/lib/authorizedFetch";
import { findDuplicateWatchTitle, normalizeWatchTitle } from "@/lib/watchList";
import type { WatchSearchResult } from "@/lib/watchSearch";
import { supabase } from "@/lib/supabaseClient";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Film,
  ListFilter,
  Plus,
  Search,
  Shuffle,
  Sparkles,
  Trash2,
  Tv,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type ContentType = "movie" | "series" | "cartoon" | "anime";
type ListMode = "queue" | "watched";
type SortMode = "recent" | "title";

type Couple = {
  id: string;
  partner_one_id: string;
  partner_two_id: string | null;
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
  { key: "movie", label: "Фильмы" },
  { key: "series", label: "Сериалы" },
  { key: "cartoon", label: "Мультфильмы" },
  { key: "anime", label: "Аниме" },
];

function contentTypeLabel(type: ContentType) {
  if (type === "series") return "Сериал";
  if (type === "cartoon") return "Мультфильм";
  if (type === "anime") return "Аниме";
  return "Фильм";
}

function ContentIcon({ type, size = 18 }: { type: ContentType; size?: number }) {
  const Icon = type === "series" ? Tv : type === "movie" ? Film : Sparkles;
  return <Icon aria-hidden="true" size={size} strokeWidth={2.2} />;
}

function shuffled<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
  }
  return copy;
}

export default function WatchLabPage() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [items, setItems] = useState<WatchItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mode, setMode] = useState<ListMode>("queue");
  const [filter, setFilter] = useState<ContentType | "all">("all");
  const [sort, setSort] = useState<SortMode>("recent");
  const [query, setQuery] = useState("");
  const [winner, setWinner] = useState<WatchItem | null>(null);
  const [rouletteTitle, setRouletteTitle] = useState("Готовы довериться случаю?");
  const [isSpinning, setIsSpinning] = useState(false);
  const [shortlistIds, setShortlistIds] = useState<string[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<ContentType>("movie");
  const [selectedSearchResult, setSelectedSearchResult] = useState<WatchSearchResult | null>(null);
  const [searchResults, setSearchResults] = useState<WatchSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    document.title = "Кино-комната · Couple Space";
    let ignore = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

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

      const { data } = await supabase
        .from("watch_items")
        .select("*")
        .eq("couple_id", coupleData.id)
        .order("updated_at", { ascending: false });

      if (ignore) return;
      setCurrentUserId(user.id);
      setCouple(coupleData);
      setItems((data || []) as WatchItem[]);
      setIsLoading(false);
    }

    void load();
    return () => { ignore = true; };
  }, [router]);

  useEffect(() => {
    if (!couple?.id) return;
    const channel = supabase
      .channel(`watch-lab:${couple.id}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "watch_items", filter: `couple_id=eq.${couple.id}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const next = payload.new as WatchItem;
            setItems((current) => current.some((item) => item.id === next.id) ? current : [next, ...current]);
          }
          if (payload.eventType === "UPDATE") {
            const next = payload.new as WatchItem;
            setItems((current) => current.map((item) => item.id === next.id ? next : item));
            setWinner((current) => current?.id === next.id ? next : current);
          }
          if (payload.eventType === "DELETE") {
            const removed = payload.old as Pick<WatchItem, "id">;
            setItems((current) => current.filter((item) => item.id !== removed.id));
          }
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [couple?.id]);

  useEffect(() => {
    const normalized = normalizeWatchTitle(newTitle);
    if (normalized.length < 2 || !isAddOpen) {
      return;
    }

    let ignore = false;
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await authorizedFetch(`/api/watch/search?q=${encodeURIComponent(newTitle.trim())}`);
        const data = await response.json().catch(() => null) as { results?: WatchSearchResult[] } | null;
        if (!ignore) setSearchResults(data?.results || []);
      } catch {
        if (!ignore) setSearchResults([]);
      } finally {
        if (!ignore) setIsSearching(false);
      }
    }, 320);

    return () => {
      ignore = true;
      window.clearTimeout(timer);
    };
  }, [isAddOpen, newTitle]);

  const queue = useMemo(() => items.filter((item) => !item.is_watched), [items]);
  const watched = useMemo(() => items.filter((item) => item.is_watched), [items]);
  const filteredQueue = useMemo(
    () => queue.filter((item) => filter === "all" || item.content_type === filter),
    [filter, queue],
  );
  const visibleItems = useMemo(() => {
    const normalizedQuery = normalizeWatchTitle(query);
    const source = mode === "queue" ? queue : watched;
    const filtered = source.filter((item) =>
      (filter === "all" || item.content_type === filter)
      && (!normalizedQuery || normalizeWatchTitle(item.title).includes(normalizedQuery)),
    );
    return [...filtered].sort((first, second) =>
      sort === "title"
        ? first.title.localeCompare(second.title, "ru")
        : new Date(second.updated_at).getTime() - new Date(first.updated_at).getTime(),
    );
  }, [filter, mode, query, queue, sort, watched]);
  const shortlist = shortlistIds
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is WatchItem => Boolean(item && !item.is_watched));

  const spin = useCallback(() => {
    if (filteredQueue.length === 0 || isSpinning) return;
    setIsSpinning(true);
    setWinner(null);
    let ticks = 0;
    const timer = window.setInterval(() => {
      const preview = filteredQueue[Math.floor(Math.random() * filteredQueue.length)];
      setRouletteTitle(preview.title);
      ticks += 1;
      if (ticks >= 18) {
        window.clearInterval(timer);
        const selected = filteredQueue[Math.floor(Math.random() * filteredQueue.length)];
        setWinner(selected);
        setRouletteTitle(selected.title);
        setIsSpinning(false);
      }
    }, 85);
  }, [filteredQueue, isSpinning]);

  function createShortlist() {
    setShortlistIds(shuffled(filteredQueue).slice(0, 3).map((item) => item.id));
    setNotice(filteredQueue.length ? "Собрали короткий список на вечер." : "В этом фильтре пока ничего нет.");
  }

  async function addItem() {
    if (!couple || !currentUserId || isSaving) return;
    const title = newTitle.trim().replace(/\s+/g, " ");
    if (!title) return;
    if (findDuplicateWatchTitle(items, title)) {
      setNotice("Это название уже есть в вашей коллекции.");
      return;
    }

    setIsSaving(true);
    const { data, error } = await supabase
      .from("watch_items")
      .insert([{
        couple_id: couple.id,
        added_by: currentUserId,
        title,
        content_type: selectedSearchResult?.contentType || newType,
        external_url: selectedSearchResult?.externalUrl || null,
        poster_url: selectedSearchResult?.posterUrl || null,
      }])
      .select("*")
      .single();

    if (error || !data) {
      setNotice("Не удалось добавить. Попробуйте ещё раз.");
    } else {
      setItems((current) => current.some((item) => item.id === data.id) ? current : [data as WatchItem, ...current]);
      setNewTitle("");
      setSearchResults([]);
      setSelectedSearchResult(null);
      setIsAddOpen(false);
      setMode("queue");
      setNotice("Добавлено в общую коллекцию.");
    }
    setIsSaving(false);
  }

  async function markWatched(item: WatchItem) {
    const changedAt = new Date().toISOString();
    setItems((current) => current.map((row) => row.id === item.id
      ? { ...row, is_watched: true, watched_at: changedAt, updated_at: changedAt }
      : row));
    const { error } = await supabase
      .from("watch_items")
      .update({ is_watched: true, watched_at: changedAt, updated_at: changedAt })
      .eq("id", item.id);
    if (error) setNotice("Не удалось перенести в просмотренные.");
  }

  async function deleteItem(item: WatchItem) {
    if (!window.confirm(`Удалить «${item.title}» из общего списка?`)) return;
    const previous = items;
    setItems((current) => current.filter((row) => row.id !== item.id));
    const { error } = await supabase.from("watch_items").delete().eq("id", item.id);
    if (error) {
      setItems(previous);
      setNotice("Не удалось удалить элемент.");
    }
  }

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#120f1b] px-5 text-white">
        <div className="rounded-full border border-white/10 bg-white/6 px-6 py-3 font-black">Открываем кино-комнату…</div>
      </main>
    );
  }

  return (
    <main className="watch-lab-page min-h-screen overflow-hidden bg-[#f8f4ff] px-4 pb-28 pt-24 text-[#21162f] dark:bg-[#0d0914] dark:text-white md:px-6 md:pt-28">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_12%_12%,rgba(168,85,247,0.18),transparent_28%),radial-gradient(circle_at_88%_18%,rgba(251,146,60,0.2),transparent_25%),linear-gradient(145deg,#fbf8ff_0%,#fff8ef_52%,#f6f1ff_100%)] dark:bg-[radial-gradient(circle_at_12%_12%,rgba(168,85,247,0.2),transparent_28%),radial-gradient(circle_at_88%_18%,rgba(249,115,22,0.15),transparent_25%),linear-gradient(145deg,#0d0914_0%,#17101f_52%,#0b0810_100%)]" />

      <section className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-violet-600 dark:text-violet-300">Экспериментальная версия</p>
            <h1 className="mt-2 text-4xl font-black leading-none sm:text-5xl md:text-6xl">Кино-комната</h1>
            <p className="mt-3 max-w-2xl font-semibold text-[#5c5069] dark:text-white/55">Выберите настроение, соберите три варианта или отдайте решение рулетке.</p>
          </div>
          <button type="button" onClick={() => setIsAddOpen(true)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#21162f] px-6 font-black text-white shadow-[0_16px_40px_rgba(33,22,47,0.22)] transition hover:-translate-y-0.5 dark:bg-orange-400 dark:text-[#1d1027]">
            <Plus size={19} aria-hidden="true" /> Добавить
          </button>
        </header>

        <div className="mt-5 flex flex-wrap gap-2">
          <span className="watch-lab-stat"><strong>{queue.length}</strong> ждут вечера</span>
          <span className="watch-lab-stat"><strong>{watched.length}</strong> уже посмотрели</span>
          <span className="watch-lab-stat"><strong>{items.length}</strong> всего в коллекции</span>
        </div>

        <section className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.55fr)]">
          <article className="watch-lab-roulette overflow-hidden rounded-[2rem] bg-[#21162f] p-5 text-white shadow-[0_30px_90px_rgba(65,35,92,0.28)] sm:p-7">
            <div className="grid items-center gap-7 md:grid-cols-[17rem_minmax(0,1fr)]">
              <div className="relative mx-auto">
                <span className="watch-lab-pointer" aria-hidden="true" />
                <div className={`watch-lab-wheel grid h-64 w-64 place-items-center rounded-full ${isSpinning ? "is-spinning" : ""}`}>
                  <span className="grid h-20 w-20 place-items-center rounded-full bg-[#21162f] text-orange-300 shadow-2xl ring-8 ring-white/12"><Shuffle size={30} /></span>
                </div>
              </div>
              <div className="min-w-0 text-center md:text-left">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-300">Выбор вечера</p>
                <h2 className="mt-3 break-words text-3xl font-black leading-tight sm:text-4xl">{rouletteTitle}</h2>
                <p className="mt-3 text-sm font-semibold leading-6 text-white/55">Рулетка учитывает выбранный ниже тип контента. Сейчас доступно вариантов: {filteredQueue.length}.</p>
                <button type="button" onClick={spin} disabled={!filteredQueue.length || isSpinning} className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-orange-400 px-7 font-black text-[#21162f] transition hover:-translate-y-0.5 disabled:opacity-40">
                  <Sparkles size={18} /> {isSpinning ? "Выбираем…" : "Крутить"}
                </button>
                {winner && <Link href={`/watch/${winner.id}`} className="ml-3 inline-flex min-h-12 items-center gap-2 rounded-full border border-white/15 px-5 font-black text-white/85"><ArrowUpRight size={17} /> Подробнее</Link>}
              </div>
            </div>
          </article>

          <aside className="rounded-[2rem] border border-violet-200/60 bg-white/72 p-5 shadow-[0_24px_70px_rgba(91,33,182,0.1)] backdrop-blur-xl dark:border-white/10 dark:bg-white/6">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300">Три кандидата</p><h2 className="mt-1 text-2xl font-black">Шорт-лист</h2></div>
              <button type="button" onClick={createShortlist} aria-label="Обновить шорт-лист" className="grid h-11 w-11 place-items-center rounded-full bg-violet-100 text-violet-700 transition hover:rotate-12 dark:bg-violet-400/15 dark:text-violet-200"><Shuffle size={19} /></button>
            </div>
            <div className="mt-4 space-y-2">
              {shortlist.length ? shortlist.map((item, index) => (
                <button key={item.id} type="button" onClick={() => { setWinner(item); setRouletteTitle(item.title); }} className="flex w-full items-center gap-3 rounded-2xl bg-[#f5effb] p-3 text-left transition hover:-translate-y-0.5 hover:bg-violet-100 dark:bg-white/6 dark:hover:bg-white/10">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white font-black text-violet-700 shadow-sm dark:bg-white/10 dark:text-violet-200">{index + 1}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate font-black">{item.title}</span><span className="mt-0.5 block text-xs font-semibold opacity-45">{contentTypeLabel(item.content_type)}</span></span>
                </button>
              )) : <div className="rounded-2xl border border-dashed border-violet-200 p-5 text-center text-sm font-semibold opacity-55 dark:border-white/12">Нажмите перемешать — здесь появятся три варианта.</div>}
            </div>
          </aside>
        </section>

        <section className="mt-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex rounded-full bg-white/70 p-1 shadow-sm ring-1 ring-violet-100 dark:bg-white/6 dark:ring-white/10">
              <button type="button" onClick={() => setMode("queue")} className={`rounded-full px-5 py-2.5 text-sm font-black ${mode === "queue" ? "bg-[#21162f] text-white dark:bg-orange-400 dark:text-[#21162f]" : "opacity-55"}`}>В планах · {queue.length}</button>
              <button type="button" onClick={() => setMode("watched")} className={`rounded-full px-5 py-2.5 text-sm font-black ${mode === "watched" ? "bg-[#21162f] text-white dark:bg-orange-400 dark:text-[#21162f]" : "opacity-55"}`}>Архив · {watched.length}</button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="flex min-h-11 items-center gap-2 rounded-full border border-violet-200/60 bg-white/72 px-4 dark:border-white/10 dark:bg-white/6">
                <Search size={17} className="opacity-40" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти в коллекции" className="min-w-0 bg-transparent text-sm font-bold outline-none placeholder:opacity-35" />
              </label>
              <label className="flex min-h-11 items-center gap-2 rounded-full border border-violet-200/60 bg-white/72 px-4 dark:border-white/10 dark:bg-white/6"><ListFilter size={17} className="opacity-40" /><select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="bg-transparent text-sm font-black outline-none"><option value="recent">Сначала новые</option><option value="title">По названию</option></select><ChevronDown size={15} className="opacity-35" /></label>
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
            <button type="button" onClick={() => setFilter("all")} className={`watch-lab-filter ${filter === "all" ? "is-active" : ""}`}>Все</button>
            {contentTypes.map((type) => <button key={type.key} type="button" onClick={() => setFilter(type.key)} className={`watch-lab-filter ${filter === type.key ? "is-active" : ""}`}>{type.label}</button>)}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {visibleItems.map((item) => (
              <article key={item.id} className="group min-w-0 overflow-hidden rounded-[1.4rem] border border-violet-100 bg-white/76 p-2.5 shadow-[0_18px_55px_rgba(74,37,107,0.1)] transition hover:-translate-y-1 dark:border-white/10 dark:bg-white/6">
                <Link href={`/watch/${item.id}`} className="block">
                  <div className="relative aspect-[2/3] overflow-hidden rounded-[1rem] bg-gradient-to-br from-violet-200 to-orange-100 bg-cover bg-center dark:from-violet-900 dark:to-orange-950" style={item.poster_url ? { backgroundImage: `url("${item.poster_url}")` } : undefined}>
                    {!item.poster_url && <span className="grid h-full place-items-center text-violet-700 dark:text-violet-200"><ContentIcon type={item.content_type} size={38} /></span>}
                    <span className="absolute left-2 top-2 rounded-full bg-black/58 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white backdrop-blur-md">{contentTypeLabel(item.content_type)}</span>
                  </div>
                  <h3 className="mt-3 line-clamp-2 min-h-11 break-words text-base font-black leading-snug">{item.title}</h3>
                </Link>
                <div className="mt-2 flex gap-1.5">
                  {!item.is_watched && <button type="button" onClick={() => void markWatched(item)} aria-label={`Отметить «${item.title}» просмотренным`} className="grid h-9 flex-1 place-items-center rounded-xl bg-emerald-100 text-emerald-700 transition hover:bg-emerald-200 dark:bg-emerald-400/14 dark:text-emerald-200"><Check size={17} /></button>}
                  {item.external_url && <a href={item.external_url} target="_blank" rel="noreferrer" aria-label={`Открыть ссылку для «${item.title}»`} className="grid h-9 flex-1 place-items-center rounded-xl bg-violet-100 text-violet-700 transition hover:bg-violet-200 dark:bg-violet-400/14 dark:text-violet-200"><ArrowUpRight size={17} /></a>}
                  <button type="button" onClick={() => void deleteItem(item)} aria-label={`Удалить «${item.title}»`} className="grid h-9 flex-1 place-items-center rounded-xl bg-rose-50 text-rose-500 transition hover:bg-rose-100 dark:bg-rose-400/10 dark:text-rose-200"><Trash2 size={16} /></button>
                </div>
              </article>
            ))}
          </div>
          {visibleItems.length === 0 && <div className="mt-4 rounded-[1.5rem] border border-dashed border-violet-200 bg-white/45 p-8 text-center font-bold opacity-60 dark:border-white/12 dark:bg-white/4">По этим условиям ничего не найдено.</div>}
        </section>
      </section>

      {isAddOpen && <button type="button" className="fixed inset-0 z-50 bg-[#120b1d]/55 backdrop-blur-sm" onClick={() => setIsAddOpen(false)} aria-label="Закрыть форму" />}
      {isAddOpen && (
        <section role="dialog" aria-modal="true" aria-labelledby="watch-lab-add-title" className="fixed bottom-0 left-0 right-0 z-[60] mx-auto max-h-[85dvh] max-w-2xl overflow-y-auto rounded-t-[2rem] bg-[#fbf8ff] p-5 text-[#21162f] shadow-2xl dark:bg-[#17101f] dark:text-white sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:w-[calc(100%-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[2rem] sm:p-7">
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-violet-600 dark:text-violet-300">В общую коллекцию</p><h2 id="watch-lab-add-title" className="mt-1 text-3xl font-black">Добавить вариант</h2></div><button type="button" onClick={() => setIsAddOpen(false)} className="grid h-11 w-11 place-items-center rounded-full bg-violet-100 text-violet-700 dark:bg-white/8 dark:text-white"><X size={20} /></button></div>
          <div className="relative mt-5">
            <input autoFocus value={newTitle} onChange={(event) => { const nextTitle = event.target.value; setNewTitle(nextTitle); setSelectedSearchResult(null); if (normalizeWatchTitle(nextTitle).length < 2) setSearchResults([]); }} placeholder="Начните вводить название…" className="min-h-13 w-full rounded-2xl border border-violet-200 bg-white px-4 font-bold outline-none focus:border-violet-500 dark:border-white/10 dark:bg-white/6" />
            {(isSearching || searchResults.length > 0) && <div className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-2xl border border-violet-100 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-[#21162f]">{isSearching && <p className="p-3 text-sm font-bold opacity-50">Ищем…</p>}{searchResults.map((result) => <button key={`${result.contentType}-${result.id}`} type="button" onClick={() => { setNewTitle(result.title); setNewType(result.contentType); setSelectedSearchResult(result); setSearchResults([]); }} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-violet-50 dark:hover:bg-white/8">{result.posterUrl ? <span className="h-14 w-10 shrink-0 rounded-lg bg-cover bg-center" style={{ backgroundImage: `url("${result.posterUrl}")` }} /> : <span className="grid h-14 w-10 shrink-0 place-items-center rounded-lg bg-violet-100 text-violet-700"><ContentIcon type={result.contentType} /></span>}<span className="min-w-0"><strong className="block truncate">{result.title}</strong><span className="text-xs font-semibold opacity-45">{result.subtitle || contentTypeLabel(result.contentType)}</span></span></button>)}</div>}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{contentTypes.map((type) => <button key={type.key} type="button" onClick={() => { setNewType(type.key); setSelectedSearchResult(null); }} className={`rounded-xl px-3 py-2.5 text-sm font-black ${newType === type.key ? "bg-violet-600 text-white" : "bg-violet-100 text-violet-700 dark:bg-white/8 dark:text-white/65"}`}>{type.label}</button>)}</div>
          <button type="button" onClick={() => void addItem()} disabled={!normalizeWatchTitle(newTitle) || isSaving} className="mt-5 w-full rounded-full bg-[#21162f] px-6 py-3.5 font-black text-white disabled:opacity-40 dark:bg-orange-400 dark:text-[#21162f]">{isSaving ? "Добавляем…" : "Добавить в коллекцию"}</button>
        </section>
      )}

      {notice && <button type="button" onClick={() => setNotice("")} className="fixed bottom-24 left-1/2 z-40 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-full bg-[#21162f] px-5 py-3 text-sm font-black text-white shadow-2xl dark:bg-orange-400 dark:text-[#21162f]">{notice}</button>}
    </main>
  );
}
