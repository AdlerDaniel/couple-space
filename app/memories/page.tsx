"use client";

import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const PAGE_SIZE = 12;
const reactions = ["❤️", "😂", "🥺", "👍", "😮"];

type Couple = {
  id: string;
  partner_one_id: string;
  partner_two_id: string | null;
};

type Memory = {
  id: string;
  title: string | null;
  caption: string | null;
  text: string | null;
  image: string | null;
  event_date: string | null;
  is_pinned: boolean;
  reactions?: Record<string, string>;
  user_id: string;
  couple_id: string;
  created_at: string;
};

type MemoryComment = {
  id: string;
  memory_id: string;
  user_id: string;
  text: string;
  created_at: string;
};

function formatDate(date?: string | null) {
  if (!date) return "Дата не указана";
  return new Date(date).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(date: string) {
  return new Date(date).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MemoriesPage() {
  const router = useRouter();
  const loaderRef = useRef<HTMLDivElement | null>(null);
  const touchStartX = useRef<number | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [memoryImage, setMemoryImage] = useState<string | null>(null);
  const [memoryImageFile, setMemoryImageFile] = useState<File | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [comments, setComments] = useState<Record<string, MemoryComment[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<"all" | "pinned">("all");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function loadMemories() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setCurrentUserId(user.id);

      const { data: coupleData, error: coupleError } = await supabase
        .from("couples")
        .select("*")
        .or(`partner_one_id.eq.${user.id},partner_two_id.eq.${user.id}`)
        .limit(1)
        .single();

      if (coupleError || !coupleData) {
        router.push("/couple");
        return;
      }

      setCouple(coupleData);

      const [{ data: memoryRows }, { data: commentRows }] = await Promise.all([
        supabase
          .from("memories")
          .select("*")
          .eq("couple_id", coupleData.id)
          .order("is_pinned", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("memory_comments")
          .select("id, memory_id, user_id, text, created_at")
          .eq("couple_id", coupleData.id)
          .order("created_at", { ascending: true }),
      ]);

      setMemories((memoryRows || []) as Memory[]);
      setComments(
        (commentRows || []).reduce<Record<string, MemoryComment[]>>((groups, comment) => {
          groups[comment.memory_id] = [...(groups[comment.memory_id] || []), comment];
          return groups;
        }, {})
      );
      setIsLoading(false);
    }

    loadMemories();
  }, [router]);

  useEffect(() => {
    const loader = loaderRef.current;
    if (!loader) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        setVisibleCount((current) => current + PAGE_SIZE);
      }
    });

    observer.observe(loader);
    return () => observer.disconnect();
  }, []);

  const filteredMemories = useMemo(() => {
    return activeTab === "pinned"
      ? memories.filter((memory) => memory.is_pinned)
      : memories;
  }, [activeTab, memories]);

  const visibleMemories = filteredMemories.slice(0, visibleCount);
  const selectedMemory =
    selectedIndex === null ? null : visibleMemories[selectedIndex] || null;

  async function addMemory() {
    if (!couple || !currentUserId || (!title.trim() && !caption.trim() && !memoryImageFile)) {
      return;
    }

    setIsSubmitting(true);
    let imageUrl: string | null = null;

    if (memoryImageFile) {
      const filePath = `${couple.id}/${crypto.randomUUID()}-${memoryImageFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("memory-images")
        .upload(filePath, memoryImageFile, { upsert: true });

      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage
          .from("memory-images")
          .getPublicUrl(filePath);
        imageUrl = publicUrlData.publicUrl;
      }
    }

    const { data, error } = await supabase
      .from("memories")
      .insert([
        {
          title: title.trim() || "Без названия",
          caption: caption.trim() || null,
          text: caption.trim() || null,
          event_date: eventDate || null,
          image: imageUrl,
          user_id: currentUserId,
          couple_id: couple.id,
        },
      ])
      .select()
      .single();

    if (!error && data) {
      setMemories((current) => [data as Memory, ...current]);
      setTitle("");
      setCaption("");
      setEventDate("");
      setMemoryImage(null);
      setMemoryImageFile(null);
    }

    setIsSubmitting(false);
  }

  async function togglePinned(memory: Memory) {
    const { data, error } = await supabase
      .from("memories")
      .update({ is_pinned: !memory.is_pinned })
      .eq("id", memory.id)
      .select()
      .single();

    if (!error && data) {
      setMemories((current) =>
        current.map((item) => (item.id === memory.id ? (data as Memory) : item))
      );
    }
  }

  async function toggleReaction(memory: Memory, reaction: string) {
    if (!currentUserId) return;

    const nextReactions = {
      ...(memory.reactions || {}),
      [currentUserId]: memory.reactions?.[currentUserId] === reaction ? undefined : reaction,
    };

    if (!nextReactions[currentUserId]) {
      delete nextReactions[currentUserId];
    }

    const { data, error } = await supabase
      .from("memories")
      .update({ reactions: nextReactions })
      .eq("id", memory.id)
      .select()
      .single();

    if (!error && data) {
      setMemories((current) =>
        current.map((item) => (item.id === memory.id ? (data as Memory) : item))
      );
    }
  }

  async function addComment(memory: Memory) {
    if (!couple || !currentUserId) return;
    const text = commentDrafts[memory.id]?.trim();
    if (!text) return;

    const { data, error } = await supabase
      .from("memory_comments")
      .insert([
        {
          memory_id: memory.id,
          couple_id: couple.id,
          user_id: currentUserId,
          text,
        },
      ])
      .select()
      .single();

    if (!error && data) {
      setComments((current) => ({
        ...current,
        [memory.id]: [...(current[memory.id] || []), data as MemoryComment],
      }));
      setCommentDrafts((current) => ({ ...current, [memory.id]: "" }));
    }
  }

  function openRandomMemory() {
    if (visibleMemories.length === 0) return;
    setSelectedIndex(Math.floor(Math.random() * visibleMemories.length));
  }

  function showNextMemory(direction: 1 | -1) {
    setSelectedIndex((current) => {
      if (current === null || visibleMemories.length === 0) return current;
      return (current + direction + visibleMemories.length) % visibleMemories.length;
    });
  }

  function handleTouchEnd(endX: number) {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - endX;
    if (Math.abs(diff) > 40) {
      showNextMemory(diff > 0 ? 1 : -1);
    }
    touchStartX.current = null;
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#eef6ff] px-6 pb-24 pt-28 text-[#0f3b66] transition-colors dark:bg-[#02101d] dark:text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(26,115,232,0.2),transparent_34%),radial-gradient(circle_at_82%_20%,rgba(20,184,166,0.14),transparent_30%),linear-gradient(135deg,#eef6ff_0%,#f8fbff_48%,#e9f5ff_100%)] dark:bg-[radial-gradient(circle_at_18%_12%,rgba(26,115,232,0.16),transparent_34%),radial-gradient(circle_at_82%_20%,rgba(20,184,166,0.12),transparent_30%),linear-gradient(135deg,#02101d_0%,#071f35_48%,#02101d_100%)]" />
      <div className="memories-grain pointer-events-none absolute inset-0 opacity-[0.16]" />

      <section className="relative mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-[#1a73e8]/70 dark:text-blue-200/70">
              Воспоминания
            </p>
            <h1 className="mt-3 text-5xl font-black text-[#1a73e8] dark:text-white md:text-7xl">
              Моменты пары
            </h1>
          </div>
          <button
            onClick={openRandomMemory}
            className="rounded-full bg-gradient-to-r from-[#1a73e8] to-[#14b8a6] px-6 py-3 font-black text-white shadow-[0_18px_55px_rgba(26,115,232,0.28)] transition hover:-translate-y-0.5"
          >
            Случайное воспоминание
          </button>
        </div>

        <div className="mb-10 rounded-[2rem] border border-white/70 bg-white/50 p-5 shadow-[0_28px_90px_rgba(26,115,232,0.16)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/8">
          <div className="grid gap-4 md:grid-cols-2">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Заголовок воспоминания"
              className="rounded-2xl border border-blue-200/70 bg-white/75 px-5 py-4 font-bold text-blue-950 outline-none focus:border-blue-400 dark:border-white/10 dark:bg-white/8 dark:text-white"
            />
            <input
              type="date"
              value={eventDate}
              onChange={(event) => setEventDate(event.target.value)}
              className="rounded-2xl border border-blue-200/70 bg-white/75 px-5 py-4 font-bold text-blue-950 outline-none focus:border-blue-400 dark:border-white/10 dark:bg-white/8 dark:text-white"
            />
          </div>
          <textarea
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Описание или подпись к воспоминанию..."
            className="mt-4 min-h-28 w-full resize-none rounded-2xl border border-blue-200/70 bg-white/75 px-5 py-4 font-semibold leading-7 text-blue-950 outline-none focus:border-blue-400 dark:border-white/10 dark:bg-white/8 dark:text-white"
          />
          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <label className="cursor-pointer rounded-2xl border border-blue-200/70 bg-white/70 px-5 py-4 font-black text-[#1a73e8] shadow-lg transition hover:bg-white/90 dark:border-white/10 dark:bg-white/8 dark:text-blue-100">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setMemoryImageFile(file);
                  setMemoryImage(URL.createObjectURL(file));
                }}
              />
              Выбрать hero photo
            </label>
            <button
              onClick={addMemory}
              disabled={isSubmitting}
              className="rounded-full bg-[#1a73e8] px-7 py-4 font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-50"
            >
              {isSubmitting ? "Сохраняем..." : "Добавить воспоминание"}
            </button>
          </div>
          {memoryImage && (
            <img
              src={memoryImage}
              alt="Preview"
              className="mt-5 h-64 w-full rounded-[1.5rem] object-cover shadow-2xl"
            />
          )}
        </div>

        <div className="mb-8 flex gap-3">
          {[
            ["all", "Все воспоминания"],
            ["pinned", "Закреплённые"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as "all" | "pinned")}
              className={`rounded-full px-5 py-3 font-black shadow-lg transition ${
                activeTab === key
                  ? "bg-[#1a73e8] text-white"
                  : "border border-white/70 bg-white/55 text-[#1a73e8] dark:border-white/10 dark:bg-white/8 dark:text-blue-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="columns-1 gap-5 md:columns-2 xl:columns-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="mb-5 h-80 break-inside-avoid rounded-[2rem] bg-white/50 shadow-xl backdrop-blur-xl dark:bg-white/8"
              />
            ))}
          </div>
        ) : visibleMemories.length === 0 ? (
          <div className="rounded-[2rem] bg-white/50 p-10 text-center shadow-xl backdrop-blur-xl dark:bg-white/8">
            <p className="text-2xl font-black">Пока нет воспоминаний</p>
          </div>
        ) : (
          <div className="columns-1 gap-5 md:columns-2 xl:columns-3">
            {visibleMemories.map((memory, index) => {
              const isLoaded = !memory.image || loadedImages[memory.id];
              const author = memory.user_id === currentUserId ? "Вы" : "Партнёр";

              return (
                <article
                  key={memory.id}
                  className="group mb-5 break-inside-avoid overflow-hidden rounded-[1.8rem] border border-white/70 bg-white/72 p-3 shadow-[0_24px_80px_rgba(26,115,232,0.16)] backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-[0_30px_110px_rgba(26,115,232,0.28)] dark:border-white/10 dark:bg-white/8"
                >
                  <div className="relative overflow-hidden rounded-[1.35rem] bg-blue-100 dark:bg-white/8">
                    {memory.image && (
                      <>
                        {!isLoaded && (
                          <div className="absolute inset-0 animate-pulse bg-blue-100 blur-xl dark:bg-white/10" />
                        )}
                        <img
                          src={memory.image}
                          alt={memory.title || "Воспоминание"}
                          onLoad={() =>
                            setLoadedImages((current) => ({ ...current, [memory.id]: true }))
                          }
                          onClick={() => setSelectedIndex(index)}
                          className={`h-auto min-h-72 w-full cursor-zoom-in object-cover transition duration-500 group-hover:scale-105 ${
                            isLoaded ? "blur-0" : "blur-md"
                          }`}
                        />
                      </>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-4 text-white opacity-0 transition group-hover:opacity-100">
                      <p className="font-black">{memory.title || "Без названия"}</p>
                    </div>
                  </div>

                  <div className="p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-[#1a73e8] dark:bg-white/10 dark:text-blue-100">
                        {memory.is_pinned ? "Закреплено" : "Polaroid"}
                      </span>
                      <button
                        onClick={() => togglePinned(memory)}
                        className="rounded-full bg-white/70 px-3 py-1 text-xs font-black text-[#1a73e8] shadow dark:bg-white/10 dark:text-blue-100"
                      >
                        {memory.is_pinned ? "Открепить" : "Закрепить"}
                      </button>
                    </div>
                    <h2 className="text-2xl font-black text-[#0f3b66] dark:text-white">
                      {memory.title || "Без названия"}
                    </h2>
                    <p className="mt-2 font-semibold leading-7 text-[#0f3b66]/70 dark:text-white/62">
                      {memory.caption || memory.text || "Без описания"}
                    </p>
                    <div className="mt-4 grid gap-2 text-sm font-bold text-[#0f3b66]/58 dark:text-white/45">
                      <span>Дата события: {formatDate(memory.event_date)}</span>
                      <span>Загрузил: {author}</span>
                      <span>Время загрузки: {formatTime(memory.created_at)}</span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {reactions.map((reaction) => (
                        <button
                          key={reaction}
                          onClick={() => toggleReaction(memory, reaction)}
                          className={`grid h-9 w-9 place-items-center rounded-full border text-lg transition hover:-translate-y-0.5 ${
                            memory.reactions?.[currentUserId || ""] === reaction
                              ? "border-blue-300 bg-blue-100"
                              : "border-white/70 bg-white/65 dark:border-white/10 dark:bg-white/8"
                          }`}
                        >
                          {reaction}
                        </button>
                      ))}
                    </div>

                    <div className="mt-4 rounded-2xl bg-blue-50/70 p-3 dark:bg-white/8">
                      <p className="mb-2 text-sm font-black text-[#1a73e8] dark:text-blue-100">
                        Комментарии
                      </p>
                      <div className="space-y-2">
                        {(comments[memory.id] || []).map((comment) => (
                          <div key={comment.id} className="rounded-xl bg-white/70 p-2 text-sm font-semibold dark:bg-black/18">
                            <span className="font-black">
                              {comment.user_id === currentUserId ? "Вы" : "Партнёр"}:
                            </span>{" "}
                            {comment.text}
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <input
                          value={commentDrafts[memory.id] || ""}
                          onChange={(event) =>
                            setCommentDrafts((current) => ({
                              ...current,
                              [memory.id]: event.target.value,
                            }))
                          }
                          placeholder="Комментарий..."
                          className="min-w-0 flex-1 rounded-full bg-white/80 px-4 py-2 text-sm font-semibold outline-none dark:bg-white/10"
                        />
                        <button
                          onClick={() => addComment(memory)}
                          className="rounded-full bg-[#1a73e8] px-4 py-2 text-sm font-black text-white"
                        >
                          Отправить
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div ref={loaderRef} className="h-12" />
      </section>

      {selectedMemory && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/82 p-5 backdrop-blur-xl"
          onTouchStart={(event) => {
            touchStartX.current = event.touches[0]?.clientX || null;
          }}
          onTouchEnd={(event) => {
            handleTouchEnd(event.changedTouches[0]?.clientX || 0);
          }}
        >
          <button
            onClick={() => setSelectedIndex(null)}
            className="absolute right-5 top-5 rounded-full bg-white/15 px-5 py-3 font-black text-white backdrop-blur"
          >
            Закрыть
          </button>
          <button
            onClick={() => showNextMemory(-1)}
            className="absolute left-5 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/15 px-5 py-4 text-3xl text-white backdrop-blur md:block"
          >
            ‹
          </button>
          <button
            onClick={() => showNextMemory(1)}
            className="absolute right-5 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/15 px-5 py-4 text-3xl text-white backdrop-blur md:block"
          >
            ›
          </button>
          <div className="max-h-[90vh] max-w-5xl overflow-hidden rounded-[2rem] bg-white/10 p-4 text-white shadow-2xl backdrop-blur-xl">
            {selectedMemory.image && (
              <img
                src={selectedMemory.image}
                alt={selectedMemory.title || "Воспоминание"}
                className="max-h-[70vh] w-full rounded-[1.5rem] object-contain"
              />
            )}
            <div className="p-4">
              <h2 className="text-3xl font-black">{selectedMemory.title || "Без названия"}</h2>
              <p className="mt-2 text-white/70">{selectedMemory.caption || selectedMemory.text}</p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
