"use client";

import { authorizedFetch } from "@/lib/authorizedFetch";
import { supabase } from "@/lib/supabaseClient";
import { findDuplicateWatchTitle, normalizeWatchTitle } from "@/lib/watchList";
import type { WatchSearchResult } from "@/lib/watchSearch";
import { ArrowLeft, Film, Search, Sparkles, Tv } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type ContentType = "movie" | "series" | "cartoon" | "anime";
type Couple = { id: string; partner_one_id: string; partner_two_id: string | null };
type WatchItem = { id: string; title: string; content_type: ContentType; is_watched: boolean };

const contentTypes: Array<{ key: ContentType; label: string }> = [
  { key: "movie", label: "Фильм" },
  { key: "series", label: "Сериал" },
  { key: "cartoon", label: "Мультфильм" },
  { key: "anime", label: "Аниме" },
];

function TypeIcon({ type }: { type: ContentType }) {
  const Icon = type === "series" ? Tv : type === "movie" ? Film : Sparkles;
  return <Icon aria-hidden="true" size={20} />;
}

function WatchResultPoster({ result }: { result: WatchSearchResult }) {
  const [failed, setFailed] = useState(false);

  if (!result.posterUrl || failed) {
    return (
      <span className="grid h-[4.5rem] w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-lime-200 to-emerald-100 text-lime-700 shadow-inner dark:from-lime-500/22 dark:to-emerald-500/12 dark:text-lime-100">
        <TypeIcon type={result.contentType} />
      </span>
    );
  }

  return (
    <Image
      src={result.posterUrl}
      alt={`Постер: ${result.title}`}
      width={96}
      height={144}
      sizes="48px"
      className="h-[4.5rem] w-12 shrink-0 rounded-xl object-cover shadow-sm"
      onError={() => setFailed(true)}
      unoptimized
    />
  );
}

export default function AddWatchPage() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [items, setItems] = useState<WatchItem[]>([]);
  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState<ContentType>("movie");
  const [selectedResult, setSelectedResult] = useState<WatchSearchResult | null>(null);
  const [results, setResults] = useState<WatchSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    document.title = "Добавить фильм · Couple Space";
    let ignore = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      const { data: coupleData } = await supabase
        .from("couples")
        .select("id, partner_one_id, partner_two_id")
        .or(`partner_one_id.eq.${user.id},partner_two_id.eq.${user.id}`)
        .limit(1)
        .maybeSingle<Couple>();
      if (!coupleData) { router.replace("/couple"); return; }
      const { data: watchData } = await supabase
        .from("watch_items")
        .select("id, title, content_type, is_watched")
        .eq("couple_id", coupleData.id);
      if (ignore) return;
      setCurrentUserId(user.id);
      setCouple(coupleData);
      setItems((watchData || []) as WatchItem[]);
    }

    void load();
    return () => { ignore = true; };
  }, [router]);

  useEffect(() => {
    const normalized = normalizeWatchTitle(title);
    if (normalized.length < 2) { setResults([]); setIsSearching(false); return; }
    let ignore = false;
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await authorizedFetch(`/api/watch/search?q=${encodeURIComponent(title.trim())}`);
        const payload = (await response.json().catch(() => null)) as { results?: WatchSearchResult[] } | null;
        if (!ignore) setResults(payload?.results || []);
      } catch {
        if (!ignore) setResults([]);
      } finally {
        if (!ignore) setIsSearching(false);
      }
    }, 320);
    return () => { ignore = true; window.clearTimeout(timer); };
  }, [title]);

  async function addItem(resultOverride?: WatchSearchResult) {
    if (!couple || !currentUserId || isSaving) return;
    const normalizedTitle = (resultOverride?.title || title).trim().replace(/\s+/g, " ");
    if (!normalizedTitle) { setMessage("Введите название."); return; }
    if (findDuplicateWatchTitle(items, normalizedTitle)) { setMessage("Такое название уже есть в списке."); return; }

    const selected = resultOverride || selectedResult;

    setIsSaving(true);
    const { error } = await supabase.from("watch_items").insert([{
      couple_id: couple.id,
      title: normalizedTitle,
      content_type: selected?.contentType || contentType,
      added_by: currentUserId,
      external_url: selected?.externalUrl || null,
      poster_url: selected?.posterUrl || null,
    }]);
    setIsSaving(false);
    if (error) { setMessage(error.code === "23505" ? "Такое название уже есть в списке." : "Не удалось добавить. Попробуйте ещё раз."); return; }
    router.push("/watch");
  }

  return (
    <main className="watch-create-page min-h-screen bg-[radial-gradient(circle_at_18%_10%,rgba(132,204,22,0.24),transparent_30%),linear-gradient(135deg,#f7fee7_0%,#ecfccb_52%,#f0fdf4_100%)] px-4 pb-28 pt-20 text-lime-950 dark:bg-[radial-gradient(circle_at_18%_10%,rgba(132,204,22,0.16),transparent_30%),linear-gradient(135deg,#0b1303_0%,#132006_52%,#071002_100%)] dark:text-white md:px-6 md:pt-28">
      <section className="mx-auto max-w-3xl">
        <button type="button" onClick={() => router.back()} className="inline-flex h-11 items-center gap-2 rounded-full border border-lime-300/70 bg-lime-100/90 px-4 text-sm font-black text-lime-800 shadow-sm dark:border-lime-300/20 dark:bg-lime-500/18 dark:text-lime-100"><ArrowLeft size={18} />Назад</button>
        <div className="mt-4 rounded-[2rem] border border-lime-200/80 bg-white/78 p-5 shadow-[0_28px_90px_rgba(77,124,15,0.18)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/8 md:p-8">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-lime-700/60 dark:text-lime-100/55">Новый вариант</p>
          <h1 className="mt-2 text-4xl font-black text-lime-900 dark:text-white">Добавить фильм</h1>
          <p className="mt-2 font-bold text-lime-900/55 dark:text-white/50">Найдите фильм или сериал — постер и ссылка добавятся автоматически.</p>

          <div className="relative mt-6">
            <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-4 text-lime-700/50" size={20} />
            <input
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setSelectedResult(null);
                setMessage("");
              }}
              onKeyDown={(event) => { if (event.key === "Enter") void addItem(); }}
              placeholder="Название фильма или сериала"
              className="h-13 w-full rounded-2xl border border-lime-300/70 bg-white/88 pl-12 pr-4 font-semibold text-lime-950 outline-none transition placeholder:text-lime-900/35 focus:border-lime-500 dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
          </div>

          {normalizeWatchTitle(title).length >= 2 && (
            <div className="mt-3 max-h-[min(24rem,46dvh)] overflow-y-auto rounded-[1.3rem] border border-lime-200/70 bg-white/88 p-2 shadow-inner dark:border-white/10 dark:bg-black/16">
              {isSearching ? <p className="p-3 text-sm font-black opacity-60">Ищем варианты…</p> : results.length ? results.map((result) => (
                <button key={`${result.contentType}-${result.id}`} type="button" disabled={isSaving} onClick={() => { setTitle(result.title); setContentType(result.contentType); setSelectedResult(result); setResults([]); void addItem(result); }} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition hover:bg-lime-100 disabled:cursor-wait disabled:opacity-55 dark:hover:bg-white/10">
                  <WatchResultPoster result={result} />
                  <span className="min-w-0"><strong className="block break-words">{result.title}</strong><span className="mt-1 block text-xs font-bold opacity-55">{result.subtitle || contentTypes.find((item) => item.key === result.contentType)?.label}</span></span>
                </button>
              )) : <p className="p-3 text-sm font-black opacity-60">Ничего не нашли. Название можно добавить вручную.</p>}
            </div>
          )}

          <label className="mt-5 block text-sm font-black text-lime-800 dark:text-lime-100">Тип</label>
          <select value={contentType} onChange={(event) => setContentType(event.target.value as ContentType)} className="mt-2 h-13 w-full rounded-2xl border border-lime-300/70 bg-white/88 px-4 font-black outline-none focus:border-lime-500 dark:border-white/10 dark:bg-black/20">
            {contentTypes.map((type) => <option key={type.key} value={type.key}>{type.label}</option>)}
          </select>

          {message && <p className="mt-4 text-sm font-black text-lime-800 dark:text-lime-100">{message}</p>}
          <button type="button" onClick={() => void addItem()} disabled={isSaving || !normalizeWatchTitle(title)} className="mt-6 w-full rounded-2xl bg-lime-600 px-6 py-4 font-black text-white shadow-lg transition hover:bg-lime-500 disabled:cursor-not-allowed disabled:opacity-45">{isSaving ? "Добавляем…" : "Добавить в список"}</button>
        </div>
      </section>
    </main>
  );
}
