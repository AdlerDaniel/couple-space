"use client";

import AppSkeleton from "@/components/AppSkeleton";
import EmptyState from "@/components/EmptyState";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type ContentType = "movie" | "series" | "cartoon" | "anime";

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

const accent = "#65a30d";

function getContentTypeLabel(type: ContentType) {
  if (type === "series") return "Сериал";
  if (type === "cartoon") return "Мультфильм";
  if (type === "anime") return "Аниме";
  return "Фильм";
}

function formatDate(value: string | null) {
  if (!value) return "ещё не смотрели";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

export default function WatchDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<WatchItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadItem() {
      const { data, error } = await supabase
        .from("watch_items")
        .select("*")
        .eq("id", params.id)
        .limit(1)
        .maybeSingle<WatchItem>();

      if (ignore) return;
      if (error || !data) {
        setItem(null);
        document.title = "Детали просмотра | Couple Space";
      } else {
        setItem(data);
        document.title = `${data.title} | Couple Space`;
      }
      setIsLoading(false);
    }

    loadItem();

    return () => {
      ignore = true;
    };
  }, [params.id]);

  async function markWatched() {
    if (!item) return;
    const updatedAt = new Date().toISOString();
    setItem({ ...item, is_watched: true, watched_at: updatedAt, updated_at: updatedAt });

    const { error } = await supabase
      .from("watch_items")
      .update({ is_watched: true, watched_at: updatedAt, updated_at: updatedAt })
      .eq("id", item.id);

    setMessage(error ? "Не удалось отметить просмотренным." : "Отмечено как просмотренное.");
  }

  async function deleteItem() {
    if (!item) return;
    const { error } = await supabase.from("watch_items").delete().eq("id", item.id);
    if (error) {
      setMessage("Не удалось удалить элемент.");
      return;
    }
    router.push("/watch");
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#f7fee7] px-4 pb-28 pt-24 text-lime-950 dark:bg-[#0b1303] dark:text-white md:px-6 md:pt-28">
        <section className="mx-auto max-w-3xl">
          <AppSkeleton rows={5} accent={accent} />
        </section>
      </main>
    );
  }

  if (!item) {
    return (
      <main className="min-h-screen bg-[#f7fee7] px-4 pb-28 pt-24 text-lime-950 dark:bg-[#0b1303] dark:text-white md:px-6 md:pt-28">
        <section className="mx-auto max-w-3xl">
          <EmptyState
            icon="▶"
            title="Элемент не найден"
            text="Возможно, его удалили или у вас нет доступа к этому списку."
            actionHref="/watch"
            actionLabel="Вернуться к списку"
            accent={accent}
          />
        </section>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen bg-[#f7fee7] px-4 pb-28 pt-24 text-lime-950 dark:bg-[#0b1303] dark:text-white md:px-6 md:pt-28"
      style={{ ["--scroll-accent" as string]: accent }}
    >
      <section className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="ui-card overflow-hidden p-4 md:p-5">
          {item.poster_url ? (
            <div
              className="aspect-[3/4] rounded-[1.5rem] bg-lime-100 bg-cover bg-center shadow-inner dark:bg-white/8"
              style={{ backgroundImage: `url("${item.poster_url}")` }}
            />
          ) : (
            <div className="grid aspect-[3/4] place-items-center rounded-[1.5rem] bg-lime-100 text-7xl shadow-inner dark:bg-white/8">
              ▶
            </div>
          )}
        </div>

        <div className="ui-card p-5 md:p-7">
          <p className="ui-eyebrow">{getContentTypeLabel(item.content_type)}</p>
          <h1 className="ui-section-title mt-3 break-words text-4xl md:text-6xl">{item.title}</h1>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="ui-chip">{item.is_watched ? "Уже посмотрели" : "Хотим посмотреть"}</span>
            <span className="ui-chip">Добавлено: {formatDate(item.created_at)}</span>
            {item.is_watched && <span className="ui-chip">Просмотр: {formatDate(item.watched_at)}</span>}
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {!item.is_watched && (
              <button type="button" onClick={markWatched} className="ui-button">
                Отметить просмотренным
              </button>
            )}
            {item.external_url && (
              <a href={item.external_url} target="_blank" rel="noreferrer" className="ui-button-secondary">
                Открыть ссылку
              </a>
            )}
            <Link href="/watch" className="ui-button-secondary">
              Назад к списку
            </Link>
            <button type="button" onClick={deleteItem} className="ui-button-secondary">
              Удалить
            </button>
          </div>

          {message && <p className="mt-5 rounded-2xl bg-white/60 p-3 font-black shadow-inner dark:bg-white/8">{message}</p>}

          <div className="mt-7 rounded-[1.5rem] bg-white/45 p-5 shadow-inner dark:bg-white/8">
            <p className="font-black">Идея для вечера</p>
            <p className="ui-muted mt-2 leading-7">
              Откройте этот экран перед просмотром: здесь видно статус, дату добавления и можно сразу отметить результат.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
