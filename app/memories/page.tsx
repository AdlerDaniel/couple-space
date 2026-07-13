"use client";

import { supabase } from "@/lib/supabaseClient";
import { createPartnerNotification } from "@/lib/notifications";
import { compressImageFile } from "@/lib/imageCompression";
import {
  createCompatibleAudioRecorder,
  createRecordedAudioFile,
  MAX_AUDIO_SIZE,
  MAX_IMAGE_SIZE,
  getSafeStoragePath,
  validateMediaFile,
} from "@/lib/mediaFiles";
import { decodeMemoryMedia, encodeMemoryMedia } from "@/lib/memoryMedia";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const PAGE_SIZE = 12;
const memoryEmojis = [
  "❤️",
  "💕",
  "💌",
  "✨",
  "🥰",
  "😍",
  "😘",
  "😊",
  "😂",
  "🥹",
  "🌸",
  "🌙",
  "☀️",
  "⭐",
  "🎀",
  "🎁",
  "📸",
  "🍓",
  "🍷",
  "☕",
  "🌊",
  "🏡",
  "🎬",
  "🎵",
  "💫",
  "🫶",
  "💍",
  "🌹",
  "🍰",
  "🧸",
];
const reactions = ["❤️", "😂", "🥺", "👍", "😮"];

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
  event_date: string | null;
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

function formatRecordingTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function getMemoryStoragePath(mediaUrl?: string | null) {
  if (!mediaUrl) return null;

  const marker = "/memory-images/";
  const markerIndex = mediaUrl.indexOf(marker);

  if (markerIndex === -1) return null;

  const storagePath = mediaUrl.slice(markerIndex + marker.length);

  try {
    return decodeURIComponent(storagePath);
  } catch {
    return storagePath;
  }
}

export default function MemoriesPage() {
  const router = useRouter();
  const loaderRef = useRef<HTMLDivElement | null>(null);
  const touchStartX = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const discardRecordingRef = useRef(false);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [profile, setProfile] = useState<CoupleProfile | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [memoryImage, setMemoryImage] = useState<string | null>(null);
  const [memoryImageFile, setMemoryImageFile] = useState<File | null>(null);
  const [memoryVoice, setMemoryVoice] = useState<string | null>(null);
  const [memoryVoiceFile, setMemoryVoiceFile] = useState<File | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [comments, setComments] = useState<Record<string, MemoryComment[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<"all" | "pinned">("all");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  function selectMemoryPhoto(file: File) {
    const validation = validateMediaFile(file, ["image"], MAX_IMAGE_SIZE);
    if (validation.error) {
      setMessage(validation.error);
      return;
    }

    if (memoryImage) URL.revokeObjectURL(memoryImage);
    setMemoryImageFile(file);
    setMemoryImage(URL.createObjectURL(file));
    setMessage("");
  }

  function selectMemoryVoice(file: File) {
    const validation = validateMediaFile(file, ["audio"], MAX_AUDIO_SIZE);
    if (validation.error) {
      setMessage(validation.error);
      return;
    }

    if (memoryVoice) URL.revokeObjectURL(memoryVoice);
    setMemoryVoiceFile(file);
    setMemoryVoice(URL.createObjectURL(file));
    setMessage("");
  }

  async function toggleVoiceRecording() {
    if (isRecording) {
      discardRecordingRef.current = false;
      mediaRecorderRef.current?.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = createCompatibleAudioRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current = recorder;
      discardRecordingRef.current = false;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        setIsRecordingPaused(false);
        setRecordingSeconds(0);
        if (discardRecordingRef.current) {
          discardRecordingRef.current = false;
          audioChunksRef.current = [];
          return;
        }

        try {
          selectMemoryVoice(
            createRecordedAudioFile(audioChunksRef.current, recorder.mimeType, "memory-voice")
          );
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Не удалось сохранить запись");
        }
      };

      recorder.start();
      setIsRecording(true);
      setIsRecordingPaused(false);
      setRecordingSeconds(0);
    } catch (error) {
      console.error(error);
      setMessage(
        "Не удалось включить микрофон. Разрешите доступ или загрузите готовый аудиофайл."
      );
    }
  }

  function toggleVoicePause() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || !isRecording) return;
    if (recorder.state === "recording") {
      recorder.pause();
      setIsRecordingPaused(true);
    } else if (recorder.state === "paused") {
      recorder.resume();
      setIsRecordingPaused(false);
    }
  }

  function cancelVoiceRecording() {
    discardRecordingRef.current = true;
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    setIsRecordingPaused(false);
    setRecordingSeconds(0);
  }

  useEffect(() => {
    if (!isRecording || isRecordingPaused) {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
      return;
    }

    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds((current) => current + 1);
    }, 1000);
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    };
  }, [isRecording, isRecordingPaused]);

  useEffect(() => {
    return () => {
      discardRecordingRef.current = true;
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      recorder?.stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

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

      const [{ data: memoryRows }, { data: commentRows }, { data: profileData }] = await Promise.all([
        supabase
          .from("memories")
          .select("id, title, caption, text, image, event_date, is_pinned, reactions, user_id, couple_id, created_at")
          .eq("couple_id", coupleData.id)
          .order("is_pinned", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("memory_comments")
          .select("id, memory_id, user_id, text, created_at")
          .eq("couple_id", coupleData.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("couple_profiles")
          .select("partner_one, partner_two, avatar, avatar_one, avatar_two")
          .eq("couple_id", coupleData.id)
          .limit(1)
          .maybeSingle<CoupleProfile>(),
      ]);

      if (profileData) setProfile(profileData);
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
  const selectedMedia = decodeMemoryMedia(selectedMemory?.image);

  function getMemoryUserMeta(userId: string) {
    if (!couple) return { name: "?", avatar: null as string | null, initial: "?" };
    if (userId === couple.partner_one_id) {
      const name = profile?.partner_one || "A";
      return {
        name,
        avatar: profile?.avatar_one || profile?.avatar || null,
        initial: name.trim().slice(0, 1).toUpperCase() || "A",
      };
    }

    const name = profile?.partner_two || "B";
    return {
      name,
      avatar: profile?.avatar_two || profile?.avatar || null,
      initial: name.trim().slice(0, 1).toUpperCase() || "B",
    };
  }

  function getReactionUsers(memory: Memory, reaction: string) {
    return Object.entries(memory.reactions || {})
      .filter(([, value]) => value === reaction)
      .map(([userId]) => userId);
  }

  function updateMemoryReaction(memoryId: string, reactions: Record<string, string | null | undefined>) {
    setMemories((current) =>
      current.map((item) =>
        item.id === memoryId
          ? {
              ...item,
              reactions,
            }
          : item
      )
    );
  }

  async function uploadMemoryFile(file: File) {
    if (!couple) throw new Error("Пара не найдена");
    const filePath = getSafeStoragePath(couple.id, file);
    const { error } = await supabase.storage
      .from("memory-images")
      .upload(filePath, file, { upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from("memory-images").getPublicUrl(filePath);
    return { filePath, publicUrl: data.publicUrl };
  }

  async function addMemory() {
    if (
      !couple ||
      !currentUserId ||
      (!title.trim() && !caption.trim() && !memoryImageFile && !memoryVoiceFile)
    ) {
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    const uploadedPaths: string[] = [];
    try {
      let photoUrl: string | null = null;
      let voiceUrl: string | null = null;

      if (memoryImageFile) {
        const compressedImage = await compressImageFile(memoryImageFile, {
          maxWidth: 1800,
          maxHeight: 1800,
          quality: 0.78,
        });
        const upload = await uploadMemoryFile(compressedImage);
        uploadedPaths.push(upload.filePath);
        photoUrl = upload.publicUrl;
      }

      if (memoryVoiceFile) {
        const upload = await uploadMemoryFile(memoryVoiceFile);
        uploadedPaths.push(upload.filePath);
        voiceUrl = upload.publicUrl;
      }

      const { data, error } = await supabase
        .from("memories")
        .insert([
          {
            title: title.trim() || "Без названия",
            caption: caption.trim() || null,
            text: caption.trim() || null,
            event_date: eventDate || null,
            image: encodeMemoryMedia({ photoUrl, voiceUrl }),
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
        if (memoryImage) URL.revokeObjectURL(memoryImage);
        if (memoryVoice) URL.revokeObjectURL(memoryVoice);
        setMemoryImage(null);
        setMemoryImageFile(null);
        setMemoryVoice(null);
        setMemoryVoiceFile(null);
        setMessage("Воспоминание добавлено");
        await createPartnerNotification(couple, currentUserId, {
          type: "memory_added",
          title: "Новое воспоминание",
          body: title.trim() || caption.trim() || "Партнёр добавил воспоминание.",
          href: "/memories",
        }).catch((notificationError) => {
          console.error(notificationError);
        });
      } else if (error) throw error;
    } catch (error) {
      console.error(error);
      if (uploadedPaths.length > 0) {
        await supabase.storage.from("memory-images").remove(uploadedPaths);
      }
      setMessage(
        error instanceof Error
          ? `Не удалось добавить воспоминание: ${error.message}`
          : "Не удалось добавить воспоминание. Попробуйте ещё раз."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function togglePinned(memory: Memory) {
    const nextPinned = !memory.is_pinned;
    setMemories((current) =>
      current.map((item) =>
        item.id === memory.id ? { ...item, is_pinned: nextPinned } : item
      )
    );

    const { error } = await supabase
      .from("memories")
      .update({ is_pinned: nextPinned })
      .eq("id", memory.id);

    if (error) {
      setMemories((current) =>
        current.map((item) =>
          item.id === memory.id ? { ...item, is_pinned: memory.is_pinned } : item
        )
      );
      setMessage(`Не удалось закрепить воспоминание: ${error.message}`);
    }
  }

  async function deleteMemory(memory: Memory) {
    const isConfirmed = window.confirm("Удалить это воспоминание?");
    if (!isConfirmed) return;

    setMessage("");

    const { error } = await supabase
      .from("memories")
      .delete()
      .eq("id", memory.id)
      .eq("couple_id", memory.couple_id);

    if (error) {
      setMessage(`Не удалось удалить воспоминание: ${error.message}`);
      return;
    }

    const media = decodeMemoryMedia(memory.image);
    const mediaPaths = [media.photoUrl, media.voiceUrl]
      .map(getMemoryStoragePath)
      .filter((path): path is string => Boolean(path));
    if (mediaPaths.length > 0) {
      await supabase.storage.from("memory-images").remove(mediaPaths);
    }

    setMemories((current) => current.filter((item) => item.id !== memory.id));
    setComments((current) => {
      const nextComments = { ...current };
      delete nextComments[memory.id];
      return nextComments;
    });
    setSelectedIndex(null);
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

    const previousReactions = memory.reactions || {};
    const isRemovingReaction = previousReactions[currentUserId] === reaction;
    const nextReactions = {
      ...previousReactions,
      [currentUserId]: isRemovingReaction ? undefined : reaction,
    };

    if (!nextReactions[currentUserId]) {
      delete nextReactions[currentUserId];
    }

    updateMemoryReaction(memory.id, nextReactions);

    const { error } = await supabase
      .from("memories")
      .update({ reactions: nextReactions })
      .eq("id", memory.id);

    if (!error) {
      if (!isRemovingReaction && couple && memory.user_id !== currentUserId) {
        await createPartnerNotification(couple, currentUserId, {
          type: "memory_reaction",
          title: "Реакция на воспоминание",
          body: `Партнёр оставил реакцию ${reaction}.`,
          href: "/memories",
        });
      }
    } else {
      updateMemoryReaction(memory.id, previousReactions);
      if (error) {
        setMessage(`Не удалось обновить реакцию: ${error.message}`);
      }
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
      await createPartnerNotification(couple, currentUserId, {
        type: "memory_comment",
        title: "Комментарий к воспоминанию",
        body: text,
        href: "/memories",
      });
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

  function addEmojiToCaption(emoji: string) {
    setCaption((current) => `${current}${emoji}`);
    setIsEmojiPickerOpen(false);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#eff6ff] px-4 pb-32 pt-24 text-[#172554] transition-colors dark:bg-[#020617] dark:text-white sm:px-6 md:pt-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(37,99,235,0.2),transparent_34%),radial-gradient(circle_at_82%_20%,rgba(29,78,216,0.14),transparent_30%),linear-gradient(135deg,#eff6ff_0%,#f8fbff_48%,#dbeafe_100%)] dark:bg-[radial-gradient(circle_at_18%_12%,rgba(37,99,235,0.16),transparent_34%),radial-gradient(circle_at_82%_20%,rgba(29,78,216,0.12),transparent_30%),linear-gradient(135deg,#020617_0%,#0f172a_48%,#020617_100%)]" />
      <div className="memories-grain pointer-events-none absolute inset-0 opacity-[0.16]" />

      <section className="relative mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-[#2563eb]/70 dark:text-blue-200/70">
              Воспоминания
            </p>
            <h1 className="mt-3 text-4xl font-black text-[#2563eb] dark:text-white sm:text-5xl md:text-7xl">
              Моменты пары
            </h1>
          </div>
          <button
            onClick={openRandomMemory}
            className="rounded-full bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] px-6 py-3 font-black text-white shadow-[0_18px_55px_rgba(37,99,235,0.28)] transition hover:-translate-y-0.5"
          >
            Случайное воспоминание
          </button>
        </div>

        <div className="mb-10 rounded-[2rem] border border-white/70 bg-white/50 p-5 shadow-[0_28px_90px_rgba(37,99,235,0.16)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/8">
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
          <div className="relative mt-4">
            <textarea
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="Описание или подпись к воспоминанию..."
              className="min-h-28 w-full resize-none rounded-2xl border border-blue-200/70 bg-white/75 px-5 py-4 pr-14 font-semibold leading-7 text-blue-950 outline-none transition focus:border-blue-400 focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)] dark:border-white/10 dark:bg-white/8 dark:text-white"
            />
            <button
              type="button"
              onClick={() => setIsEmojiPickerOpen((current) => !current)}
              className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-blue-50 text-xl shadow-[0_10px_30px_rgba(37,99,235,0.16)] transition hover:-translate-y-0.5 hover:bg-blue-100 dark:bg-white/10 dark:hover:bg-blue-500/18"
              aria-label="Добавить эмодзи"
            >
              😊
            </button>
            {isEmojiPickerOpen && (
              <div className="absolute right-0 top-14 z-20 w-[min(18rem,calc(100vw-2rem))] rounded-3xl border border-white/70 bg-white/95 p-3 shadow-[0_24px_80px_rgba(37,99,235,0.22)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#061624]/95">
                <div className="grid grid-cols-6 gap-2">
                  {memoryEmojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => addEmojiToCaption(emoji)}
                      className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-50 text-xl transition hover:-translate-y-0.5 hover:scale-105 hover:bg-blue-100 dark:bg-white/10 dark:hover:bg-white/15"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="cursor-pointer rounded-2xl border border-blue-200/70 bg-white/70 px-5 py-4 font-black text-[#2563eb] shadow-lg transition hover:bg-blue-50 dark:border-white/10 dark:bg-white/8 dark:text-blue-100 dark:hover:bg-blue-500/15">
              <input
                type="file"
                accept="image/*"
                disabled={isSubmitting}
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) selectMemoryPhoto(file);
                  event.target.value = "";
                }}
              />
              <span className="block text-xs uppercase opacity-65">Изображение</span>
              <span className="mt-1 block">Добавить фото</span>
            </label>
            <label className="cursor-pointer rounded-2xl border border-blue-200/70 bg-white/70 px-5 py-4 font-black text-[#2563eb] shadow-lg transition hover:bg-blue-50 dark:border-white/10 dark:bg-white/8 dark:text-blue-100 dark:hover:bg-blue-500/15">
              <input
                type="file"
                accept="audio/*,.m4a,.mp3,.ogg,.wav,.webm"
                disabled={isSubmitting}
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) selectMemoryVoice(file);
                  event.target.value = "";
                }}
              />
              <span className="block text-xs uppercase opacity-65">Голос</span>
              <span className="mt-1 block">Загрузить аудио</span>
            </label>
            <button
              type="button"
              onClick={toggleVoiceRecording}
              disabled={isSubmitting}
              className={`rounded-2xl border px-5 py-4 text-left font-black shadow-lg transition hover:-translate-y-0.5 disabled:opacity-50 ${
                isRecording
                  ? "border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-300/20 dark:bg-rose-400/12 dark:text-rose-100"
                  : "border-blue-200/70 bg-white/70 text-[#2563eb] dark:border-white/10 dark:bg-white/8 dark:text-blue-100"
              }`}
            >
              <span className="block text-xs uppercase opacity-65">Микрофон</span>
              <span className="mt-1 block">{isRecording ? "Завершить запись" : "Записать голос"}</span>
            </button>
            <button
              type="button"
              onClick={addMemory}
              disabled={isSubmitting}
              className="rounded-2xl bg-[#2563eb] px-7 py-4 font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-50"
            >
              {isSubmitting ? "Сохраняем..." : "Добавить воспоминание"}
            </button>
          </div>
          {isRecording && (
            <div className="mt-4 rounded-2xl bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] p-4 text-white shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={`h-3 w-3 rounded-full bg-white ${isRecordingPaused ? "" : "animate-pulse"}`} />
                  <div>
                    <p className="font-black">{isRecordingPaused ? "Запись на паузе" : "Идёт запись"}</p>
                    <p className="mt-1 text-sm font-bold opacity-75">{formatRecordingTime(recordingSeconds)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={toggleVoicePause} className="rounded-full bg-white/18 px-4 py-2 text-sm font-black">
                    {isRecordingPaused ? "Продолжить" : "Пауза"}
                  </button>
                  <button type="button" onClick={cancelVoiceRecording} className="rounded-full bg-white/18 px-4 py-2 text-sm font-black">
                    Отмена
                  </button>
                  <button type="button" onClick={toggleVoiceRecording} className="rounded-full bg-white px-4 py-2 text-sm font-black text-[#2563eb]">
                    Готово
                  </button>
                </div>
              </div>
            </div>
          )}
          {memoryImage && (
            <Image
              src={memoryImage}
              alt="Preview"
              width={1200}
              height={256}
              sizes="(min-width: 1280px) 1200px, 100vw"
              unoptimized
              className="mt-5 h-64 w-full rounded-[1.5rem] object-cover shadow-2xl"
            />
          )}
          {memoryVoice && (
            <div className="mt-4 rounded-2xl border border-blue-200/70 bg-white/70 p-4 shadow-inner dark:border-white/10 dark:bg-white/8">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="font-black text-[#2563eb] dark:text-blue-100">Голосовое воспоминание</p>
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(memoryVoice);
                    setMemoryVoice(null);
                    setMemoryVoiceFile(null);
                  }}
                  className="rounded-full bg-rose-50 px-3 py-1 text-xs font-black text-rose-600 dark:bg-rose-500/15 dark:text-rose-100"
                >
                  Удалить
                </button>
              </div>
              <audio controls preload="metadata" src={memoryVoice} className="w-full" />
            </div>
          )}
          {message && (
            <p className="mt-4 rounded-2xl bg-white/70 px-5 py-3 font-black text-[#2563eb] shadow-inner dark:bg-white/10 dark:text-blue-100">
              {message}
            </p>
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
                  ? "bg-[#2563eb] text-white"
                  : "border border-white/70 bg-white/55 text-[#2563eb] dark:border-white/10 dark:bg-white/8 dark:text-blue-100"
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
              const media = decodeMemoryMedia(memory.image);
              const isLoaded = !media.photoUrl || loadedImages[memory.id];
              const author = memory.user_id === currentUserId ? "Вы" : "Партнёр";

              return (
                <article
                  key={memory.id}
                  className="group mb-5 break-inside-avoid overflow-hidden rounded-[1.8rem] border border-white/70 bg-white/72 p-3 shadow-[0_24px_80px_rgba(37,99,235,0.16)] backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-[0_30px_110px_rgba(37,99,235,0.28)] dark:border-white/10 dark:bg-white/8"
                >
                  {media.photoUrl && (
                    <div className="relative overflow-hidden rounded-[1.35rem] bg-blue-100 dark:bg-white/8">
                      <>
                        {!isLoaded && (
                          <div className="absolute inset-0 animate-pulse bg-blue-100 blur-xl dark:bg-white/10" />
                        )}
                        <Image
                          src={media.photoUrl}
                          alt={memory.title || "Воспоминание"}
                          width={720}
                          height={900}
                          sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                          onLoad={() =>
                            setLoadedImages((current) => ({ ...current, [memory.id]: true }))
                          }
                          onClick={() => setSelectedIndex(index)}
                          className={`h-auto min-h-72 w-full cursor-zoom-in object-cover transition duration-500 group-hover:scale-105 ${
                            isLoaded ? "blur-0" : "blur-md"
                          }`}
                        />
                      </>
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-4 text-white opacity-0 transition group-hover:opacity-100">
                        <p className="font-black">{memory.title || "Без названия"}</p>
                      </div>
                    </div>
                  )}

                  <div className="p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      {memory.is_pinned ? (
                        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-[#2563eb] dark:bg-white/10 dark:text-blue-100">
                          Закреплено
                        </span>
                      ) : (
                        <span />
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => togglePinned(memory)}
                          className={`rounded-full px-3 py-1 text-xs font-black shadow transition hover:-translate-y-0.5 ${
                            memory.is_pinned
                              ? "bg-[#2563eb] text-white shadow-[0_10px_28px_rgba(37,99,235,0.28)]"
                              : "bg-white/70 text-[#2563eb] dark:bg-white/10 dark:text-blue-100"
                          }`}
                        >
                          {memory.is_pinned ? "Закреплено" : "Закрепить"}
                        </button>
                        <button
                          onClick={() => deleteMemory(memory)}
                          className="rounded-full bg-rose-50 px-3 py-1 text-xs font-black text-rose-600 shadow transition hover:-translate-y-0.5 hover:bg-rose-100 dark:bg-rose-500/15 dark:text-rose-100"
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                    <h2 className="text-2xl font-black text-[#172554] dark:text-white">
                      {memory.title || "Без названия"}
                    </h2>
                    <p className="mt-2 font-semibold leading-7 text-[#172554]/70 dark:text-white/62">
                      {memory.caption || memory.text || "Без описания"}
                    </p>
                    {media.voiceUrl && (
                      <div className="mt-4 rounded-2xl border border-blue-200/70 bg-blue-50/75 p-3 shadow-inner dark:border-white/10 dark:bg-white/8">
                        <p className="mb-2 text-sm font-black text-[#2563eb] dark:text-blue-100">
                          Голосовое воспоминание
                        </p>
                        <audio controls preload="metadata" src={media.voiceUrl} className="w-full" />
                      </div>
                    )}
                    <div className="mt-4 grid gap-2 text-sm font-bold text-[#172554]/58 dark:text-white/45">
                      <span>Дата события: {formatDate(memory.event_date)}</span>
                      <span>Загрузил: {author}</span>
                      <span>Время загрузки: {formatTime(memory.created_at)}</span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {reactions.map((reaction) => {
                        const userIds = getReactionUsers(memory, reaction);
                        const singleUser = userIds.length === 1 ? getMemoryUserMeta(userIds[0]) : null;
                        const isMyReaction = memory.reactions?.[currentUserId || ""] === reaction;
                        return (
                          <button
                            key={reaction}
                            onClick={() => toggleReaction(memory, reaction)}
                            className={`inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-full border px-2 text-lg shadow-sm transition hover:-translate-y-0.5 ${
                              isMyReaction
                                ? "border-blue-300 bg-blue-100"
                                : "border-white/70 bg-white/65 dark:border-white/10 dark:bg-white/8"
                            }`}
                            title={
                              userIds.length > 1
                                ? "Оба поставили эту реакцию"
                                : singleUser
                                  ? `${singleUser.name} поставил(а) эту реакцию`
                                  : "Поставить реакцию"
                            }
                          >
                            <span>{reaction}</span>
                            {userIds.length > 1 ? (
                              <span className="text-xs font-black text-[#2563eb] dark:text-blue-100">{userIds.length}</span>
                            ) : singleUser?.avatar ? (
                              <Image src={singleUser.avatar} alt={singleUser.name} width={18} height={18} sizes="18px" className="h-[18px] w-[18px] rounded-full object-cover ring-1 ring-white/80" />
                            ) : singleUser ? (
                              <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-white text-[9px] font-black text-[#2563eb] ring-1 ring-white/80 dark:bg-black/25 dark:text-white">{singleUser.initial}</span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-4 rounded-2xl bg-blue-50/70 p-3 dark:bg-white/8">
                      <p className="mb-2 text-sm font-black text-[#2563eb] dark:text-blue-100">
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
                          className="rounded-full bg-[#2563eb] px-4 py-2 text-sm font-black text-white"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/82 p-3 backdrop-blur-xl sm:p-5"
          onTouchStart={(event) => {
            touchStartX.current = event.touches[0]?.clientX || null;
          }}
          onTouchEnd={(event) => {
            handleTouchEnd(event.changedTouches[0]?.clientX || 0);
          }}
        >
          <button
            onClick={() => setSelectedIndex(null)}
            className="absolute right-3 top-3 rounded-full bg-white/15 px-4 py-2 text-sm font-black text-white backdrop-blur sm:right-5 sm:top-5 sm:px-5 sm:py-3 sm:text-base"
          >
            Закрыть
          </button>
          <button
            onClick={() => deleteMemory(selectedMemory)}
            className="absolute left-3 top-3 rounded-full bg-rose-500/80 px-4 py-2 text-sm font-black text-white shadow-[0_18px_50px_rgba(244,63,94,0.35)] backdrop-blur transition hover:-translate-y-0.5 hover:bg-rose-500 sm:left-5 sm:top-5 sm:px-5 sm:py-3 sm:text-base"
          >
            Удалить
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
          <div className="max-h-[86dvh] w-full max-w-5xl overflow-y-auto rounded-[1.35rem] bg-white/10 p-2 pt-14 text-white shadow-2xl backdrop-blur-xl sm:rounded-[2rem] sm:p-4 sm:pt-4">
            {selectedMedia.photoUrl && (
              <Image
                src={selectedMedia.photoUrl}
                alt={selectedMemory.title || "Воспоминание"}
                width={1400}
                height={1000}
                sizes="(min-width: 1024px) 1024px, 100vw"
                className="max-h-[70vh] w-full rounded-[1.5rem] object-contain"
              />
            )}
            <div className="p-4">
              <h2 className="text-3xl font-black">{selectedMemory.title || "Без названия"}</h2>
              <p className="mt-2 text-white/70">{selectedMemory.caption || selectedMemory.text}</p>
              {selectedMedia.voiceUrl && (
                <div className="mt-4 rounded-2xl bg-white/12 p-3">
                  <p className="mb-2 text-sm font-black">Голосовое воспоминание</p>
                  <audio controls preload="metadata" src={selectedMedia.voiceUrl} className="w-full" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
