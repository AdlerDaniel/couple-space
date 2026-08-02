"use client";

import AnswerSocialControls from "@/components/AnswerSocialControls";
import AccentAudioPlayer from "@/components/AccentAudioPlayer";
import QuestionComments from "@/components/QuestionComments";
import { getDailyQuestion, getDailyQuestionDate } from "@/lib/dailyQuestions";
import { parseQuestionDate } from "@/lib/questionArchive";
import { supabase } from "@/lib/supabaseClient";
import { toBrowserSupabaseUrl } from "@/lib/supabaseUrls";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Flame, LockKeyhole, Mail } from "lucide-react";

const EDIT_WINDOW_MS = 15 * 60 * 1000;

type Couple = {
  id: string;
  partner_one_id: string;
  partner_two_id: string | null;
};

type CoupleProfile = {
  partner_one: string | null;
  partner_two: string | null;
  avatar_one?: string | null;
  avatar_two?: string | null;
  time_zone?: string | null;
};

type Answer = {
  id: string;
  question: string;
  answer_one: string | null;
  answer_two: string | null;
  answer_one_edited_at?: string | null;
  answer_two_edited_at?: string | null;
  answer_one_reactions?: Record<string, string>;
  answer_two_reactions?: Record<string, string>;
  answer_one_likes?: Record<string, boolean>;
  answer_two_likes?: Record<string, boolean>;
  favorite_answers?: Record<string, string>;
  answer_one_voice_url?: string | null;
  answer_two_voice_url?: string | null;
  answer_one_photo_url?: string | null;
  answer_two_photo_url?: string | null;
  date: string;
  couple_id: string;
};

type CachedQuestionState = {
  answerRecord: Answer;
  couple: Couple;
  currentUserId: string;
  dailyQuestionState: { date: string; question: string; timeZone: string };
  savedAt: number;
};

function readCachedQuestionState() {
  if (typeof window === "undefined") return null;
  try {
    const value = sessionStorage.getItem("couple-space:today-question-cache");
    if (!value) return null;
    const parsed = JSON.parse(value) as CachedQuestionState;
    if (!parsed.answerRecord || Date.now() - parsed.savedAt > 30 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

function QuestionAvatar({ name, src, tone }: { name: string; src?: string | null; tone: "mine" | "partner" }) {
  const initials = name.trim().slice(0, 1).toUpperCase() || "♡";
  return src ? (
    <Image
      src={toBrowserSupabaseUrl(src) || src}
      alt={name}
      width={44}
      height={44}
      sizes="44px"
      className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-white/70 shadow-lg dark:ring-white/15"
    />
  ) : (
    <span className={`question-answer-avatar question-answer-avatar-${tone}`} aria-label={name}>
      {initials}
    </span>
  );
}

export default function TodayQuestionPage() {
  const router = useRouter();
  const [cachedState] = useState(readCachedQuestionState);
  const [couple, setCouple] = useState<Couple | null>(cachedState?.couple || null);
  const [profile, setProfile] = useState<CoupleProfile | null>(null);
  const [answerRecord, setAnswerRecord] = useState<Answer | null>(cachedState?.answerRecord || null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(cachedState?.currentUserId || null);
  const [isLoading, setIsLoading] = useState(!cachedState);
  const [nowMs, setNowMs] = useState(0);
  const [answerStreak, setAnswerStreak] = useState(0);
  const [dailyQuestionState, setDailyQuestionState] = useState(() =>
    cachedState?.dailyQuestionState || {
      date: getDailyQuestionDate(),
      question: getDailyQuestion(),
      timeZone: "Europe/Moscow",
    },
  );

  const questionOfTheDay = dailyQuestionState.question;
  const isPartnerOne = currentUserId === couple?.partner_one_id;
  const myAnswer = isPartnerOne ? answerRecord?.answer_one : answerRecord?.answer_two;
  const partnerAnswer = isPartnerOne ? answerRecord?.answer_two : answerRecord?.answer_one;
  const myVoiceUrl = toBrowserSupabaseUrl(isPartnerOne
    ? answerRecord?.answer_one_voice_url
    : answerRecord?.answer_two_voice_url);
  const partnerVoiceUrl = toBrowserSupabaseUrl(isPartnerOne
    ? answerRecord?.answer_two_voice_url
    : answerRecord?.answer_one_voice_url);
  const myPhotoUrl = toBrowserSupabaseUrl(isPartnerOne
    ? answerRecord?.answer_one_photo_url
    : answerRecord?.answer_two_photo_url);
  const partnerPhotoUrl = toBrowserSupabaseUrl(isPartnerOne
    ? answerRecord?.answer_two_photo_url
    : answerRecord?.answer_one_photo_url);
  const myEditedAt = isPartnerOne
    ? answerRecord?.answer_one_edited_at
    : answerRecord?.answer_two_edited_at;
  const hasMyAnswer = Boolean(myAnswer || myVoiceUrl || myPhotoUrl);
  const hasPartnerAnswer = Boolean(partnerAnswer || partnerVoiceUrl || partnerPhotoUrl);
  const canEdit =
    hasMyAnswer &&
    Boolean(myEditedAt) &&
    (nowMs === 0 || new Date(myEditedAt as string).getTime() + EDIT_WINDOW_MS > nowMs);
  const myName = (isPartnerOne ? profile?.partner_one : profile?.partner_two) || "Вы";
  const partnerName = (isPartnerOne ? profile?.partner_two : profile?.partner_one) || "Партнёр";
  const myAvatar = isPartnerOne ? profile?.avatar_one : profile?.avatar_two;
  const partnerAvatar = isPartnerOne ? profile?.avatar_two : profile?.avatar_one;

  function calculateAnswerStreak(rows: Pick<Answer, "date" | "answer_one" | "answer_two">[], userIsPartnerOne: boolean) {
    const answeredTimes = rows
      .filter((row) => (userIsPartnerOne ? row.answer_one : row.answer_two))
      .map((row) => parseQuestionDate(row.date).getTime());
    const uniqueDays = [...new Set(answeredTimes)]
      .map((time) => {
        const date = new Date(time);
        date.setHours(0, 0, 0, 0);
        return date.getTime();
      })
      .sort((first, second) => second - first);

    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    let streak = 0;

    for (const dayTime of uniqueDays) {
      if (dayTime === cursor.getTime()) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else if (streak === 0) {
        cursor.setDate(cursor.getDate() - 1);
        if (dayTime === cursor.getTime()) {
          streak += 1;
          cursor.setDate(cursor.getDate() - 1);
        }
      } else {
        break;
      }
    }

    return streak;
  }

  useEffect(() => {
    async function loadData() {
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
        .select("partner_one, partner_two, avatar_one, avatar_two, time_zone")
        .eq("couple_id", coupleData.id)
        .limit(1)
        .maybeSingle<CoupleProfile>();

      setProfile(profileData || null);
      const timeZone = profileData?.time_zone || "Europe/Moscow";
      const activeDate = getDailyQuestionDate(new Date(), timeZone);
      const activeQuestion = getDailyQuestion(new Date(), timeZone);
      setDailyQuestionState({ date: activeDate, question: activeQuestion, timeZone });

      const { data: streakRows } = await supabase
        .from("question_answers")
        .select("date, answer_one, answer_two")
        .eq("couple_id", coupleData.id);

      setAnswerStreak(
        calculateAnswerStreak(streakRows || [], user.id === coupleData.partner_one_id)
      );

      const { data: answerData } = await supabase
        .from("question_answers")
        .select("*")
        .eq("couple_id", coupleData.id)
        .eq("date", activeDate)
        .eq("question", activeQuestion)
        .limit(1)
        .single();

      if (!answerData) {
        sessionStorage.removeItem("couple-space:today-question-cache");
        setAnswerRecord(null);
        setIsLoading(false);
        setNowMs(Date.now());
        return;
      }

      setAnswerRecord(answerData);
      sessionStorage.setItem(
        "couple-space:today-question-cache",
        JSON.stringify({
          answerRecord: answerData,
          couple: coupleData,
          currentUserId: user.id,
          dailyQuestionState: { date: activeDate, question: activeQuestion, timeZone },
          savedAt: Date.now(),
        }),
      );
      setIsLoading(false);
      setNowMs(Date.now());
    }

    loadData();
  }, [router]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!couple || !answerRecord || !hasMyAnswer || hasPartnerAnswer) return;

    const channel = supabase
      .channel(`question-answer-${answerRecord.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "question_answers",
          filter: `id=eq.${answerRecord.id}`,
        },
        (payload) => setAnswerRecord(payload.new as Answer),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [answerRecord, couple, hasMyAnswer, hasPartnerAnswer]);

  if (isLoading) {
    return (
      <main className="question-skeleton-page min-h-screen bg-gradient-to-b from-[#e2fff2] to-[#f0fff7] px-4 pb-28 pt-24 dark:from-[#041f0f] dark:to-[#000e07]">
        <div className="mx-auto max-w-5xl animate-pulse">
          <div className="mx-auto h-8 w-32 rounded-full bg-emerald-200/60 dark:bg-white/10" />
          <div className="mx-auto mt-5 h-10 w-4/5 rounded-2xl bg-emerald-200/55 dark:bg-white/10" />
          <div className="mx-auto mt-3 h-10 w-3/5 rounded-2xl bg-emerald-200/45 dark:bg-white/8" />
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {[0, 1].map((item) => (
              <div key={item} className="rounded-[1.5rem] border border-white/60 bg-white/50 p-4 shadow-xl dark:border-white/10 dark:bg-white/7">
                <div className="h-4 w-28 rounded-full bg-emerald-200/60 dark:bg-white/10" />
                <div className="mt-4 h-36 rounded-[1.1rem] bg-white/65 dark:bg-white/8" />
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="questions-today-page mobile-redesign-page relative min-h-screen overflow-hidden bg-[#f0fff7] px-4 pb-32 pt-24 text-[#14532d] transition-colors dark:bg-[#02140b] dark:text-white sm:px-6 md:pt-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(34,197,94,0.24),transparent_34%),radial-gradient(circle_at_82%_20%,rgba(20,184,166,0.18),transparent_30%),linear-gradient(135deg,#e7fff2_0%,#f4fff9_48%,#e9fff7_100%)] dark:bg-[radial-gradient(circle_at_18%_16%,rgba(34,197,94,0.16),transparent_34%),radial-gradient(circle_at_82%_20%,rgba(20,184,166,0.15),transparent_30%),linear-gradient(135deg,#03170c_0%,#062315_48%,#02100a_100%)]" />

      <section className="questions-reveal relative mx-auto max-w-5xl">
        <div className="question-hero mb-8 text-center">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <p className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/70 bg-white/45 px-5 py-2 text-sm font-black text-emerald-700 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-white/8 dark:text-emerald-200">
              <Mail aria-hidden="true" size={14} /> Вопрос дня
            </p>
            <button
              onClick={() => router.push("/questions/archive")}
              className="rounded-full border border-emerald-200/70 bg-white/45 px-5 py-2 text-sm font-black text-emerald-700 shadow-lg backdrop-blur-xl transition hover:bg-emerald-50 dark:border-white/10 dark:bg-white/8 dark:text-emerald-200 dark:hover:bg-emerald-500/15"
            >
              Архив
            </button>
          </div>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-black leading-tight text-[#15803d] dark:text-white md:text-6xl">
            {questionOfTheDay}
          </h1>
          <div className="question-summary-strip mx-auto mt-5 flex max-w-3xl flex-wrap items-center justify-center gap-2">
            <span className="question-streak-pill">
              <Flame aria-hidden="true" className={hasMyAnswer ? "question-streak-active" : "question-streak-muted"} size={17} />
              Серия: <strong>{answerStreak} дней</strong>
            </span>
          </div>
        </div>

        <div className="question-conversation-layout">
        <div className="question-answer-grid grid gap-6 md:grid-cols-2">
          <article className={`question-my-answer answer-reveal rounded-[2rem] border border-emerald-200/70 bg-gradient-to-br from-white/78 via-emerald-50/86 to-lime-50/75 p-6 shadow-[0_28px_90px_rgba(21,128,61,0.18)] backdrop-blur-2xl transition hover:-translate-y-1 hover:shadow-[0_34px_110px_rgba(21,128,61,0.24)] dark:border-emerald-300/10 dark:from-emerald-500/12 dark:via-white/8 dark:to-lime-500/8 ${hasMyAnswer ? "answered-glow" : ""}`}>
            <div className="question-answer-identity">
              <QuestionAvatar name={myName} src={myAvatar} tone="mine" />
              <div><p>Мой ответ</p><strong>{myName}</strong></div>
            </div>
            <div className="mt-5 min-h-48 rounded-[1.5rem] border border-emerald-200/60 bg-white/70 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_18px_55px_rgba(21,128,61,0.1)] dark:border-white/10 dark:bg-black/20">
              <p className="break-words text-lg font-semibold leading-8 text-emerald-950 dark:text-white">
                {myAnswer || "Ответ ещё не сохранён."}
              </p>
              {(myVoiceUrl || myPhotoUrl) && (
                <div className="mt-5 grid gap-3">
                  {myVoiceUrl && (
                    <AccentAudioPlayer src={myVoiceUrl} accent="#16a34a" label="Ваш голосовой ответ" />
                  )}
                  {myPhotoUrl && (
                    <Image
                      src={myPhotoUrl}
                      alt="Ваш фото-ответ"
                      width={720}
                      height={420}
                      sizes="(min-width: 768px) 50vw, 100vw"
                      className="max-h-72 w-full rounded-[1rem] object-cover shadow-lg"
                    />
                  )}
                </div>
              )}
            </div>
            {!hasMyAnswer || canEdit ? (
              <button
                onClick={() => router.push("/questions/answer")}
                className="mt-5 w-full rounded-full bg-gradient-to-r from-[#15803d] to-[#14b8a6] px-7 py-3 font-black text-white shadow-[0_18px_55px_rgba(21,128,61,0.26)] transition hover:-translate-y-0.5"
              >
                {hasMyAnswer ? "Редактировать ответ" : "Ответить"}
              </button>
            ) : (
              <p className="question-edit-expired mt-4 text-center text-sm font-bold text-emerald-800/55 dark:text-white/45">
                Время редактирования истекло.
              </p>
            )}
          </article>

          <article className={`question-partner-answer answer-reveal rounded-[2rem] border border-cyan-200/70 bg-gradient-to-br from-white/78 via-cyan-50/88 to-teal-50/78 p-6 shadow-[0_28px_90px_rgba(20,184,166,0.18)] backdrop-blur-2xl transition hover:-translate-y-1 hover:shadow-[0_34px_110px_rgba(20,184,166,0.24)] dark:border-cyan-300/10 dark:from-cyan-500/12 dark:via-white/8 dark:to-teal-500/8 ${hasPartnerAnswer ? "answered-glow" : ""}`}>
            <div className="question-answer-identity question-answer-identity-partner">
              <QuestionAvatar name={partnerName} src={partnerAvatar} tone="partner" />
              <div><p>Ответ партнёра</p><strong>{partnerName}</strong></div>
            </div>
            <div className="question-partner-answer-body relative mt-5 min-h-48 overflow-visible rounded-[1.5rem] border border-cyan-200/60 bg-white/70 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_18px_55px_rgba(20,184,166,0.1)] dark:border-white/10 dark:bg-black/20">
              {hasMyAnswer ? (
                <>
                  <p className="break-words text-lg font-semibold leading-8 text-emerald-950 dark:text-white">
                    {partnerAnswer || "Партнёр ещё отвечает. Ответ откроется автоматически."}
                  </p>
                  {(partnerVoiceUrl || partnerPhotoUrl) && (
                    <div className="mt-5 grid gap-3">
                      {partnerVoiceUrl && (
                        <AccentAudioPlayer src={partnerVoiceUrl} accent="#14b8a6" label="Голосовой ответ партнёра" />
                      )}
                      {partnerPhotoUrl && (
                        <Image
                          src={partnerPhotoUrl}
                          alt="Фото-ответ партнёра"
                          width={720}
                          height={420}
                          sizes="(min-width: 768px) 50vw, 100vw"
                          className="max-h-72 w-full rounded-[1rem] object-cover shadow-lg"
                        />
                      )}
                    </div>
                  )}
                  {partnerAnswer && answerRecord && (
                    <AnswerSocialControls
                      record={answerRecord}
                      recordId={answerRecord.id}
                      currentUserId={currentUserId}
                      reactionColumn={
                        isPartnerOne ? "answer_two_reactions" : "answer_one_reactions"
                      }
                      onUpdate={setAnswerRecord}
                    />
                  )}
                </>
              ) : (
                <>
                  <div className="select-none space-y-3 blur-sm">
                    <div className="h-5 w-11/12 rounded-full bg-cyan-200/80 dark:bg-white/12" />
                    <div className="h-5 w-9/12 rounded-full bg-cyan-200/65 dark:bg-white/10" />
                    <div className="h-5 w-10/12 rounded-full bg-teal-200/65 dark:bg-white/10" />
                    <div className="h-5 w-7/12 rounded-full bg-teal-200/55 dark:bg-white/8" />
                  </div>
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/58 text-center backdrop-blur-md dark:bg-black/34">
                    <LockKeyhole aria-hidden="true" size={36} />
                    <p className="mt-3 text-lg font-black text-cyan-800 dark:text-white">
                      Ответ партнёра скрыт
                    </p>
                    <p className="mt-2 max-w-sm text-sm font-semibold leading-6 text-cyan-900/58 dark:text-white/48">
                      Сначала ответьте сами, чтобы открыть ответ партнёра.
                    </p>
                  </div>
                </>
              )}
            </div>
          </article>
        </div>

        {answerRecord && (
          <QuestionComments
            answerId={answerRecord.id}
            couple={couple}
            currentUserId={currentUserId}
            profile={profile}
          />
        )}
        </div>
      </section>
    </main>
  );
}
