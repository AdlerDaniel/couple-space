"use client";

import AnswerSocialControls from "@/components/AnswerSocialControls";
import QuestionComments from "@/components/QuestionComments";
import { getDailyQuestion, getDailyQuestionDate } from "@/lib/dailyQuestions";
import { parseQuestionDate } from "@/lib/questionArchive";
import { supabase } from "@/lib/supabaseClient";
import { toBrowserSupabaseUrl } from "@/lib/supabaseUrls";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const EDIT_WINDOW_MS = 15 * 60 * 1000;

type Couple = {
  id: string;
  partner_one_id: string;
  partner_two_id: string | null;
};

type CoupleProfile = {
  partner_one: string | null;
  partner_two: string | null;
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

export default function TodayQuestionPage() {
  const router = useRouter();
  const [couple, setCouple] = useState<Couple | null>(null);
  const [profile, setProfile] = useState<CoupleProfile | null>(null);
  const [answerRecord, setAnswerRecord] = useState<Answer | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [nowMs, setNowMs] = useState(0);
  const [answerStreak, setAnswerStreak] = useState(0);
  const [dailyQuestionState, setDailyQuestionState] = useState(() => ({
    date: getDailyQuestionDate(),
    question: getDailyQuestion(),
    timeZone: "Europe/Moscow",
  }));

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
  const hasMyAnswer = Boolean(myAnswer);
  const hasPartnerAnswer = Boolean(partnerAnswer);
  const canEdit =
    hasMyAnswer &&
    (!myEditedAt || nowMs === 0 || new Date(myEditedAt).getTime() + EDIT_WINDOW_MS > nowMs);

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
        .select("partner_one, partner_two, time_zone")
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
        setAnswerRecord(null);
        setIsLoading(false);
        setNowMs(Date.now());
        return;
      }

      setAnswerRecord(answerData);
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

    const intervalId = window.setInterval(async () => {
      const { data } = await supabase
        .from("question_answers")
        .select("*")
        .eq("id", answerRecord.id)
        .single();

      if (data) {
        setAnswerRecord(data);
      }
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, [answerRecord, couple, hasMyAnswer, hasPartnerAnswer]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#e2fff2] to-[#f0fff7] px-6 pb-10 pt-28 text-[#27ae60] transition-colors dark:from-[#041f0f] dark:to-[#000e07]">
        <div className="mx-auto max-w-3xl rounded-3xl bg-gradient-to-b from-[#d1eedd] to-[#e0f4e8] p-8 text-center shadow-lg dark:from-[#142825] dark:to-[#131b1f]">
          <p className="font-bold text-[#27ae60]">Загружаем ответы...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f0fff7] px-4 pb-32 pt-24 text-[#14532d] transition-colors dark:bg-[#02140b] dark:text-white sm:px-6 md:pt-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(34,197,94,0.24),transparent_34%),radial-gradient(circle_at_82%_20%,rgba(20,184,166,0.18),transparent_30%),linear-gradient(135deg,#e7fff2_0%,#f4fff9_48%,#e9fff7_100%)] dark:bg-[radial-gradient(circle_at_18%_16%,rgba(34,197,94,0.16),transparent_34%),radial-gradient(circle_at_82%_20%,rgba(20,184,166,0.15),transparent_30%),linear-gradient(135deg,#03170c_0%,#062315_48%,#02100a_100%)]" />

      <section className="questions-reveal relative mx-auto max-w-5xl">
        <div className="mb-8 text-center">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <p className="inline-flex rounded-full border border-emerald-200/70 bg-white/45 px-5 py-2 text-sm font-black text-emerald-700 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-white/8 dark:text-emerald-200">
              💌 Вопрос дня
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
          <div className="mx-auto mt-6 grid max-w-3xl gap-3 md:grid-cols-2">
            <div className="answer-reveal rounded-[1.4rem] border border-emerald-200/70 bg-white/55 p-4 text-left shadow-xl backdrop-blur-xl transition hover:-translate-y-1 hover:bg-emerald-50/80 dark:border-white/10 dark:bg-white/8 dark:hover:bg-emerald-500/12">
              <p className="text-sm font-black uppercase text-emerald-600/70 dark:text-emerald-200/70">
                Серия дней ответов
              </p>
              <p className="mt-2 text-3xl font-black text-[#15803d] dark:text-white">
                {answerStreak} дней
              </p>
            </div>
            <div className="answer-reveal rounded-[1.4rem] border border-emerald-200/70 bg-white/55 p-4 text-left shadow-xl backdrop-blur-xl transition hover:-translate-y-1 hover:bg-emerald-50/80 dark:border-white/10 dark:bg-white/8 dark:hover:bg-emerald-500/12">
              <p className="text-sm font-black uppercase text-emerald-600/70 dark:text-emerald-200/70">
                Напоминание
              </p>
              <p className="mt-2 text-lg font-black text-[#15803d] dark:text-white">
                {hasMyAnswer ? "Сегодня ответ сохранён" : "Ответьте сегодня, чтобы не потерять серию"}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <div className={`answer-reveal rounded-[1.6rem] border border-white/70 bg-white/58 p-5 shadow-xl backdrop-blur-xl transition hover:-translate-y-1 hover:bg-emerald-50/80 dark:border-white/10 dark:bg-white/8 dark:hover:bg-emerald-500/12 ${hasMyAnswer ? "answered-glow" : ""}`}>
            <p className="text-sm font-black uppercase text-emerald-600/70 dark:text-emerald-200/70">
              Ваш статус
            </p>
            <p className="mt-2 text-2xl font-black text-[#15803d] dark:text-white">
              {hasMyAnswer ? "Вы ответили" : "Вы ещё не ответили"}
            </p>
          </div>
          <div className={`answer-reveal rounded-[1.6rem] border border-white/70 bg-white/58 p-5 shadow-xl backdrop-blur-xl transition hover:-translate-y-1 hover:bg-emerald-50/80 dark:border-white/10 dark:bg-white/8 dark:hover:bg-emerald-500/12 ${hasPartnerAnswer ? "answered-glow" : ""}`}>
            <p className="text-sm font-black uppercase text-emerald-600/70 dark:text-emerald-200/70">
              Статус партнёра
            </p>
            <p className="mt-2 text-2xl font-black text-[#15803d] dark:text-white">
              {hasPartnerAnswer ? "Партнёр ответил" : "Партнёр ещё отвечает"}
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <article className={`answer-reveal rounded-[2rem] border border-emerald-200/70 bg-gradient-to-br from-white/78 via-emerald-50/86 to-lime-50/75 p-6 shadow-[0_28px_90px_rgba(21,128,61,0.18)] backdrop-blur-2xl transition hover:-translate-y-1 hover:shadow-[0_34px_110px_rgba(21,128,61,0.24)] dark:border-emerald-300/10 dark:from-emerald-500/12 dark:via-white/8 dark:to-lime-500/8 ${hasMyAnswer ? "answered-glow" : ""}`}>
            <p className="text-sm font-black uppercase text-emerald-700/72 dark:text-emerald-200/70">
              Мой ответ
            </p>
            <div className="mt-5 min-h-48 rounded-[1.5rem] border border-emerald-200/60 bg-white/70 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_18px_55px_rgba(21,128,61,0.1)] dark:border-white/10 dark:bg-black/20">
              <p className="break-words text-lg font-semibold leading-8 text-emerald-950 dark:text-white">
                {myAnswer || "Ответ ещё не сохранён."}
              </p>
              {(myVoiceUrl || myPhotoUrl) && (
                <div className="mt-5 grid gap-3">
                  {myVoiceUrl && (
                    <audio controls src={myVoiceUrl} className="w-full" />
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
            {hasMyAnswer && answerRecord && (
              <AnswerSocialControls
                record={answerRecord}
                recordId={answerRecord.id}
                currentUserId={currentUserId}
                reactionColumn={isPartnerOne ? "answer_one_reactions" : "answer_two_reactions"}
                likeColumn={isPartnerOne ? "answer_one_likes" : "answer_two_likes"}
                answerKey={isPartnerOne ? "answer_one" : "answer_two"}
                onUpdate={setAnswerRecord}
              />
            )}
            <button
              onClick={() => router.push("/questions/answer")}
              disabled={hasMyAnswer && !canEdit}
              className="mt-5 w-full rounded-full bg-gradient-to-r from-[#15803d] to-[#14b8a6] px-7 py-3 font-black text-white shadow-[0_18px_55px_rgba(21,128,61,0.26)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {hasMyAnswer ? "Редактировать ответ" : "Ответить"}
            </button>
            {hasMyAnswer && !canEdit && (
              <p className="mt-3 text-center text-sm font-bold text-emerald-800/55 dark:text-white/45">
                Время редактирования истекло.
              </p>
            )}
          </article>

          <article className={`answer-reveal rounded-[2rem] border border-cyan-200/70 bg-gradient-to-br from-white/78 via-cyan-50/88 to-teal-50/78 p-6 shadow-[0_28px_90px_rgba(20,184,166,0.18)] backdrop-blur-2xl transition hover:-translate-y-1 hover:shadow-[0_34px_110px_rgba(20,184,166,0.24)] dark:border-cyan-300/10 dark:from-cyan-500/12 dark:via-white/8 dark:to-teal-500/8 ${hasPartnerAnswer ? "answered-glow" : ""}`}>
            <p className="text-sm font-black uppercase text-cyan-700/72 dark:text-cyan-200/70">
              Ответ партнёра
            </p>
            <div className="relative mt-5 min-h-48 overflow-hidden rounded-[1.5rem] border border-cyan-200/60 bg-white/70 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_18px_55px_rgba(20,184,166,0.1)] dark:border-white/10 dark:bg-black/20">
              {hasMyAnswer ? (
                <>
                  <p className="break-words text-lg font-semibold leading-8 text-emerald-950 dark:text-white">
                    {partnerAnswer || "Партнёр ещё отвечает. Ответ откроется автоматически."}
                  </p>
                  {(partnerVoiceUrl || partnerPhotoUrl) && (
                    <div className="mt-5 grid gap-3">
                      {partnerVoiceUrl && (
                        <audio controls src={partnerVoiceUrl} className="w-full" />
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
                      likeColumn={isPartnerOne ? "answer_two_likes" : "answer_one_likes"}
                      answerKey={isPartnerOne ? "answer_two" : "answer_one"}
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
                    <p className="text-4xl">🔒</p>
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
            question={questionOfTheDay}
            couple={couple}
            currentUserId={currentUserId}
            profile={profile}
          />
        )}
      </section>
    </main>
  );
}
