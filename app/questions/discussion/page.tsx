"use client";

import { FluentEmojiText } from "@/components/FluentEmoji";

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
import { createPartnerNotification } from "@/lib/notifications";
import { supabase } from "@/lib/supabaseClient";
import { toBrowserSupabaseUrl } from "@/lib/supabaseUrls";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, MessageCircle, Mic, Paperclip, Send, Square, X } from "lucide-react";

type Couple = {
  id: string;
  partner_one_id: string;
  partner_two_id: string | null;
};

type CoupleProfile = {
  partner_one: string | null;
  partner_two: string | null;
  avatar_one: string | null;
  avatar_two: string | null;
};

type QuestionContext = {
  id: string;
  couple_id: string;
  question: string;
};

type DiscussionMessage = {
  id: string;
  user_id: string;
  text: string | null;
  created_at: string;
  updated_at: string | null;
  attachment_url: string | null;
  attachment_type: "image" | "video" | "audio" | null;
  attachment_name: string | null;
  attachment_mime_type: string | null;
};

type PendingMedia = {
  file: File;
  type: "image" | "video" | "audio";
  previewUrl: string;
};

const messageSelect =
  "id, user_id, text, created_at, updated_at, attachment_url, attachment_type, attachment_name, attachment_mime_type";
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDay(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Сегодня";
  if (date.toDateString() === yesterday.toDateString()) return "Вчера";
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(date);
}

function getInitial(value?: string | null) {
  return value?.trim().slice(0, 1).toUpperCase() || "♡";
}

export default function QuestionDiscussionPage() {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const discardRecordingRef = useRef(false);
  const recordingTimerRef = useRef<number | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [profile, setProfile] = useState<CoupleProfile | null>(null);
  const [question, setQuestion] = useState<QuestionContext | null>(null);
  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pendingMedia, setPendingMedia] = useState<PendingMedia | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  const answerId = question?.id || null;
  const currentName = useMemo(() => {
    if (!couple || !currentUserId) return "Вы";
    return currentUserId === couple.partner_one_id
      ? profile?.partner_one || "Вы"
      : profile?.partner_two || "Вы";
  }, [couple, currentUserId, profile]);
  const partnerName = useMemo(() => {
    if (!couple || !currentUserId) return "Партнёр";
    return currentUserId === couple.partner_one_id
      ? profile?.partner_two || "Партнёр"
      : profile?.partner_one || "Партнёр";
  }, [couple, currentUserId, profile]);
  const currentAvatar = couple && currentUserId === couple.partner_one_id
    ? profile?.avatar_one
    : profile?.avatar_two;
  const partnerAvatar = couple && currentUserId === couple.partner_one_id
    ? profile?.avatar_two
    : profile?.avatar_one;

  useEffect(() => {
    let ignore = false;
    async function loadDiscussion() {
      const requestedAnswerId = new URLSearchParams(window.location.search).get("answerId");
      if (!requestedAnswerId) {
        setErrorMessage("Не удалось определить вопрос для обсуждения.");
        setIsLoading(false);
        return;
      }

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

      const [{ data: questionData }, { data: profileData }, { data: messageData, error }] = await Promise.all([
        supabase
          .from("question_answers")
          .select("id, couple_id, question")
          .eq("id", requestedAnswerId)
          .eq("couple_id", coupleData.id)
          .maybeSingle<QuestionContext>(),
        supabase
          .from("couple_profiles")
          .select("partner_one, partner_two, avatar_one, avatar_two")
          .eq("couple_id", coupleData.id)
          .maybeSingle<CoupleProfile>(),
        supabase
          .from("question_comments")
          .select(messageSelect)
          .eq("question_answer_id", requestedAnswerId)
          .eq("couple_id", coupleData.id)
          .order("created_at", { ascending: true }),
      ]);

      if (ignore) return;
      if (!questionData) {
        setErrorMessage("Этот вопрос недоступен для обсуждения.");
      } else if (error) {
        setErrorMessage("Не удалось загрузить обсуждение.");
      }
      setCurrentUserId(user.id);
      setCouple(coupleData);
      setProfile(profileData || null);
      setQuestion(questionData || null);
      setMessages((messageData || []) as DiscussionMessage[]);
      setIsLoading(false);
    }

    void loadDiscussion();
    return () => { ignore = true; };
  }, [router]);

  useEffect(() => {
    if (!answerId) return;
    const channel = supabase
      .channel(`question-discussion:${answerId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "question_comments",
          filter: `question_answer_id=eq.${answerId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const next = payload.new as DiscussionMessage;
            setMessages((current) => current.some((item) => item.id === next.id) ? current : [...current, next]);
          }
          if (payload.eventType === "UPDATE") {
            const next = payload.new as DiscussionMessage;
            setMessages((current) => current.map((item) => item.id === next.id ? next : item));
          }
          if (payload.eventType === "DELETE") {
            setMessages((current) => current.filter((item) => item.id !== payload.old.id));
          }
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [answerId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  useEffect(() => {
    if (!isRecording) return;
    recordingTimerRef.current = window.setInterval(() => {
      setRecordingSeconds((seconds) => seconds + 1);
    }, 1000);
    return () => {
      if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    };
  }, [isRecording]);

  useEffect(() => () => {
    discardRecordingRef.current = true;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    recorder?.stream.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => () => {
    if (pendingMedia?.previewUrl) URL.revokeObjectURL(pendingMedia.previewUrl);
  }, [pendingMedia]);

  function selectMedia(file: File) {
    const type = getMediaKind(file);
    if (type !== "image" && type !== "video" && type !== "audio") {
      setErrorMessage("Можно прикрепить только фото, видео или аудио.");
      return;
    }
    const maximumSize = type === "audio" ? MAX_AUDIO_SIZE : type === "image" ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
    const validation = validateMediaFile(file, ["image", "video", "audio"], maximumSize);
    if (validation.error) {
      setErrorMessage(validation.error);
      return;
    }
    setErrorMessage("");
    setPendingMedia({ file, type, previewUrl: URL.createObjectURL(file) });
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = createCompatibleAudioRecorder(stream);
      audioChunksRef.current = [];
      discardRecordingRef.current = false;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        if (!discardRecordingRef.current) {
          try {
            selectMedia(createRecordedAudioFile(audioChunksRef.current, recorder.mimeType, "question-voice"));
          } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Не удалось сохранить голосовое.");
          }
        }
        audioChunksRef.current = [];
        recorderRef.current = null;
        discardRecordingRef.current = false;
      };
      recorder.start();
      setRecordingSeconds(0);
      setIsRecording(true);
    } catch {
      setErrorMessage("Не удалось получить доступ к микрофону.");
    }
  }

  function stopRecording(discard = false) {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    discardRecordingRef.current = discard;
    recorder.stop();
    setIsRecording(false);
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!question || !couple || !currentUserId || isSending) return;
    const text = draft.trim().slice(0, 1000);
    if (!text && !pendingMedia) return;
    setIsSending(true);
    setErrorMessage("");

    let attachmentUrl: string | null = null;
    let uploadedPath: string | null = null;
    let uploadFile = pendingMedia?.file || null;
    try {
      if (uploadFile && pendingMedia?.type === "image") {
        uploadFile = await compressImageFile(uploadFile);
      }
      if (uploadFile && pendingMedia) {
        uploadedPath = getSafeStoragePath(couple.id, uploadFile);
        const { error: uploadError } = await supabase.storage
          .from("question-media")
          .upload(uploadedPath, uploadFile, { upsert: false });
        if (uploadError) throw uploadError;
        attachmentUrl = supabase.storage.from("question-media").getPublicUrl(uploadedPath).data.publicUrl;
      }

      const { data, error } = await supabase
        .from("question_comments")
        .insert([{
          question_answer_id: question.id,
          couple_id: couple.id,
          user_id: currentUserId,
          text,
          attachment_url: attachmentUrl,
          attachment_type: pendingMedia?.type || null,
          attachment_name: uploadFile?.name || null,
          attachment_mime_type: uploadFile?.type || null,
        }])
        .select(messageSelect)
        .single<DiscussionMessage>();
      if (error || !data) throw error || new Error("Не удалось отправить сообщение");

      setMessages((current) => current.some((item) => item.id === data.id) ? current : [...current, data]);
      setDraft("");
      setPendingMedia(null);
      await createPartnerNotification(couple, currentUserId, {
        type: "question_comment",
        title: "Новое сообщение в обсуждении",
        body: text || (pendingMedia?.type === "audio" ? "Голосовое сообщение" : "Новое вложение"),
        href: `/questions/discussion?answerId=${question.id}`,
      });
    } catch (error) {
      if (uploadedPath) await supabase.storage.from("question-media").remove([uploadedPath]);
      setErrorMessage(error instanceof Error ? error.message : "Не удалось отправить сообщение.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="question-discussion-page mobile-fullscreen relative h-[100dvh] overflow-hidden bg-[#ecfdf5] text-emerald-950 dark:bg-[#03140c] dark:text-white md:px-6 md:pb-8 md:pt-24">
      <section className="relative mx-auto flex h-full max-w-4xl flex-col overflow-hidden bg-white/78 shadow-[0_24px_90px_rgba(5,150,105,0.16)] backdrop-blur-xl dark:bg-[#061b12]/96 md:rounded-[2rem] md:border md:border-emerald-200/60 dark:md:border-white/10">
        <header className="question-discussion-header relative z-20 flex min-h-[4.4rem] shrink-0 items-center gap-3 border-b border-emerald-100 bg-white/88 px-3 py-2 backdrop-blur-2xl dark:border-white/10 dark:bg-[#071c13]/92">
          <button type="button" onClick={() => router.back()} aria-label="Назад" className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-emerald-100 bg-white text-emerald-700 shadow-sm dark:border-white/10 dark:bg-white/8 dark:text-emerald-100">
            <ArrowLeft aria-hidden="true" size={24} />
          </button>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/16 dark:text-emerald-100">
            <MessageCircle aria-hidden="true" size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-black">Обсуждение</h1>
            <p className="truncate text-xs font-semibold text-emerald-800/48 dark:text-white/45">{question?.question || "Вопрос дня"}</p>
          </div>
        </header>

        <div className="question-discussion-chat-bg min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
          {isLoading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-14 w-3/5 rounded-3xl bg-emerald-100/80 dark:bg-white/8" />
              <div className="ml-auto h-20 w-4/5 rounded-3xl bg-emerald-300/45 dark:bg-emerald-500/12" />
            </div>
          ) : messages.length === 0 && !errorMessage ? (
            <div className="grid h-full place-items-center text-center">
              <div className="max-w-xs rounded-3xl bg-white/78 p-5 shadow-sm dark:bg-white/8">
                <MessageCircle className="mx-auto text-emerald-500" size={34} />
                <p className="mt-3 font-black">Начните обсуждение</p>
                <p className="mt-1 text-sm font-semibold opacity-50">Здесь можно поделиться мыслью, фото или голосовым.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {messages.map((message, index) => {
                const isMine = message.user_id === currentUserId;
                const previous = messages[index - 1];
                const sameDay = previous && new Date(previous.created_at).toDateString() === new Date(message.created_at).toDateString();
                const name = isMine ? currentName : partnerName;
                const avatar = isMine ? currentAvatar : partnerAvatar;
                const mediaUrl = toBrowserSupabaseUrl(message.attachment_url);
                return (
                  <div key={message.id}>
                    {!sameDay && <div className="mx-auto my-4 w-fit rounded-full bg-white/85 px-3 py-1 text-xs font-black text-emerald-700 shadow-sm dark:bg-black/30 dark:text-emerald-100">{formatDay(message.created_at)}</div>}
                    <div className={`flex items-end gap-2 ${isMine ? "justify-end" : "justify-start"}`}>
                      {!isMine && (avatar ? <Image src={toBrowserSupabaseUrl(avatar) || avatar} alt={name} width={30} height={30} sizes="30px" className="h-7 w-7 shrink-0 rounded-full object-cover" unoptimized /> : <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs font-black text-emerald-700 dark:bg-white/10 dark:text-white">{getInitial(name)}</span>)}
                      <article className={`question-discussion-bubble max-w-[82%] overflow-hidden rounded-[1.35rem] px-3 py-2 shadow-sm ${isMine ? "is-mine rounded-br-md bg-emerald-500 text-white" : "rounded-bl-md bg-white text-emerald-950 dark:bg-white/10 dark:text-white"}`}>
                        {mediaUrl && message.attachment_type === "image" && <Image src={mediaUrl} alt={message.attachment_name || "Фото"} width={720} height={520} sizes="(max-width: 768px) 76vw, 520px" className="mb-2 max-h-80 w-full rounded-2xl object-cover" unoptimized />}
                        {mediaUrl && message.attachment_type === "video" && <video src={mediaUrl} controls playsInline preload="metadata" className="mb-2 max-h-80 w-full rounded-2xl bg-black" />}
                        {mediaUrl && message.attachment_type === "audio" && <div className="mb-1 min-w-[min(17rem,68vw)]"><AccentAudioPlayer src={mediaUrl} accent={isMine ? "#ffffff" : "#10b981"} label="Голосовое сообщение" /></div>}
                        {message.text && <p className="whitespace-pre-wrap break-words text-sm font-semibold leading-5"><FluentEmojiText>{message.text}</FluentEmojiText></p>}
                        <p className={`mt-1 text-right text-[10px] font-bold ${isMine ? "text-white/65" : "text-emerald-800/40 dark:text-white/38"}`}>{formatTime(message.created_at)}</p>
                      </article>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <form onSubmit={sendMessage} className="question-discussion-form relative z-20 shrink-0 border-t border-emerald-100 bg-white/90 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-2xl dark:border-white/10 dark:bg-[#071c13]/94">
          {errorMessage && <p className="mb-2 rounded-2xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-600 dark:bg-rose-500/12 dark:text-rose-100">{errorMessage}</p>}
          {pendingMedia && (
            <div className="mb-2 flex items-center gap-3 rounded-2xl bg-emerald-50 p-2 dark:bg-white/8">
              {pendingMedia.type === "image" && <Image src={pendingMedia.previewUrl} alt="Предпросмотр" width={54} height={54} className="h-12 w-12 rounded-xl object-cover" unoptimized />}
              {pendingMedia.type === "video" && <video src={pendingMedia.previewUrl} className="h-12 w-12 rounded-xl object-cover" muted />}
              {pendingMedia.type === "audio" && <span className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-500 text-white"><Mic size={20} /></span>}
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{pendingMedia.file.name}</p><p className="text-xs font-semibold opacity-45">Готово к отправке</p></div>
              <button type="button" onClick={() => setPendingMedia(null)} aria-label="Убрать вложение" className="grid h-9 w-9 place-items-center rounded-full bg-white text-emerald-700 shadow-sm dark:bg-black/25 dark:text-white"><X size={17} /></button>
            </div>
          )}
          {isRecording && (
            <div className="mb-2 flex items-center gap-3 rounded-2xl bg-emerald-50 px-3 py-2 text-emerald-800 dark:bg-emerald-500/12 dark:text-emerald-100">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" />
              <p className="flex-1 text-sm font-black">Запись · {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, "0")}</p>
              <button type="button" onClick={() => stopRecording(true)} className="rounded-full px-3 py-1 text-xs font-black">Отменить</button>
              <button type="button" onClick={() => stopRecording(false)} className="grid h-9 w-9 place-items-center rounded-full bg-emerald-500 text-white"><Square size={14} fill="currentColor" /></button>
            </div>
          )}
          <div className="question-discussion-composer flex items-end gap-2 rounded-[1.45rem] border border-emerald-100 bg-white p-1.5 shadow-sm dark:border-white/10 dark:bg-white/8">
            <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*,.m4a,.mp3,.ogg,.wav,.webm" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) selectMedia(file); event.target.value = ""; }} />
            <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Прикрепить медиа" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-emerald-600 transition hover:bg-emerald-50 dark:text-emerald-100 dark:hover:bg-white/8"><Paperclip size={21} /></button>
            <textarea value={draft} onChange={(event) => { setDraft(event.target.value); event.currentTarget.style.height = "auto"; event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 112)}px`; }} rows={1} maxLength={1000} placeholder="Сообщение" className="max-h-28 min-h-10 min-w-0 flex-1 resize-none bg-transparent px-1 py-2.5 text-sm font-semibold outline-none placeholder:text-emerald-800/35 dark:placeholder:text-white/35" />
            {draft.trim() || pendingMedia ? (
              <button type="submit" disabled={isSending} aria-label="Отправить" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-500 text-white shadow-md disabled:opacity-45"><Send size={18} /></button>
            ) : (
              <button type="button" onClick={() => isRecording ? stopRecording(false) : void startRecording()} aria-label="Записать голосовое" className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-white shadow-md ${isRecording ? "bg-rose-500" : "bg-emerald-500"}`}><Mic size={19} /></button>
            )}
          </div>
        </form>
      </section>
    </main>
  );
}
