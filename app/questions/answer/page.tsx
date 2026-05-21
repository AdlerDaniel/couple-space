"use client";

import { getDailyQuestion, getDailyQuestionDate } from "@/lib/dailyQuestions";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

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
  const [isLoaded, setIsLoaded] = useState(false);
  const [nowMs, setNowMs] = useState(0);

  const questionOfTheDay = getDailyQuestion();
  const todayDate = getDailyQuestionDate();
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
  const hasSavedAnswer = Boolean(lastSavedAnswer.trim());
  const voiceUrl = (answerRecord?.[voiceField] as string | null | undefined) || null;
  const photoUrl = (answerRecord?.[photoField] as string | null | undefined) || null;

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
      questionOfTheDay,
      todayDate,
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

    setIsUploadingMedia(true);
    const activeRecord = await ensureAnswerRecord(fallbackText);

    if (!activeRecord) {
      setIsUploadingMedia(false);
      return;
    }

    const filePath = `${couple.id}/${activeRecord.id}/${crypto.randomUUID()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("question-media")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.error(uploadError);
      setMessage("Не удалось загрузить медиа. Проверьте bucket question-media.");
      setIsUploadingMedia(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("question-media")
      .getPublicUrl(filePath);

    const { data, error } = await supabase
      .from("question_answers")
      .update({ [urlField]: publicUrlData.publicUrl })
      .eq("id", activeRecord.id)
      .select()
      .single();

    if (error) {
      console.error(error);
      setMessage(error.message);
    } else if (data) {
      setAnswerRecord(data);
      setSaveStatus("Медиа сохранено");
    }

    setIsUploadingMedia(false);
  }

  async function toggleVoiceRecording() {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const audioFile = new File([audioBlob], "voice-answer.webm", {
          type: "audio/webm",
        });
        uploadAnswerMedia(audioFile, voiceField, "Голосовой ответ");
      };

      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error(error);
      setMessage("Не удалось включить микрофон");
    }
  }

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

      const { data: answerData } = await supabase
        .from("question_answers")
        .select("*")
        .eq("couple_id", coupleData.id)
        .eq("date", todayDate)
        .eq("question", questionOfTheDay)
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
  }, [router, questionOfTheDay, todayDate]);

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
    <main className="relative min-h-screen overflow-hidden bg-[#f0fff7] px-6 pb-20 pt-28 text-[#14532d] transition-colors dark:bg-[#02140b] dark:text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_24%_14%,rgba(34,197,94,0.24),transparent_34%),radial-gradient(circle_at_82%_22%,rgba(20,184,166,0.18),transparent_30%),linear-gradient(135deg,#e7fff2_0%,#f4fff9_48%,#e9fff7_100%)] dark:bg-[radial-gradient(circle_at_24%_14%,rgba(34,197,94,0.16),transparent_34%),radial-gradient(circle_at_82%_22%,rgba(20,184,166,0.15),transparent_30%),linear-gradient(135deg,#03170c_0%,#062315_48%,#02100a_100%)]" />

      <section className="questions-reveal relative mx-auto max-w-4xl">
        <button
          onClick={() => router.push("/questions")}
          className="mb-6 rounded-full border border-emerald-200/70 bg-white/45 px-5 py-2 text-sm font-bold text-emerald-700 shadow-lg backdrop-blur-xl transition hover:bg-white/70 dark:border-white/10 dark:bg-white/8 dark:text-emerald-200"
        >
          Назад к вопросу
        </button>

        <div className="overflow-hidden rounded-[2.5rem] border border-white/70 bg-white/55 p-6 shadow-[0_32px_110px_rgba(21,128,61,0.2)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/8">
          <div className="rounded-[2rem] bg-gradient-to-br from-[#d9ffe9] via-[#effff6] to-[#d8fff4] p-7 dark:from-[#082a18] dark:via-[#0b2418] dark:to-[#063025] md:p-10">
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

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={toggleVoiceRecording}
                  disabled={isEditLocked || isUploadingMedia}
                  className={`rounded-[1.2rem] border px-5 py-4 text-left font-black shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55 ${
                    isRecording
                      ? "border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-300/20 dark:bg-rose-400/12 dark:text-rose-100"
                      : "border-emerald-200/70 bg-white/70 text-emerald-700 dark:border-white/10 dark:bg-white/8 dark:text-emerald-100"
                  }`}
                >
                  <span className="block text-sm uppercase opacity-70">
                    Голосовой ответ
                  </span>
                  <span className="mt-1 block">
                    {isRecording ? "Остановить запись" : "Записать голос"}
                  </span>
                </button>

                <label className="cursor-pointer rounded-[1.2rem] border border-emerald-200/70 bg-white/70 px-5 py-4 text-left font-black text-emerald-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-white/85 dark:border-white/10 dark:bg-white/8 dark:text-emerald-100">
                  <input
                    type="file"
                    accept="image/*"
                    disabled={isEditLocked || isUploadingMedia}
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      uploadAnswerMedia(file, photoField, "Фото-ответ");
                      event.target.value = "";
                    }}
                  />
                  <span className="block text-sm uppercase opacity-70">Фото-ответ</span>
                  <span className="mt-1 block">Загрузить фото</span>
                </label>
              </div>

              {(voiceUrl || photoUrl || isUploadingMedia) && (
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {voiceUrl && (
                    <div className="rounded-[1.2rem] border border-emerald-200/70 bg-white/68 p-4 shadow-inner dark:border-white/10 dark:bg-white/8">
                      <p className="mb-3 text-sm font-black text-emerald-700 dark:text-emerald-100">
                        Голосовой ответ
                      </p>
                      <audio controls src={voiceUrl} className="w-full" />
                    </div>
                  )}
                  {photoUrl && (
                    <div className="rounded-[1.2rem] border border-emerald-200/70 bg-white/68 p-3 shadow-inner dark:border-white/10 dark:bg-white/8">
                      <img
                        src={photoUrl}
                        alt="Фото-ответ"
                        className="max-h-64 w-full rounded-[0.9rem] object-cover"
                      />
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
                  onClick={() => router.push("/questions/today")}
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
