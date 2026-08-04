"use client";

import { getDailyQuestion, getDailyQuestionDate } from "@/lib/dailyQuestions";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Mail } from "lucide-react";

type Couple = {
  id: string;
  partner_one_id: string;
  partner_two_id: string | null;
};

type Answer = {
  answer_one: string | null;
  answer_two: string | null;
};

export default function QuestionsPage() {
  const router = useRouter();
  const [couple, setCouple] = useState<Couple | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [answerRecord, setAnswerRecord] = useState<Answer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dailyQuestionState, setDailyQuestionState] = useState(() => ({
    question: getDailyQuestion(),
    date: getDailyQuestionDate(),
  }));

  const questionOfTheDay = dailyQuestionState.question;
  const isPartnerOne = currentUserId === couple?.partner_one_id;
  const myAnswer = isPartnerOne
    ? answerRecord?.answer_one
    : answerRecord?.answer_two;
  const hasAnswered = Boolean(myAnswer);

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
        .select("answer_one, answer_two")
        .eq("couple_id", coupleData.id)
        .eq("date", activeDate)
        .eq("question", activeQuestion)
        .limit(1)
        .maybeSingle<Answer>();

      if (answerData) {
        const savedAnswer =
          user.id === coupleData.partner_one_id
            ? answerData.answer_one
            : answerData.answer_two;

        if (savedAnswer) {
          router.replace("/questions/today");
          return;
        }

        setAnswerRecord(answerData);
      }

      setIsLoading(false);
    }

    loadPageData();
  }, [router]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f0fff7] px-4 pb-32 pt-24 text-[#14532d] transition-colors dark:bg-[#02140b] dark:text-white sm:px-6 md:pt-28">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(34,197,94,0.26),transparent_34%),radial-gradient(circle_at_82%_18%,rgba(20,184,166,0.2),transparent_30%),radial-gradient(circle_at_50%_85%,rgba(132,204,22,0.16),transparent_34%),linear-gradient(135deg,#e7fff2_0%,#f4fff9_46%,#e9fff7_100%)] dark:bg-[radial-gradient(circle_at_20%_12%,rgba(34,197,94,0.18),transparent_34%),radial-gradient(circle_at_82%_18%,rgba(20,184,166,0.18),transparent_30%),linear-gradient(135deg,#03170c_0%,#062315_48%,#02100a_100%)]" />
        <div className="questions-blob absolute -left-24 top-36 h-80 w-80 rounded-full bg-emerald-300/40 blur-3xl dark:bg-emerald-500/14" />
        <div className="questions-blob questions-blob-delay absolute -right-20 top-64 h-96 w-96 rounded-full bg-teal-300/35 blur-3xl dark:bg-teal-500/14" />
      </div>

      <section className="relative mx-auto flex min-h-[calc(100vh-7rem)] max-w-5xl flex-col items-center justify-center text-center">
        <div className="questions-reveal mb-8 flex flex-wrap items-center justify-center gap-3">
          <div className="inline-flex h-10 items-center gap-3 rounded-full border border-emerald-200/70 bg-white/45 px-5 text-sm font-bold leading-none text-emerald-700 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-white/8 dark:text-emerald-200">
            <Mail aria-hidden="true" size={16} />
            Вопрос дня
          </div>
          <button
            onClick={() => router.push("/questions/archive")}
            className="inline-flex h-10 items-center rounded-full border border-emerald-200/70 bg-white/45 px-5 text-sm font-bold leading-none text-emerald-700 shadow-lg backdrop-blur-xl transition hover:bg-emerald-50 dark:border-white/10 dark:bg-white/8 dark:text-emerald-200 dark:hover:bg-emerald-500/15"
          >
            Архив
          </button>
        </div>

        <div className="questions-reveal questions-reveal-delay relative w-full max-w-4xl overflow-hidden rounded-[2.5rem] border border-white/70 bg-white/52 p-6 shadow-[0_32px_110px_rgba(21,128,61,0.22)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/8">
          <div className="absolute left-8 top-8 h-20 w-20 rounded-full bg-emerald-300/35 blur-2xl" />
          <div className="absolute bottom-8 right-8 h-24 w-24 rounded-full bg-teal-300/30 blur-2xl" />

          <div className="relative rounded-[2rem] bg-gradient-to-br from-[#d9ffe9] via-[#effff6] to-[#d8fff4] px-7 py-12 shadow-inner dark:from-[#082a18] dark:via-[#0b2418] dark:to-[#063025] md:px-14 md:py-16">
            <p className="text-sm font-black uppercase tracking-wide text-emerald-600/75 dark:text-emerald-200/70">
              Сегодня
            </p>
            <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-black leading-tight text-[#15803d] dark:text-white md:text-6xl">
              {isLoading ? "Загружаем вопрос..." : questionOfTheDay}
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg font-semibold leading-8 text-emerald-800/62 dark:text-white/58">
              Ответьте отдельно, а после сохранения вы увидите ответы друг друга
              на отдельной странице.
            </p>

            <button
              onClick={() =>
                router.push(hasAnswered ? "/questions/today" : "/questions/answer")
              }
              disabled={isLoading}
              className="mt-10 rounded-full bg-gradient-to-r from-[#15803d] to-[#14b8a6] px-10 py-4 text-lg font-black text-white shadow-[0_18px_55px_rgba(21,128,61,0.32)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_70px_rgba(21,128,61,0.42)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {hasAnswered ? "Смотреть ответы" : "Ответить"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
