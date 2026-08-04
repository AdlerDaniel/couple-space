"use client";

import { getDailyQuestion, getDailyQuestionDate } from "@/lib/dailyQuestions";
import AccentAudioPlayer from "@/components/AccentAudioPlayer";
import { compressImageFile } from "@/lib/imageCompression";
import {
  createCompatibleAudioRecorder,
  createRecordedAudioFile,
  getSafeStoragePath,
  MAX_AUDIO_SIZE,
  MAX_IMAGE_SIZE,
  validateMediaFile,
} from "@/lib/mediaFiles";
import { createPartnerNotification } from "@/lib/notifications";
import { supabase } from "@/lib/supabaseClient";
import { toPortableSupabaseUrl } from "@/lib/supabaseUrls";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ImageIcon, Mic, Music2, Paperclip } from "lucide-react";

const EDIT_WINDOW_MINUTES = 15;
const EDIT_WINDOW_MS = EDIT_WINDOW_MINUTES * 60 * 1000;
const ANSWER_MAX_LENGTH = 600;

type Couple = {
  id: string;
  partner_one_id: string;
  partner_two_id: string | null;
};

type Answer = {
  id: string;
  question: string;
  answer_one: string | null;
  answer_two: string | null;
  answer_one_edited_at?: string | null;
  answer_two_edited_at?: string | null;
  answer_one_voice_url?: string | null;
  answer_two_voice_url?: string | null;
  answer_one_photo_url?: string | null;
  answer_two_photo_url?: string | null;
  date: string;
  couple_id: string;
};

export default function QuestionAnswerPage() {
  const router = useRouter();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const discardRecordingRef = useRef(false);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [answerRecord, setAnswerRecord] = useState<Answer | null>(null);
  const [myAnswer, setMyAnswer] = useState("");
  const [lastSavedAnswer, setLastSavedAnswer] = useState("");
  const [message, setMessage] = useState("");
  const [saveStatus, setSaveStatus] = useState("Введите ответ, он сохранится автоматически");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [nowMs, setNowMs] = useState(0);
  const [dailyQuestionState, setDailyQuestionState] = useState(() => ({
    question: getDailyQuestion(),
    date: getDailyQuestionDate(),
  }));

  const questionOfTheDay = dailyQuestionState.question;
  const todayDate = dailyQuestionState.date;
  const isPartnerOne = currentUserId === couple?.partner_one_id;
  const answerField = isPartnerOne ? "answer_one" : "answer_two";
  const editedAtField = isPartnerOne ? "answer_one_edited_at" : "answer_two_edited_at";
  const voiceField = isPartnerOne ? "answer_one_voice_url" : "answer_two_voice_url";
  const photoField = isPartnerOne ? "answer_one_photo_url" : "answer_two_photo_url";
  const firstSavedAt = answerRecord?.[editedAtField] || null;
  const isEditLocked =
    nowMs > 0 &&
    Boolean(firstSavedAt) &&
    new Date(firstSavedAt as string).getTime() + EDIT_WINDOW_MS < nowMs;
  const voiceUrl = (answerRecord?.[voiceField] as string | null | undefined) || null;
  const photoUrl = (answerRecord?.[photoField] as string | null | undefined) || null;
  const hasSavedAnswer = Boolean(lastSavedAnswer.trim() || voiceUrl || photoUrl);

  function openAnswers() {
    if (answerRecord && couple && currentUserId) {
      sessionStorage.setItem(
        "couple-space:today-question-cache",
        JSON.stringify({
          answerRecord,
          couple,
          currentUserId,
          dailyQuestionState: {
            date: todayDate,
            question: questionOfTheDay,
            timeZone: "Europe/Moscow",
          },
          savedAt: Date.now(),
        }),
      );
    }
    router.push("/questions/today");
  }

  function formatRecordingTime(seconds: number) {
    const minutes = Math.floor(seconds / 60);
    const rest = Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0");
    return `${minutes}:${rest}`;
  }

  function resizeTextarea() {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  const saveMyAnswer = useCallback(
    async (answerToSave = myAnswer.trim()) => {
      if (!couple || !currentUserId || !answerToSave || isEditLocked) return;

      setIsSaving(true);
      const firstSaveDate = firstSavedAt || new Date().toISOString();

      if (answerRecord) {
        const hadAnswerBefore = Boolean(
          answerRecord[answerField] ||
            answerRecord[voiceField] ||
            answerRecord[photoField]
        );
        const { data, error } = await supabase
          .from("question_answers")
          .update({
            [answerField]: answerToSave,
            [editedAtField]: firstSaveDate,
          })
          .eq("id", answerRecord.id)
          .select()
          .single();

        if (error) {
          console.error(error);
          setMessage(error.message);
          setSaveStatus("Не удалось сохранить");
          setIsSaving(false);
          return;
        }

        setAnswerRecord(data);
        setLastSavedAnswer(answerToSave);
        setSaveStatus("Ответ сохранён автоматически");
        if (!hadAnswerBefore) {
          await createPartnerNotification(couple, currentUserId, {
            type: "question_answered",
            title: "Ответ на вопрос дня",
            body: "Партнёр ответил на ежедневный вопрос.",
            href: "/questions/today",
          });
        }
        setIsSaving(false);
        return;
      }

      const { data, error } = await supabase
        .from("question_answers")
        .insert([
          {
            question: questionOfTheDay,
            date: todayDate,
            couple_id: couple.id,
            [answerField]: answerToSave,
            [editedAtField]: firstSaveDate,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error(error);
        setMessage(error.message);
        setSaveStatus("Не удалось сохранить");
        setIsSaving(false);
        return;
      }

      setAnswerRecord(data);
      setLastSavedAnswer(answerToSave);
      setSaveStatus("Ответ сохранён автоматически");
      await createPartnerNotification(couple, currentUserId, {
        type: "question_answered",
        title: "Ответ на вопрос дня",
        body: "Партнёр ответил на ежедневный вопрос.",
        href: "/questions/today",
      });
      setIsSaving(false);
    },
    [
      answerField,
      answerRecord,
      couple,
      currentUserId,
      editedAtField,
      firstSavedAt,
      isEditLocked,
      myAnswer,
      photoField,
      questionOfTheDay,
      todayDate,
      voiceField,
    ]
  );

  async function ensureAnswerRecord(fallbackText: string) {
    if (answerRecord) return answerRecord;
    if (!couple || !currentUserId) return null;

    const firstSaveDate = firstSavedAt || new Date().toISOString();
    const { data, error } = await supabase
      .from("question_answers")
      .insert([
        {
          question: questionOfTheDay,
          date: todayDate,
          couple_id: couple.id,
          [answerField]: myAnswer.trim() || fallbackText,
          [editedAtField]: firstSaveDate,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error(error);
      setMessage(error.message);
      return null;
    }

    setAnswerRecord(data);
    setLastSavedAnswer(data[answerField] || fallbackText);
    setSaveStatus("Ответ сохранён автоматически");
    return data as Answer;
  }

  async function uploadAnswerMedia(file: File, urlField: string, fallbackText: string) {
    if (!couple || isEditLocked) return;

    const isVoice = urlField.includes("voice");
    const validation = validateMediaFile(
      file,
      [isVoice ? "audio" : "image"],
      isVoice ? MAX_AUDIO_SIZE : MAX_IMAGE_SIZE
    );
    if (validation.error) {
      setMessage(validation.error);
      return;
    }

    setIsUploadingMedia(true);
    setMessage("");
    let filePath: string | null = null;

    try {
      const uploadFile = validation.kind === "image"
        ? await compressImageFile(file, {
            maxWidth: 1600,
            maxHeight: 1600,
            quality: 0.78,
          })
        : file;
      filePath = getSafeStoragePath(couple.id, uploadFile);
      const { error: uploadError } = await supabase.storage
        .from("question-media")
        .upload(filePath, uploadFile, { upsert: false });

      if (uploadError) throw uploadError;

      const createdRecordForMedia = !answerRecord;
      const activeRecord = await ensureAnswerRecord(fallbackText);
      if (!activeRecord) throw new Error("Не удалось создать ответ для медиа");

      const hadMediaBefore = Boolean(activeRecord[urlField as keyof Answer]);
      const hadAnswerBefore = Boolean(
        activeRecord[answerField] ||
          activeRecord[voiceField] ||
          activeRecord[photoField]
      );
      const { data: publicUrlData } = supabase.storage
        .from("question-media")
        .getPublicUrl(filePath);
      const publicUrl = toPortableSupabaseUrl(publicUrlData.publicUrl);

      const { data, error } = await supabase
        .from("question_answers")
        .update({ [urlField]: publicUrl })
        .eq("id", activeRecord.id)
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setAnswerRecord(data);
        setSaveStatus("Медиа сохранено");
      }

      if (data && !hadMediaBefore && currentUserId) {
        await createPartnerNotification(couple, currentUserId, {
          type: isVoice ? "question_voice" : "question_photo",
          title: isVoice ? "Голосовой ответ" : "Фото-ответ",
          body: hadAnswerBefore && !createdRecordForMedia
            ? "Партнёр добавил медиа к ответу."
            : "Партнёр ответил на ежедневный вопрос.",
          href: "/questions/today",
        });
      }
    } catch (error) {
      console.error(error);
      if (filePath) {
        await supabase.storage.from("question-media").remove([filePath]);
      }
      setMessage(
        error instanceof Error
          ? `Не удалось загрузить медиа: ${error.message}`
          : "Не удалось загрузить медиа. Попробуйте ещё раз."
      );
    } finally {
      setIsUploadingMedia(false);
    }
  }

  async function toggleVoiceRecording() {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      setIsRecordingPaused(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = createCompatibleAudioRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current = recorder;
      discardRecordingRef.current = false;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
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
          const audioFile = createRecordedAudioFile(
            audioChunksRef.current,
            recorder.mimeType,
            "voice-answer"
          );
          uploadAnswerMedia(audioFile, voiceField, "Голосовой ответ");
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
      return;
    }

    if (recorder.state === "paused") {
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
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      return;
    }

    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds((current) => current + 1);
    }, 1000);

    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
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
    async function loadPageData() {
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

      const { data: profileData } = await supabase
        .from("couple_profiles")
        .select("time_zone")
        .eq("couple_id", coupleData.id)
        .limit(1)
        .maybeSingle<{ time_zone: string | null }>();

      const timeZone = profileData?.time_zone || "Europe/Moscow";
      const activeQuestion = getDailyQuestion(new Date(), timeZone);
      const activeDate = getDailyQuestionDate(new Date(), timeZone);
      setDailyQuestionState({ question: activeQuestion, date: activeDate });

      const { data: answerData } = await supabase
        .from("question_answers")
        .select("*")
        .eq("couple_id", coupleData.id)
        .eq("date", activeDate)
        .eq("question", activeQuestion)
        .limit(1)
        .single();

      if (answerData) {
        const savedAnswer =
          user.id === coupleData.partner_one_id
            ? answerData.answer_one || ""
            : answerData.answer_two || "";

        setAnswerRecord(answerData);
        setMyAnswer(savedAnswer);
        setLastSavedAnswer(savedAnswer);
        setSaveStatus(
          savedAnswer ? "Ответ сохранён автоматически" : "Введите ответ, он сохранится автоматически"
        );
      }

      setIsLoaded(true);
      setNowMs(Date.now());
    }

    loadPageData();
  }, [router]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [myAnswer]);

  useEffect(() => {
    if (!isLoaded || !couple || !currentUserId || isEditLocked) return;

    const trimmedAnswer = myAnswer.trim();
    if (!trimmedAnswer || trimmedAnswer === lastSavedAnswer.trim()) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      saveMyAnswer(trimmedAnswer);
    }, 900);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [
    couple,
    currentUserId,
    isEditLocked,
    isLoaded,
    lastSavedAnswer,
    myAnswer,
    saveMyAnswer,
  ]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f0fff7] px-4 pb-32 pt-24 text-[#14532d] transition-colors dark:bg-[#02140b] dark:text-white sm:px-6 md:pt-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_24%_14%,rgba(34,197,94,0.24),transparent_34%),radial-gradient(circle_at_82%_22%,rgba(20,184,166,0.18),transparent_30%),linear-gradient(135deg,#e7fff2_0%,#f4fff9_48%,#e9fff7_100%)] dark:bg-[radial-gradient(circle_at_24%_14%,rgba(34,197,94,0.16),transparent_34%),radial-gradient(circle_at_82%_22%,rgba(20,184,166,0.15),transparent_30%),linear-gradient(135deg,#03170c_0%,#062315_48%,#02100a_100%)]" />

      <section className="questions-reveal relative mx-auto max-w-4xl">
        <button
          onClick={() => router.push("/questions")}
          className="mb-6 rounded-full border border-emerald-200/70 bg-white/45 px-5 py-2 text-sm font-bold text-emerald-700 shadow-lg backdrop-blur-xl transition hover:bg-emerald-50 dark:border-white/10 dark:bg-white/8 dark:text-emerald-200 dark:hover:bg-emerald-500/15"
        >
          Назад к вопросу
        </button>

        <div className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/55 p-3 shadow-[0_32px_110px_rgba(21,128,61,0.2)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/8 sm:rounded-[2.5rem] sm:p-6">
          <div className="rounded-[1.5rem] bg-gradient-to-br from-[#d9ffe9] via-[#effff6] to-[#d8fff4] p-4 dark:from-[#082a18] dark:via-[#0b2418] dark:to-[#063025] sm:rounded-[2rem] sm:p-7 md:p-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-black uppercase tracking-wide text-emerald-600/75 dark:text-emerald-200/70">
                Вопрос дня
              </p>
              <span className="rounded-full bg-white/65 px-4 py-2 text-sm font-black text-emerald-700 shadow-inner dark:bg-white/10 dark:text-emerald-100">
                {hasSavedAnswer ? "Вы ответили" : "Черновик"}
              </span>
            </div>

            <h1 className="mt-4 text-3xl font-black leading-tight text-[#15803d] dark:text-white md:text-5xl">
              {questionOfTheDay}
            </h1>

            <div className="mt-8 rounded-[1.7rem] bg-white/72 p-4 shadow-inner dark:bg-black/18">
              <textarea
                ref={textareaRef}
                value={myAnswer}
                onChange={(event) => {
                  const nextAnswer = event.target.value.slice(0, ANSWER_MAX_LENGTH);
                  setMyAnswer(nextAnswer);
                  if (nextAnswer.trim() !== lastSavedAnswer.trim()) {
                    setSaveStatus("Сохраняем...");
                  }
                }}
                disabled={isEditLocked}
                maxLength={ANSWER_MAX_LENGTH}
                placeholder="Напиши свой ответ..."
                className="min-h-[180px] w-full resize-none overflow-hidden rounded-[1.3rem] border border-emerald-200/80 bg-white/82 p-5 text-lg font-semibold leading-8 text-emerald-950 shadow-[0_18px_50px_rgba(21,128,61,0.12)] outline-none transition placeholder:text-emerald-700/38 focus:border-emerald-400 focus:shadow-[0_0_0_4px_rgba(20,184,166,0.14),0_22px_70px_rgba(21,128,61,0.18)] disabled:cursor-not-allowed disabled:opacity-65 dark:border-white/10 dark:bg-white/10 dark:text-white dark:placeholder:text-white/36 dark:focus:shadow-[0_0_0_4px_rgba(52,211,153,0.14),0_22px_70px_rgba(0,0,0,0.32)]"
              />

              <div className="mt-3 flex items-center justify-between gap-4 text-sm font-bold text-emerald-800/55 dark:text-white/45">
                <span>{myAnswer.length > 0 ? "Автосохранение включено" : "Начните писать ответ"}</span>
                <span>{myAnswer.length}/{ANSWER_MAX_LENGTH}</span>
              </div>

              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*,.m4a,.mp3,.ogg,.wav,.webm"
                disabled={isEditLocked || isUploadingMedia}
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadAnswerMedia(file, voiceField, "Голосовой ответ");
                  event.target.value = "";
                }}
              />
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                disabled={isEditLocked || isUploadingMedia}
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadAnswerMedia(file, photoField, "Фото-ответ");
                  event.target.value = "";
                }}
              />

              <div className="relative mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsAttachMenuOpen((current) => !current)}
                  disabled={isEditLocked || isUploadingMedia}
                  aria-label="Добавить вложение"
                  aria-expanded={isAttachMenuOpen}
                  className={`grid h-11 w-11 place-items-center rounded-full border shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 ${
                    isAttachMenuOpen || voiceUrl || photoUrl
                      ? "border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-300/20 dark:bg-emerald-500/18 dark:text-emerald-100"
                      : "border-emerald-200/80 bg-white/76 text-emerald-700 dark:border-white/10 dark:bg-white/8 dark:text-emerald-100"
                  }`}
                >
                  <Paperclip aria-hidden="true" size={20} />
                </button>

                {isAttachMenuOpen && (
                  <div className="absolute bottom-[3.25rem] right-0 z-30 w-56 overflow-hidden rounded-2xl border border-emerald-200/80 bg-white/96 p-2 text-emerald-950 shadow-[0_20px_60px_rgba(5,150,105,0.2)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#071c13]/96 dark:text-white">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAttachMenuOpen(false);
                        void toggleVoiceRecording();
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-black transition hover:bg-emerald-50 dark:hover:bg-white/8"
                    >
                      <Mic aria-hidden="true" size={19} />
                      {isRecording ? "Завершить запись" : "Записать голос"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAttachMenuOpen(false);
                        audioInputRef.current?.click();
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-black transition hover:bg-emerald-50 dark:hover:bg-white/8"
                    >
                      <Music2 aria-hidden="true" size={19} />
                      Загрузить аудио
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAttachMenuOpen(false);
                        photoInputRef.current?.click();
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-black transition hover:bg-emerald-50 dark:hover:bg-white/8"
                    >
                      <ImageIcon aria-hidden="true" size={19} />
                      Загрузить фото
                    </button>
                  </div>
                )}
              </div>

              {isRecording && (
                <div className="mt-4 rounded-[1.2rem] border border-emerald-200/70 bg-gradient-to-r from-emerald-500 to-teal-500 p-4 text-white shadow-[0_18px_55px_rgba(21,128,61,0.24)]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={`h-3 w-3 rounded-full bg-white ${isRecordingPaused ? "" : "animate-pulse"}`} />
                      <div>
                        <p className="font-black">{isRecordingPaused ? "Запись на паузе" : "Идёт запись"}</p>
                        <div className="mt-2 flex h-6 items-center gap-[2px]">
                          {Array.from({ length: 28 }).map((_, index) => (
                            <span
                              key={index}
                              className={`w-1 rounded-full bg-white/75 ${isRecordingPaused ? "" : "chat-voice-wave"}`}
                              style={{
                                height: Math.max(5, 10 + Math.sin(index * 0.8) * 8),
                                animationDelay: `${index * 0.04}s`,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    <span className="rounded-full bg-white/18 px-3 py-1 text-sm font-black">
                      {formatRecordingTime(recordingSeconds)}
                    </span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={toggleVoicePause} className="rounded-full bg-white/18 px-4 py-2 text-sm font-black transition hover:bg-white/25">
                      {isRecordingPaused ? "Продолжить" : "Пауза"}
                    </button>
                    <button type="button" onClick={cancelVoiceRecording} className="rounded-full bg-white/18 px-4 py-2 text-sm font-black transition hover:bg-white/25">
                      Отмена
                    </button>
                    <button type="button" onClick={toggleVoiceRecording} className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700 transition hover:bg-emerald-100 dark:bg-white/12 dark:text-emerald-100 dark:hover:bg-emerald-500/20">
                      Готово
                    </button>
                  </div>
                </div>
              )}

              {(voiceUrl || photoUrl || isUploadingMedia) && (
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {voiceUrl && (
                    <div className="rounded-[1.2rem] border border-emerald-200/70 bg-white/68 p-4 shadow-inner dark:border-white/10 dark:bg-white/8">
                      <p className="mb-3 text-sm font-black text-emerald-700 dark:text-emerald-100">
                        Голосовой ответ
                      </p>
                      <AccentAudioPlayer src={voiceUrl} accent="#16a34a" label="Голосовой ответ" />
                    </div>
                  )}
                  {photoUrl && (
                    <div className="rounded-[1.2rem] border border-emerald-200/70 bg-white/68 p-3 shadow-inner dark:border-white/10 dark:bg-white/8">
                      <Image
                        src={photoUrl}
                        alt="Фото-ответ"
                        width={720}
                        height={420}
                        sizes="(min-width: 768px) 50vw, 100vw"
                        className="max-h-64 w-full rounded-[0.9rem] object-cover"
 unoptimized />
                    </div>
                  )}
                  {isUploadingMedia && (
                    <div className="rounded-[1.2rem] border border-emerald-200/70 bg-white/68 p-4 text-sm font-black text-emerald-700 shadow-inner dark:border-white/10 dark:bg-white/8 dark:text-emerald-100">
                      Загружаем медиа...
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-bold text-emerald-700 dark:text-emerald-200">
                    {isEditLocked
                      ? "Время редактирования истекло"
                      : saveStatus}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-emerald-800/55 dark:text-white/45">
                    Редактировать можно {EDIT_WINDOW_MINUTES} минут после первого сохранения.
                  </p>
                </div>

                <button
                  onClick={openAnswers}
                  disabled={!hasSavedAnswer || isSaving}
                  className="rounded-full bg-gradient-to-r from-[#15803d] to-[#14b8a6] px-8 py-3 font-black text-white shadow-[0_18px_55px_rgba(21,128,61,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_70px_rgba(21,128,61,0.38)] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  Открыть ответы
                </button>
              </div>

              {message && (
                <p className="mt-4 text-center font-bold text-emerald-700 dark:text-emerald-200">
                  {message}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
