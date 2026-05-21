"use client";

import { getDailyQuestion, getDailyQuestionDate } from "@/lib/dailyQuestions";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const EDIT_WINDOW_MS = 15 * 60 * 1000;

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
  date: string;
  couple_id: string;
};

export default function TodayQuestionPage() {
  const router = useRouter();
  const [couple, setCouple] = useState<Couple | null>(null);
  const [answerRecord, setAnswerRecord] = useState<Answer | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [nowMs, setNowMs] = useState(0);

  const todayDate = getDailyQuestionDate();
  const questionOfTheDay = getDailyQuestion();
  const isPartnerOne = currentUserId === couple?.partner_one_id;
  const myAnswer = isPartnerOne ? answerRecord?.answer_one : answerRecord?.answer_two;
  const partnerAnswer = isPartnerOne ? answerRecord?.answer_two : answerRecord?.answer_one;
  const myEditedAt = isPartnerOne
    ? answerRecord?.answer_one_edited_at
    : answerRecord?.answer_two_edited_at;
  const hasMyAnswer = Boolean(myAnswer);
  const hasPartnerAnswer = Boolean(partnerAnswer);
  const canEdit =
    hasMyAnswer &&
    (!myEditedAt || nowMs === 0 || new Date(myEditedAt).getTime() + EDIT_WINDOW_MS > nowMs);

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

      const { data: answerData } = await supabase
        .from("question_answers")
        .select("*")
        .eq("couple_id", coupleData.id)
        .eq("date", todayDate)
        .eq("question", questionOfTheDay)
        .limit(1)
        .single();

      if (!answerData) {
        router.push("/questions");
        return;
      }

      setAnswerRecord(answerData);
      setIsLoading(false);
      setNowMs(Date.now());
    }

    loadData();
  }, [router, questionOfTheDay, todayDate]);

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
    <main className="relative min-h-screen overflow-hidden bg-[#f0fff7] px-6 pb-20 pt-28 text-[#14532d] transition-colors dark:bg-[#02140b] dark:text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(34,197,94,0.24),transparent_34%),radial-gradient(circle_at_82%_20%,rgba(20,184,166,0.18),transparent_30%),linear-gradient(135deg,#e7fff2_0%,#f4fff9_48%,#e9fff7_100%)] dark:bg-[radial-gradient(circle_at_18%_16%,rgba(34,197,94,0.16),transparent_34%),radial-gradient(circle_at_82%_20%,rgba(20,184,166,0.15),transparent_30%),linear-gradient(135deg,#03170c_0%,#062315_48%,#02100a_100%)]" />

      <section className="questions-reveal relative mx-auto max-w-5xl">
        <div className="mb-8 text-center">
          <p className="mx-auto inline-flex rounded-full border border-emerald-200/70 bg-white/45 px-5 py-2 text-sm font-black text-emerald-700 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-white/8 dark:text-emerald-200">
            💌 Вопрос дня
          </p>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-black leading-tight text-[#15803d] dark:text-white md:text-6xl">
            {questionOfTheDay}
          </h1>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-[1.6rem] border border-white/70 bg-white/58 p-5 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-white/8">
            <p className="text-sm font-black uppercase text-emerald-600/70 dark:text-emerald-200/70">
              Ваш статус
            </p>
            <p className="mt-2 text-2xl font-black text-[#15803d] dark:text-white">
              {hasMyAnswer ? "Вы ответили" : "Вы ещё не ответили"}
            </p>
          </div>
          <div className="rounded-[1.6rem] border border-white/70 bg-white/58 p-5 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-white/8">
            <p className="text-sm font-black uppercase text-emerald-600/70 dark:text-emerald-200/70">
              Статус партнёра
            </p>
            <p className="mt-2 text-2xl font-black text-[#15803d] dark:text-white">
              {hasPartnerAnswer ? "Партнёр ответил" : "Партнёр ещё отвечает"}
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <article className="rounded-[2rem] border border-white/70 bg-white/62 p-6 shadow-[0_28px_90px_rgba(21,128,61,0.16)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/8">
            <p className="text-sm font-black uppercase text-emerald-600/70 dark:text-emerald-200/70">
              Мой ответ
            </p>
            <div className="mt-5 min-h-48 rounded-[1.5rem] bg-emerald-50/80 p-5 shadow-inner dark:bg-black/20">
              <p className="break-words text-lg font-semibold leading-8 text-emerald-950 dark:text-white">
                {myAnswer || "Ответ ещё не сохранён."}
              </p>
            </div>
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

          <article className="rounded-[2rem] border border-white/70 bg-white/62 p-6 shadow-[0_28px_90px_rgba(20,184,166,0.16)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/8">
            <p className="text-sm font-black uppercase text-emerald-600/70 dark:text-emerald-200/70">
              Ответ партнёра
            </p>
            <div className="mt-5 min-h-48 rounded-[1.5rem] bg-teal-50/80 p-5 shadow-inner dark:bg-black/20">
              {hasMyAnswer ? (
                <p className="break-words text-lg font-semibold leading-8 text-emerald-950 dark:text-white">
                  {partnerAnswer || "Партнёр ещё отвечает. Ответ откроется автоматически."}
                </p>
              ) : (
                <div className="flex h-full min-h-36 flex-col items-center justify-center text-center">
                  <p className="text-4xl">🔒</p>
                  <p className="mt-3 text-lg font-black text-emerald-800 dark:text-white">
                    Ответ партнёра скрыт
                  </p>
                  <p className="mt-2 max-w-sm text-sm font-semibold leading-6 text-emerald-800/55 dark:text-white/45">
                    Сначала ответьте сами, чтобы открыть ответ партнёра.
                  </p>
                </div>
              )}
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
