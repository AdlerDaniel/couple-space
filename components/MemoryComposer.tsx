"use client";

import EmojiPicker from "@/components/EmojiPicker";
import AccentAudioPlayer from "@/components/AccentAudioPlayer";
import { compressImageFile } from "@/lib/imageCompression";
import {
  createCompatibleAudioRecorder,
  createRecordedAudioFile,
  getMediaKind,
  getSafeStoragePath,
  MAX_AUDIO_SIZE,
  MAX_IMAGE_SIZE,
  validateMediaFile,
} from "@/lib/mediaFiles";
import { encodeMemoryMedia, type MemoryAttachment } from "@/lib/memoryMedia";
import { createPartnerNotification } from "@/lib/notifications";
import { supabase } from "@/lib/supabaseClient";
import { toPortableSupabaseUrl } from "@/lib/supabaseUrls";
import { FileText, ImageIcon, Mic, Music2, Paperclip, Smile, Square, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type CoupleLike = {
  id: string;
  partner_one_id: string;
  partner_two_id: string | null;
};

export type CreatedMemory = {
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

type MemoryComposerProps = {
  couple: CoupleLike;
  currentUserId: string;
  embedded?: boolean;
  onCreated?: (memory: CreatedMemory) => void;
};

type PendingAttachment = {
  file: File;
  type: MemoryAttachment["type"];
  previewUrl: string;
};

const MAX_VIDEO_SIZE = 50 * 1024 * 1024;
const MAX_FILE_SIZE = 50 * 1024 * 1024;

function formatRecordingTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

export default function MemoryComposer({
  couple,
  currentUserId,
  embedded = false,
  onCreated,
}: MemoryComposerProps) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const discardRecordingRef = useRef(false);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [memoryImage, setMemoryImage] = useState<string | null>(null);
  const [memoryImageFile, setMemoryImageFile] = useState<File | null>(null);
  const [memoryVoice, setMemoryVoice] = useState<string | null>(null);
  const [memoryVoiceFile, setMemoryVoiceFile] = useState<File | null>(null);
  const [memoryAttachments, setMemoryAttachments] = useState<PendingAttachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [message, setMessage] = useState("");
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

  function addMemoryAttachments(files: File[]) {
    const next: PendingAttachment[] = [];
    let primaryImageReserved = Boolean(memoryImageFile);
    for (const file of files) {
      const type = getMediaKind(file);
      if (type === "image" && !primaryImageReserved) {
        selectMemoryPhoto(file);
        primaryImageReserved = true;
        continue;
      }
      const maximumSize = type === "audio" ? MAX_AUDIO_SIZE : type === "image" ? MAX_IMAGE_SIZE : type === "video" ? MAX_VIDEO_SIZE : MAX_FILE_SIZE;
      const validation = validateMediaFile(file, ["image", "video", "audio", "file"], maximumSize);
      if (validation.error) {
        setMessage(validation.error);
        continue;
      }
      next.push({ file, type, previewUrl: URL.createObjectURL(file) });
    }
    if (next.length) {
      setMemoryAttachments((current) => [...current, ...next].slice(0, 8));
      setMessage("");
    }
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
            createRecordedAudioFile(audioChunksRef.current, recorder.mimeType, "memory-voice"),
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
      setMessage("Не удалось включить микрофон. Разрешите доступ или загрузите готовый аудиофайл.");
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

  async function uploadMemoryFile(file: File) {
    const filePath = getSafeStoragePath(couple.id, file);
    const { error } = await supabase.storage
      .from("memory-images")
      .upload(filePath, file, { upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from("memory-images").getPublicUrl(filePath);
    return { filePath, publicUrl: toPortableSupabaseUrl(data.publicUrl) || data.publicUrl };
  }

  async function addMemory() {
    if (!title.trim() && !caption.trim() && !memoryImageFile && !memoryVoiceFile && memoryAttachments.length === 0) return;

    setIsSubmitting(true);
    setMessage("");
    const uploadedPaths: string[] = [];

    try {
      let photoUrl: string | null = null;
      let voiceUrl: string | null = null;
      const attachments: MemoryAttachment[] = [];

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

      for (const pending of memoryAttachments) {
        const file = pending.type === "image" ? await compressImageFile(pending.file) : pending.file;
        const upload = await uploadMemoryFile(file);
        uploadedPaths.push(upload.filePath);
        attachments.push({ url: upload.publicUrl, type: pending.type, name: pending.file.name, mimeType: pending.file.type || null, size: pending.file.size });
      }

      const { data, error } = await supabase
        .from("memories")
        .insert([
          {
            title: title.trim(),
            caption: caption.trim() || null,
            text: caption.trim() || null,
            image: encodeMemoryMedia({ photoUrl, voiceUrl, attachments }),
            user_id: currentUserId,
            couple_id: couple.id,
          },
        ])
        .select()
        .single<CreatedMemory>();

      if (error || !data) throw error || new Error("Не удалось создать воспоминание");

      onCreated?.(data);
      setTitle("");
      setCaption("");
      if (memoryImage) URL.revokeObjectURL(memoryImage);
      if (memoryVoice) URL.revokeObjectURL(memoryVoice);
      setMemoryImage(null);
      setMemoryImageFile(null);
      setMemoryVoice(null);
      setMemoryVoiceFile(null);
      memoryAttachments.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      setMemoryAttachments([]);
      setMessage("Воспоминание добавлено");

      await createPartnerNotification(couple, currentUserId, {
        type: "memory_added",
        title: "Новое воспоминание",
        body: title.trim() || caption.trim() || "Партнёр добавил воспоминание.",
        href: "/memories",
      }).catch((notificationError) => console.error(notificationError));
    } catch (error) {
      console.error(error);
      if (uploadedPaths.length > 0) {
        await supabase.storage.from("memory-images").remove(uploadedPaths);
      }
      setMessage(
        error instanceof Error
          ? `Не удалось добавить воспоминание: ${error.message}`
          : "Не удалось добавить воспоминание. Попробуйте ещё раз.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function addEmojiToCaption(emoji: string) {
    setCaption((current) => `${current}${emoji}`);
    setIsEmojiPickerOpen(false);
  }

  return (
    <div
      className={
        embedded
          ? "memory-composer-embedded"
          : "mb-10 rounded-[2rem] border border-white/70 bg-white/50 p-5 shadow-[0_28px_90px_rgba(37,99,235,0.16)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/8"
      }
    >
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Заголовок воспоминания"
        className="w-full rounded-2xl border border-blue-200/70 bg-white/75 px-5 py-4 font-bold text-blue-950 outline-none focus:border-blue-400 dark:border-white/10 dark:bg-white/8 dark:text-white"
      />

      <div className="relative mt-4">
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          disabled={isSubmitting}
          className="hidden"
          onChange={(event) => {
            addMemoryAttachments(Array.from(event.target.files || []));
            event.target.value = "";
          }}
        />
        <input ref={fileInputRef} type="file" multiple disabled={isSubmitting} className="hidden" onChange={(event) => { addMemoryAttachments(Array.from(event.target.files || [])); event.target.value = ""; }} />
        <input
          ref={audioInputRef}
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

        <div className="flex min-h-16 items-end gap-1 rounded-2xl border border-blue-200/70 bg-white/75 p-2 text-blue-950 shadow-inner transition focus-within:border-blue-400 focus-within:shadow-[0_0_0_4px_rgba(37,99,235,0.12)] dark:border-white/10 dark:bg-white/8 dark:text-white">
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                setIsAttachMenuOpen((current) => !current);
                setIsEmojiPickerOpen(false);
              }}
              disabled={isSubmitting}
              className={`relative grid h-11 w-11 place-items-center rounded-xl transition hover:bg-blue-100 disabled:opacity-50 dark:hover:bg-white/10 ${
                isAttachMenuOpen || memoryImageFile || memoryVoiceFile || memoryAttachments.length
                  ? "bg-blue-100 text-[#2563eb] dark:bg-blue-500/18 dark:text-blue-100"
                  : "text-blue-500/75 dark:text-white/60"
              }`}
              aria-label="Прикрепить фото или аудиофайл"
              title="Прикрепить"
            >
              <Paperclip aria-hidden="true" size={22} />
              {(memoryImageFile || memoryVoiceFile || memoryAttachments.length > 0) && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#2563eb] ring-2 ring-white dark:ring-[#132238]" />
              )}
            </button>

            {isAttachMenuOpen && (
              <div className="absolute bottom-full left-0 z-30 mb-2 w-52 overflow-hidden rounded-2xl border border-blue-100 bg-white/96 p-2 text-[#1e3a8a] shadow-[0_20px_60px_rgba(37,99,235,0.22)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#071526]/96 dark:text-white">
                <button
                  type="button"
                  onClick={() => {
                    photoInputRef.current?.click();
                    setIsAttachMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-black transition hover:bg-blue-50 dark:hover:bg-white/10"
                >
                  <ImageIcon aria-hidden="true" size={19} />
                  Фото/Видео
                </button>
                <button type="button" onClick={() => { fileInputRef.current?.click(); setIsAttachMenuOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-black transition hover:bg-blue-50 dark:hover:bg-white/10"><FileText aria-hidden="true" size={19} />Файл</button>
                <button
                  type="button"
                  onClick={() => {
                    audioInputRef.current?.click();
                    setIsAttachMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-black transition hover:bg-blue-50 dark:hover:bg-white/10"
                >
                  <Music2 aria-hidden="true" size={19} />
                  {memoryVoiceFile ? "Заменить аудио" : "Добавить аудио"}
                </button>
              </div>
            )}
          </div>

          <textarea
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Описание"
            rows={2}
            className="max-h-40 min-h-11 min-w-0 flex-1 resize-none bg-transparent px-2 py-2.5 font-semibold leading-6 outline-none placeholder:text-blue-400/65 dark:placeholder:text-white/38"
          />

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                setIsEmojiPickerOpen((current) => !current);
                setIsAttachMenuOpen(false);
              }}
              disabled={isSubmitting}
              className={`grid h-11 w-11 place-items-center rounded-xl transition hover:bg-blue-100 disabled:opacity-50 dark:hover:bg-white/10 ${
                isEmojiPickerOpen
                  ? "bg-blue-100 text-[#2563eb] dark:bg-blue-500/18 dark:text-blue-100"
                  : "text-blue-500/75 dark:text-white/60"
              }`}
              aria-label="Добавить эмодзи"
              title="Эмодзи"
            >
              <Smile aria-hidden="true" size={22} />
            </button>

            {isEmojiPickerOpen && (
              <EmojiPicker
                onSelect={addEmojiToCaption}
                tone="blue"
                className="absolute right-0 top-full z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] shadow-[0_20px_60px_rgba(37,99,235,0.22)]"
                compact
                multiple
                autoFocus
              />
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setIsAttachMenuOpen(false);
              setIsEmojiPickerOpen(false);
              void toggleVoiceRecording();
            }}
            disabled={isSubmitting}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition hover:-translate-y-0.5 disabled:opacity-50 ${
              isRecording
                ? "bg-rose-500 text-white shadow-[0_10px_28px_rgba(244,63,94,0.3)]"
                : "text-blue-500/75 hover:bg-blue-100 dark:text-white/60 dark:hover:bg-white/10"
            }`}
            aria-label={isRecording ? "Завершить запись" : "Записать голос"}
            title={isRecording ? "Завершить запись" : "Записать голос"}
          >
            {isRecording ? (
              <Square aria-hidden="true" size={18} fill="currentColor" />
            ) : (
              <Mic aria-hidden="true" size={22} />
            )}
          </button>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={addMemory}
          disabled={
            isSubmitting || (!title.trim() && !caption.trim() && !memoryImageFile && !memoryVoiceFile && memoryAttachments.length === 0)
          }
          className="rounded-2xl bg-[#2563eb] px-7 py-3.5 font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Сохраняем..." : "Добавить воспоминание"}
        </button>
      </div>

      {isRecording && (
        <div className="mt-4 rounded-2xl bg-[#2563eb] p-4 text-white shadow-lg">
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
          alt="Предпросмотр воспоминания"
          width={1200}
          height={600}
          sizes="(min-width: 1280px) 1000px, 100vw"
          unoptimized
          className="mt-5 max-h-80 w-full rounded-[1.5rem] object-cover shadow-2xl"
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
          <AccentAudioPlayer src={memoryVoice} accent="#2563eb" label="Новое голосовое воспоминание" />
        </div>
      )}

      {memoryAttachments.length > 0 && <div className="mt-4 grid gap-2 sm:grid-cols-2">{memoryAttachments.map((item, index) => <div key={`${item.file.name}-${index}`} className="flex min-w-0 items-center gap-3 rounded-2xl border border-blue-200/70 bg-white/70 p-3 shadow-inner dark:border-white/10 dark:bg-white/8">{item.type === "image" ? <Image src={item.previewUrl} alt="Предпросмотр" width={48} height={48} className="h-12 w-12 rounded-xl object-cover" unoptimized /> : item.type === "video" ? <video src={item.previewUrl} className="h-12 w-12 rounded-xl object-cover" muted /> : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-blue-100 text-[#2563eb] dark:bg-white/10 dark:text-blue-100"><FileText size={20} /></span>}<span className="min-w-0 flex-1 truncate text-sm font-black">{item.file.name}</span><button type="button" onClick={() => { URL.revokeObjectURL(item.previewUrl); setMemoryAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index)); }} aria-label="Убрать файл" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-500/12 dark:text-rose-100"><X size={15} /></button></div>)}</div>}

      {message && (
        <p className="mt-4 rounded-2xl bg-white/70 px-5 py-3 font-black text-[#2563eb] shadow-inner dark:bg-white/10 dark:text-blue-100">
          {message}
        </p>
      )}
    </div>
  );
}
