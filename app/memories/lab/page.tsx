"use client";

import AccentAudioPlayer from "@/components/AccentAudioPlayer";
import EmojiPicker from "@/components/EmojiPicker";
import { FluentEmoji, FluentEmojiText } from "@/components/FluentEmoji";
import { decodeMemoryMedia, type MemoryMedia } from "@/lib/memoryMedia";
import { getMemoryStoragePath, signMemoryMediaRows } from "@/lib/memoryStorage";
import { createPartnerNotification } from "@/lib/notifications";
import { supabase } from "@/lib/supabaseClient";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Clock3,
  FileText,
  Grid2X2,
  ImagePlus,
  Images,
  ListTree,
  MessageCircle,
  Mic2,
  MoreHorizontal,
  Pencil,
  Pin,
  Search,
  Shuffle,
  SmilePlus,
  Sparkles,
  Trash2,
  UserRound,
  UsersRound,
  Volume2,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const PAGE_SIZE = 18;

type Couple = {
  id: string;
  partner_one_id: string;
  partner_two_id: string | null;
};

type CoupleProfile = {
  partner_one: string;
  partner_two: string;
  avatar?: string | null;
  avatar_one?: string | null;
  avatar_two?: string | null;
};

type Memory = {
  id: string;
  title: string | null;
  caption: string | null;
  text: string | null;
  image: string | null;
  is_pinned: boolean;
  reactions?: Record<string, string | null | undefined>;
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

type MemoryFilter = "all" | "pinned" | "mine" | "partner" | "media" | "voice";
type MemorySort = "newest" | "oldest";
type MemoryView = "mosaic" | "timeline";

function formatDate(value: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("ru-RU", options || {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function getMemoryTitle(value?: string | null) {
  const title = value?.trim() || "";
  return /^(без|нет) названия$/i.test(title) ? "" : title;
}

function getMemoryDescription(memory?: Pick<Memory, "caption" | "text"> | null) {
  const description = memory?.caption?.trim() || memory?.text?.trim() || "";
  return /^без описания$/i.test(description) ? "" : description;
}

function getMonthKey(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(value: string) {
  const label = formatDate(value, { month: "long", year: "numeric" });
  return label.slice(0, 1).toUpperCase() + label.slice(1);
}

function hasVisualMedia(media: MemoryMedia) {
  return Boolean(media.photoUrl || media.attachments?.some((item) => item.type === "image" || item.type === "video"));
}

export default function MemoriesLabPage() {
  const router = useRouter();
  const loaderRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const touchStartX = useRef<number | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [profile, setProfile] = useState<CoupleProfile | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [comments, setComments] = useState<Record<string, MemoryComment[]>>({});
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MemoryFilter>("all");
  const [sort, setSort] = useState<MemorySort>("newest");
  const [view, setView] = useState<MemoryView>("mosaic");
  const [year, setYear] = useState("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);
  const [reactionPickerMemoryId, setReactionPickerMemoryId] = useState<string | null>(null);
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadCollection = useCallback(async (coupleId: string, withProfile = false) => {
    const requests = [
      supabase
        .from("memories")
        .select("id, title, caption, text, image, is_pinned, reactions, user_id, couple_id, created_at")
        .eq("couple_id", coupleId)
        .order("created_at", { ascending: false }),
      supabase
        .from("memory_comments")
        .select("id, memory_id, user_id, text, created_at")
        .eq("couple_id", coupleId)
        .order("created_at", { ascending: true }),
    ] as const;

    const [{ data: memoryRows }, { data: commentRows }] = await Promise.all(requests);
    setMemories(await signMemoryMediaRows((memoryRows || []) as Memory[]));
    setComments(
      (commentRows || []).reduce<Record<string, MemoryComment[]>>((groups, comment) => {
        groups[comment.memory_id] = [...(groups[comment.memory_id] || []), comment];
        return groups;
      }, {}),
    );

    if (withProfile) {
      const { data } = await supabase
        .from("couple_profiles")
        .select("partner_one, partner_two, avatar, avatar_one, avatar_two")
        .eq("couple_id", coupleId)
        .limit(1)
        .maybeSingle<CoupleProfile>();
      if (data) setProfile(data);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || ignore) {
        if (!ignore) router.replace("/login");
        return;
      }
      setCurrentUserId(user.id);

      const { data: coupleData, error } = await supabase
        .from("couples")
        .select("id, partner_one_id, partner_two_id")
        .or(`partner_one_id.eq.${user.id},partner_two_id.eq.${user.id}`)
        .limit(1)
        .maybeSingle<Couple>();

      if (ignore) return;
      if (error || !coupleData) {
        router.replace("/couple");
        return;
      }

      setCouple(coupleData);
      await loadCollection(coupleData.id, true);
      if (ignore) return;
      setIsLoading(false);

      channel = supabase
        .channel(`memories-lab:${coupleData.id}:${crypto.randomUUID()}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "memories", filter: `couple_id=eq.${coupleData.id}` }, () => {
          void loadCollection(coupleData.id);
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "memory_comments", filter: `couple_id=eq.${coupleData.id}` }, () => {
          void loadCollection(coupleData.id);
        })
        .subscribe();
    }

    void load();
    return () => {
      ignore = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [loadCollection, router]);

  useEffect(() => {
    const loader = loaderRef.current;
    if (!loader) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) setVisibleCount((current) => current + PAGE_SIZE);
    }, { rootMargin: "240px" });
    observer.observe(loader);
    return () => observer.disconnect();
  }, [isLoading, view]);

  const years = useMemo(() => {
    const counts = new Map<string, number>();
    for (const memory of memories) {
      const value = String(new Date(memory.created_at).getFullYear());
      counts.set(value, (counts.get(value) || 0) + 1);
    }
    return [...counts.entries()].sort(([first], [second]) => Number(second) - Number(first));
  }, [memories]);

  const filteredMemories = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");
    return memories
      .filter((memory) => {
        const media = decodeMemoryMedia(memory.image);
        if (year !== "all" && String(new Date(memory.created_at).getFullYear()) !== year) return false;
        if (filter === "pinned" && !memory.is_pinned) return false;
        if (filter === "mine" && memory.user_id !== currentUserId) return false;
        if (filter === "partner" && memory.user_id === currentUserId) return false;
        if (filter === "media" && !hasVisualMedia(media)) return false;
        if (filter === "voice" && !media.voiceUrl && !media.attachments?.some((item) => item.type === "audio")) return false;
        if (!normalizedQuery) return true;
        const searchable = [memory.title, memory.caption, memory.text, ...((media.attachments || []).map((item) => item.name))]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("ru-RU");
        return searchable.includes(normalizedQuery);
      })
      .sort((first, second) => {
        const direction = sort === "newest" ? -1 : 1;
        return (new Date(first.created_at).getTime() - new Date(second.created_at).getTime()) * direction;
      });
  }, [currentUserId, filter, memories, query, sort, year]);

  const visibleMemories = filteredMemories.slice(0, visibleCount);
  const selectedMemory = selectedMemoryId ? filteredMemories.find((item) => item.id === selectedMemoryId) || null : null;
  const selectedIndex = selectedMemory ? filteredMemories.findIndex((item) => item.id === selectedMemory.id) : -1;
  const selectedMedia = decodeMemoryMedia(selectedMemory?.image);

  const timelineGroups = useMemo(() => {
    return visibleMemories.reduce<Array<{ key: string; label: string; memories: Memory[] }>>((groups, memory) => {
      const key = getMonthKey(memory.created_at);
      const previous = groups.at(-1);
      if (previous?.key === key) previous.memories.push(memory);
      else groups.push({ key, label: getMonthLabel(memory.created_at), memories: [memory] });
      return groups;
    }, []);
  }, [visibleMemories]);

  const stats = useMemo(() => ({
    total: memories.length,
    pinned: memories.filter((memory) => memory.is_pinned).length,
    visual: memories.filter((memory) => hasVisualMedia(decodeMemoryMedia(memory.image))).length,
    years: years.length,
  }), [memories, years.length]);

  const storyMemories = useMemo(() => memories
    .filter((memory) => Boolean(decodeMemoryMedia(memory.image).photoUrl))
    .slice(0, 8), [memories]);

  const getMemoryUserMeta = useCallback((userId: string) => {
    if (!couple) return { name: "?", avatar: null as string | null, initial: "?" };
    if (userId === couple.partner_one_id) {
      const name = profile?.partner_one || "A";
      return { name, avatar: profile?.avatar_one || profile?.avatar || null, initial: name.trim().slice(0, 1).toUpperCase() || "A" };
    }
    const name = profile?.partner_two || "B";
    return { name, avatar: profile?.avatar_two || profile?.avatar || null, initial: name.trim().slice(0, 1).toUpperCase() || "B" };
  }, [couple, profile]);

  function getReactionUsers(memory: Memory, reaction: string) {
    return Object.entries(memory.reactions || {})
      .filter(([, value]) => value === reaction)
      .map(([userId]) => userId);
  }

  function updateMemoryReaction(memoryId: string, reactions: Record<string, string | null | undefined>) {
    setMemories((current) => current.map((item) => item.id === memoryId ? { ...item, reactions } : item));
  }

  async function togglePinned(memory: Memory) {
    const nextPinned = !memory.is_pinned;
    setMemories((current) => current.map((item) => item.id === memory.id ? { ...item, is_pinned: nextPinned } : item));
    const { error } = await supabase.from("memories").update({ is_pinned: nextPinned }).eq("id", memory.id);
    if (error) {
      setMemories((current) => current.map((item) => item.id === memory.id ? { ...item, is_pinned: memory.is_pinned } : item));
      setMessage(`Не удалось изменить закрепление: ${error.message}`);
    }
  }

  async function deleteMemory(memory: Memory) {
    if (!window.confirm("Удалить это воспоминание?")) return;
    setMessage("");
    const { error } = await supabase.from("memories").delete().eq("id", memory.id).eq("couple_id", memory.couple_id);
    if (error) {
      setMessage(`Не удалось удалить воспоминание: ${error.message}`);
      return;
    }

    const media = decodeMemoryMedia(memory.image);
    const mediaPaths = [media.photoUrl, media.voiceUrl, ...(media.attachments || []).map((item) => item.url)]
      .map(getMemoryStoragePath)
      .filter((path): path is string => Boolean(path));
    if (mediaPaths.length > 0) await supabase.storage.from("memory-images").remove(mediaPaths);

    setMemories((current) => current.filter((item) => item.id !== memory.id));
    setComments((current) => {
      const next = { ...current };
      delete next[memory.id];
      return next;
    });
    setSelectedMemoryId(null);
    setMessage("Воспоминание удалено");
    if (currentUserId && couple) {
      await createPartnerNotification(couple, currentUserId, {
        type: "memory_deleted",
        title: "Воспоминание удалено",
        body: memory.title || memory.caption || "Партнёр удалил воспоминание.",
        href: "/memories",
      });
    }
  }

  async function toggleReaction(memory: Memory, reaction: string) {
    if (!currentUserId) return;
    const previous = memory.reactions || {};
    const isRemoving = previous[currentUserId] === reaction;
    const next = { ...previous, [currentUserId]: isRemoving ? undefined : reaction };
    if (!next[currentUserId]) delete next[currentUserId];
    updateMemoryReaction(memory.id, next);
    const { error } = await supabase.from("memories").update({ reactions: next }).eq("id", memory.id);
    if (error) {
      updateMemoryReaction(memory.id, previous);
      setMessage(`Не удалось обновить реакцию: ${error.message}`);
      return;
    }
    if (!isRemoving && couple && memory.user_id !== currentUserId) {
      await createPartnerNotification(couple, currentUserId, {
        type: "memory_reaction",
        title: "Реакция на воспоминание",
        body: `Партнёр оставил реакцию ${reaction}.`,
        href: "/memories",
      });
    }
  }

  const showMemory = useCallback((direction: 1 | -1) => {
    if (selectedIndex < 0 || filteredMemories.length === 0) return;
    const nextIndex = (selectedIndex + direction + filteredMemories.length) % filteredMemories.length;
    setSelectedMemoryId(filteredMemories[nextIndex]?.id || null);
  }, [filteredMemories, selectedIndex]);

  useEffect(() => {
    function handleKeyboard(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.matches("input, textarea, select, [contenteditable='true']");
      if (!selectedMemoryId && event.key === "/" && !isTyping) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (!selectedMemoryId) return;
      if (event.key === "Escape") setSelectedMemoryId(null);
      if (event.key === "ArrowRight") showMemory(1);
      if (event.key === "ArrowLeft") showMemory(-1);
    }
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [selectedMemoryId, showMemory]);

  function openRandomMemory() {
    if (filteredMemories.length === 0) return;
    const memory = filteredMemories[Math.floor(Math.random() * filteredMemories.length)];
    setSelectedMemoryId(memory?.id || null);
  }

  function resetPagination() {
    setVisibleCount(PAGE_SIZE);
  }

  function handleTouchEnd(endX: number) {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - endX;
    if (Math.abs(diff) > 40) showMemory(diff > 0 ? 1 : -1);
    touchStartX.current = null;
  }

  function renderMediaAttachments(media: MemoryMedia, memoryId: string) {
    const attachments = media.attachments || [];
    if (!media.voiceUrl && attachments.length === 0) return null;
    return (
      <div className="memory-lab-attachments">
        {media.voiceUrl && (
          <div className="memory-lab-audio-note">
            <div><span><Mic2 size={14} aria-hidden="true" /></span><strong>Голосовой момент</strong></div>
            <AccentAudioPlayer src={media.voiceUrl} accent="#2563eb" label="Голосовое воспоминание" className="memory-voice-player" />
          </div>
        )}
        {attachments.map((attachment, index) => attachment.type === "image" ? (
          <div key={`${attachment.url}-${index}`} className="memory-lab-attachment-media is-image">
            <Image src={attachment.url} alt={attachment.name} width={720} height={520} sizes="(max-width: 768px) 45vw, 420px" unoptimized />
            <span>Фото</span>
          </div>
        ) : attachment.type === "video" ? (
          <div key={`${attachment.url}-${index}`} className="memory-lab-attachment-media is-video">
            <video src={attachment.url} controls playsInline preload="metadata" />
            <span>Видео</span>
          </div>
        ) : attachment.type === "audio" ? (
          <div key={`${attachment.url}-${index}`} className="memory-lab-audio-note">
            <div><span><Mic2 size={14} aria-hidden="true" /></span><strong>{attachment.name || "Аудиозапись"}</strong></div>
            <AccentAudioPlayer src={attachment.url} accent="#2563eb" label={attachment.name} />
          </div>
        ) : (
          <a key={`${attachment.url}-${index}`} href={attachment.url} target="_blank" rel="noreferrer" className="memory-lab-file" onClick={(event) => event.stopPropagation()}>
            <FileText size={16} aria-hidden="true" />
            <span className="truncate">{attachment.name}</span>
          </a>
        ))}
        <span className="sr-only">Вложения воспоминания {memoryId}</span>
      </div>
    );
  }

  function renderCard(memory: Memory, index: number) {
    const media = decodeMemoryMedia(memory.image);
    const title = getMemoryTitle(memory.title);
    const description = getMemoryDescription(memory);
    const author = getMemoryUserMeta(memory.user_id);
    const isLoaded = !media.photoUrl || loadedImages[memory.id];
    const reactionValues = Array.from(new Set(Object.values(memory.reactions || {}).filter((value): value is string => Boolean(value))));
    const isFeatured = view === "mosaic" && index % 9 === 0 && Boolean(media.photoUrl);
    const memoryComments = comments[memory.id] || [];
    const latestComment = memoryComments.at(-1);
    const latestCommentAuthor = latestComment ? getMemoryUserMeta(latestComment.user_id) : null;

    return (
      <article
        key={memory.id}
        className={`memory-lab-card performance-list-item ${isFeatured ? "is-featured" : ""} ${reactionPickerMemoryId === memory.id ? "is-picker-open" : ""}`}
        role="link"
        tabIndex={0}
        onClick={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest("button, a, input, textarea, select, video, audio, summary, details, [role='slider'], .accent-audio-player, .emoji-picker")) return;
          router.push(`/memories/${memory.id}`);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            router.push(`/memories/${memory.id}`);
          }
        }}
      >
        <div className="memory-lab-card-media">
          {media.photoUrl ? (
            <>
              {!isLoaded && <div className="absolute inset-0 animate-pulse bg-indigo-100 dark:bg-white/8" />}
              <Image
                src={media.photoUrl}
                alt={title || "Воспоминание"}
                width={960}
                height={900}
                sizes="(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 50vw"
                className={`h-full w-full object-cover transition duration-700 ${isLoaded ? "scale-100 blur-0" : "scale-105 blur-lg"}`}
                onLoad={() => setLoadedImages((current) => ({ ...current, [memory.id]: true }))}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedMemoryId(memory.id);
                }}
                unoptimized
              />
            </>
          ) : (
            <div className="memory-lab-card-placeholder">
              <Sparkles size={28} aria-hidden="true" />
              <span>{formatDate(memory.created_at, { day: "numeric", month: "short" })}</span>
            </div>
          )}
          <div className="memory-lab-card-topline">
            <span className={memory.is_pinned ? "is-pinned" : ""}>
              {memory.is_pinned ? <Pin size={12} aria-hidden="true" /> : <CalendarDays size={12} aria-hidden="true" />}
              {memory.is_pinned ? "Закреплено" : formatDate(memory.created_at, { day: "numeric", month: "short" })}
            </span>
            <button type="button" onClick={(event) => { event.stopPropagation(); setSelectedMemoryId(memory.id); }} aria-label="Открыть просмотр">
              <Images size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="memory-lab-card-body">
          <div className="memory-lab-author-row">
            {author.avatar ? <Image src={author.avatar} alt={author.name} width={30} height={30} sizes="30px" className="h-8 w-8 rounded-full object-cover" unoptimized /> : <span className="memory-lab-avatar">{author.initial}</span>}
            <div className="min-w-0">
              <p className="truncate text-xs font-black">{memory.user_id === currentUserId ? "Добавили вы" : author.name}</p>
              <p className="text-[10px] font-bold opacity-55">{formatDate(memory.created_at)}</p>
            </div>
          </div>

          {title && <h2><FluentEmojiText>{title}</FluentEmojiText></h2>}
          {description && <p className="memory-lab-description"><FluentEmojiText>{description}</FluentEmojiText></p>}
          {renderMediaAttachments(media, memory.id)}

          {latestComment && (
            <Link href={`/memories/${memory.id}`} className="memory-lab-comment-peek" onClick={(event) => event.stopPropagation()}>
              <span><MessageCircle size={15} aria-hidden="true" /></span>
              <span>
                <strong>{latestCommentAuthor?.name || "Комментарий"}{memoryComments.length > 1 ? ` · ${memoryComments.length}` : ""}</strong>
                <small>{latestComment.text}</small>
              </span>
              <ChevronRight size={15} aria-hidden="true" />
            </Link>
          )}

          <div className="memory-lab-actions">
            <div className="memory-lab-reactions">
              {reactionValues.map((reaction) => {
                const users = getReactionUsers(memory, reaction);
                const isMine = memory.reactions?.[currentUserId || ""] === reaction;
                return (
                  <button key={reaction} type="button" onClick={() => void toggleReaction(memory, reaction)} className={isMine ? "is-active" : ""} title={users.length > 1 ? "Оба поставили эту реакцию" : "Реакция на воспоминание"}>
                    <FluentEmoji emoji={reaction} size={19} decorative />
                    {users.length > 1 && <b>{users.length}</b>}
                  </button>
                );
              })}
              <button type="button" onClick={() => setReactionPickerMemoryId((current) => current === memory.id ? null : memory.id)} aria-label="Выбрать реакцию" aria-expanded={reactionPickerMemoryId === memory.id}>
                <SmilePlus size={17} aria-hidden="true" />
              </button>
              {reactionPickerMemoryId === memory.id && (
                <EmojiPicker
                  selectedEmoji={memory.reactions?.[currentUserId || ""] || undefined}
                  onSelect={(reaction) => { void toggleReaction(memory, reaction); setReactionPickerMemoryId(null); }}
                  tone="blue"
                  className="fixed bottom-24 left-1/2 z-[120] w-[min(21rem,calc(100vw-1.5rem))] -translate-x-1/2"
                  compact
                  portal
                />
              )}
            </div>

            <Link href={`/memories/${memory.id}`} className="memory-lab-comment" aria-label="Открыть комментарии">
              <MessageCircle size={17} aria-hidden="true" />
              {(comments[memory.id] || []).length > 0 && <span>{(comments[memory.id] || []).length}</span>}
            </Link>

            <details className="memory-lab-menu" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
              <summary aria-label="Действия с воспоминанием"><MoreHorizontal size={18} aria-hidden="true" /></summary>
              <div>
                <button type="button" onClick={() => void togglePinned(memory)}><Pin size={15} />{memory.is_pinned ? "Открепить" : "Закрепить"}</button>
                <Link href={`/memories/new?edit=${memory.id}`}><Pencil size={15} />Редактировать</Link>
                <button type="button" className="is-danger" onClick={() => void deleteMemory(memory)}><Trash2 size={15} />Удалить</button>
              </div>
            </details>
          </div>
        </div>
      </article>
    );
  }

  const filters: Array<{ key: MemoryFilter; label: string; icon: typeof Images }> = [
    { key: "all", label: "Все", icon: Sparkles },
    { key: "pinned", label: "Закреплённые", icon: Pin },
    { key: "mine", label: "Мои", icon: UserRound },
    { key: "partner", label: "Партнёра", icon: UsersRound },
    { key: "media", label: "Фото и видео", icon: Images },
    { key: "voice", label: "С голосом", icon: Volume2 },
  ];

  return (
    <main className="memory-lab-page mobile-redesign-page min-h-screen px-3 pb-32 pt-20 text-slate-950 dark:text-white sm:px-6 md:pt-28" style={{ ["--scroll-accent" as string]: "#2563eb" }}>
      <section className="memory-lab-shell mx-auto max-w-[90rem]">
        <header className="memory-lab-hero">
          <div className="memory-lab-hero-orbit" aria-hidden="true"><i /><i /><i /></div>
          <div className="memory-lab-hero-copy">
            <p><span /> Лаборатория воспоминаний</p>
            <h1>Карта наших<br /><em>моментов</em></h1>
            <div className="memory-lab-hero-actions">
              <button type="button" onClick={() => router.push("/memories/new")} className="memory-lab-primary"><ImagePlus size={19} />Добавить момент</button>
              <button type="button" onClick={openRandomMemory} className="memory-lab-secondary"><Shuffle size={18} />Удивить меня</button>
            </div>
          </div>

          <div className="memory-lab-overview" aria-label="Обзор коллекции">
            <div><strong>{stats.total}</strong><span>моментов вместе</span></div>
            <div><strong>{stats.visual}</strong><span>с фото и видео</span></div>
            <div><strong>{stats.pinned}</strong><span>особенно важных</span></div>
            <div><strong>{stats.years}</strong><span>лет в архиве</span></div>
          </div>

          {storyMemories.length > 0 && (
            <div className="memory-lab-story-strip">
              <div className="memory-lab-story-heading">
                <span><Images size={16} aria-hidden="true" /></span>
                <div><strong>Быстрый альбом</strong><small>Нажмите, чтобы открыть момент</small></div>
              </div>
              <div className="memory-lab-story-rail">
                {storyMemories.map((memory, index) => {
                  const photoUrl = decodeMemoryMedia(memory.image).photoUrl;
                  return (
                    <button key={memory.id} type="button" onClick={() => setSelectedMemoryId(memory.id)} aria-label={`Открыть: ${getMemoryTitle(memory.title) || formatDate(memory.created_at)}`}>
                      <span><Image src={photoUrl || ""} alt="" fill sizes="88px" unoptimized /></span>
                      <small>{index === 0 ? "Новое" : formatDate(memory.created_at, { day: "numeric", month: "short" })}</small>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </header>

        {message && <div className="memory-lab-message" role="status">{message}<button type="button" onClick={() => setMessage("")} aria-label="Закрыть"><X size={16} /></button></div>}

        <section className="memory-lab-toolbar" aria-label="Поиск и фильтры">
          <label className="memory-lab-search">
            <Search size={18} aria-hidden="true" />
            <input ref={searchRef} value={query} onChange={(event) => { setQuery(event.target.value); resetPagination(); }} placeholder="Найти момент, подпись или файл…" />
            <kbd>/</kbd>
          </label>

          <div className="memory-lab-toolbar-row">
            <div className="memory-lab-filter-row" role="group" aria-label="Фильтр воспоминаний">
              {filters.map(({ key, label, icon: Icon }) => (
                <button key={key} type="button" onClick={() => { setFilter(key); resetPagination(); }} className={filter === key ? "is-active" : ""} aria-pressed={filter === key}>
                  <Icon size={15} aria-hidden="true" />{label}
                </button>
              ))}
            </div>
            <div className="memory-lab-view-controls">
              <select value={sort} onChange={(event) => { setSort(event.target.value as MemorySort); resetPagination(); }} aria-label="Порядок воспоминаний">
                <option value="newest">Сначала новые</option>
                <option value="oldest">Сначала старые</option>
              </select>
              <button type="button" onClick={() => { setView("mosaic"); resetPagination(); }} className={view === "mosaic" ? "is-active" : ""} aria-label="Мозаика" aria-pressed={view === "mosaic"}><Grid2X2 size={18} /></button>
              <button type="button" onClick={() => { setView("timeline"); resetPagination(); }} className={view === "timeline" ? "is-active" : ""} aria-label="Лента времени" aria-pressed={view === "timeline"}><ListTree size={18} /></button>
            </div>
          </div>

          {years.length > 0 && (
            <div className="memory-lab-years" role="group" aria-label="Год воспоминаний">
              <button type="button" onClick={() => { setYear("all"); resetPagination(); }} className={year === "all" ? "is-active" : ""}>Все годы <span>{memories.length}</span></button>
              {years.map(([value, count]) => <button key={value} type="button" onClick={() => { setYear(value); resetPagination(); }} className={year === value ? "is-active" : ""}>{value}<span>{count}</span></button>)}
            </div>
          )}
        </section>

        <div className="memory-lab-results-head">
          <div>
            <p>{query || filter !== "all" || year !== "all" ? "Результаты отбора" : "Вся история"}</p>
            <h2>{filteredMemories.length} {filteredMemories.length === 1 ? "воспоминание" : "воспоминаний"}</h2>
          </div>
          <span><Clock3 size={15} />Обновляется вместе с партнёром</span>
        </div>

        {isLoading ? (
          <div className="memory-lab-grid" aria-label="Загрузка воспоминаний">
            {Array.from({ length: 8 }).map((_, index) => <div key={index} className="memory-lab-skeleton" />)}
          </div>
        ) : visibleMemories.length === 0 ? (
          <section className="memory-lab-empty">
            <span><Sparkles size={28} /></span>
            <h2>{memories.length === 0 ? "История начинается здесь" : "Таких моментов пока нет"}</h2>
            <p>{memories.length === 0 ? "Добавьте фотографию, голос, видео или просто пару важных слов." : "Измените фильтр или попробуйте другой поисковый запрос."}</p>
            {memories.length === 0 ? <button type="button" onClick={() => router.push("/memories/new")}>Добавить первый момент</button> : <button type="button" onClick={() => { setQuery(""); setFilter("all"); setYear("all"); resetPagination(); }}>Сбросить фильтры</button>}
          </section>
        ) : view === "mosaic" ? (
          <div className="memory-lab-grid">{visibleMemories.map(renderCard)}</div>
        ) : (
          <div className="memory-lab-timeline">
            {timelineGroups.map((group) => (
              <section key={group.key} className="memory-lab-timeline-group">
                <header><span><CalendarDays size={16} /></span><div><h2>{group.label}</h2><p>{group.memories.length} моментов</p></div></header>
                <div>{group.memories.map((memory, index) => renderCard(memory, index))}</div>
              </section>
            ))}
          </div>
        )}

        <div ref={loaderRef} className="h-12" />
      </section>

      {selectedMemory && (
        <section
          className="memory-lab-viewer"
          role="dialog"
          aria-modal="true"
          aria-label="Просмотр воспоминания"
          onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX || null; }}
          onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0]?.clientX || 0)}
        >
          <button type="button" className="memory-lab-viewer-close" onClick={() => setSelectedMemoryId(null)} aria-label="Закрыть"><X size={22} /></button>
          <button type="button" className="memory-lab-viewer-arrow is-left" onClick={() => showMemory(-1)} aria-label="Предыдущее воспоминание"><ArrowLeft size={24} /></button>
          <button type="button" className="memory-lab-viewer-arrow is-right" onClick={() => showMemory(1)} aria-label="Следующее воспоминание"><ArrowRight size={24} /></button>

          <div className="memory-lab-viewer-card">
            <div className="memory-lab-viewer-media">
              {selectedMedia.photoUrl ? <Image src={selectedMedia.photoUrl} alt={getMemoryTitle(selectedMemory.title) || "Воспоминание"} width={1500} height={1200} sizes="(min-width: 1024px) 70vw, 100vw" className="h-full w-full object-contain" unoptimized /> : <div><Sparkles size={42} /><span>Момент без фотографии</span></div>}
            </div>
            <aside className="memory-lab-viewer-copy">
              <div className="memory-lab-viewer-date"><CalendarDays size={15} />{formatDate(selectedMemory.created_at)}</div>
              {getMemoryTitle(selectedMemory.title) && <h2><FluentEmojiText>{getMemoryTitle(selectedMemory.title)}</FluentEmojiText></h2>}
              {getMemoryDescription(selectedMemory) && <p><FluentEmojiText>{getMemoryDescription(selectedMemory)}</FluentEmojiText></p>}
              {renderMediaAttachments(selectedMedia, selectedMemory.id)}
              <div className="memory-lab-viewer-links">
                <Link href={`/memories/${selectedMemory.id}`}><MessageCircle size={17} />Обсуждение{(comments[selectedMemory.id] || []).length > 0 ? ` · ${(comments[selectedMemory.id] || []).length}` : ""}</Link>
                <Link href={`/memories/new?edit=${selectedMemory.id}`}><Pencil size={17} />Редактировать</Link>
                <button type="button" onClick={() => void togglePinned(selectedMemory)}><Pin size={17} />{selectedMemory.is_pinned ? "Открепить" : "Закрепить"}</button>
                <button type="button" className="is-danger" onClick={() => void deleteMemory(selectedMemory)}><Trash2 size={17} />Удалить</button>
              </div>
              <div className="memory-lab-viewer-progress"><span>{selectedIndex + 1}</span><i style={{ width: `${((selectedIndex + 1) / filteredMemories.length) * 100}%` }} /><span>{filteredMemories.length}</span></div>
            </aside>
          </div>
        </section>
      )}

      <button type="button" onClick={() => router.push("/memories/new")} className="memory-lab-fab" aria-label="Добавить воспоминание"><ImagePlus size={21} /><span>Добавить</span></button>
    </main>
  );
}
