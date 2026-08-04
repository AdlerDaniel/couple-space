"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { quizCategories, quizzes, type QuizCategory } from "@/lib/quizzes";
import { supabase } from "@/lib/supabaseClient";
import { clearLegacyQuizCache } from "@/lib/quizDrafts";
import { fetchQuizProgress } from "@/lib/quizProgressRepository";

type Couple = {
  id: string;
  partner_one_id: string;
  partner_two_id: string | null;
};

type QuizProgress = {
  mine: Set<string>;
  partner: Set<string>;
};

export default function QuizzesPage() {
  const [activeCategory, setActiveCategory] = useState<QuizCategory>(quizCategories[0]);
  const [progress, setProgress] = useState<QuizProgress>({
    mine: new Set(),
    partner: new Set(),
  });

  const categoryQuizzes = useMemo(
    () => quizzes.filter((quiz) => quiz.category === activeCategory),
    [activeCategory]
  );

  const completedInCategory = categoryQuizzes.filter((quiz) =>
    progress.mine.has(quiz.id)
  ).length;
  const partnerCompletedInCategory = categoryQuizzes.filter((quiz) =>
    progress.partner.has(quiz.id)
  ).length;

  useEffect(() => {
    async function loadProgress() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: coupleData } = await supabase
        .from("couples")
        .select("*")
        .or(`partner_one_id.eq.${user.id},partner_two_id.eq.${user.id}`)
        .limit(1)
        .single<Couple>();

      if (!coupleData) return;

      const partnerId =
        user.id === coupleData.partner_one_id
          ? coupleData.partner_two_id
          : coupleData.partner_one_id;

      const myCompleted = new Set<string>();
      const partnerCompleted = new Set<string>();

      quizzes.forEach((quiz) => clearLegacyQuizCache(coupleData.id, quiz.id));

      const answers = await fetchQuizProgress(coupleData.id).catch(() => []);
      answers.forEach((answer) => {
        if (answer.user_id === user.id) myCompleted.add(answer.quiz_id);
        if (partnerId && answer.user_id === partnerId) partnerCompleted.add(answer.quiz_id);
      });

      setProgress({
        mine: myCompleted,
        partner: partnerCompleted,
      });
    }

    loadProgress();
  }, []);

  return (
    <main
      className="quizzes-page min-h-screen bg-gradient-to-b from-[#f1e7ff] to-[#fbf7ff] px-3 pb-28 pt-20 text-[#7c3aed] transition-colors dark:from-[#170525] dark:to-[#09020f] dark:text-[#c084fc] sm:px-5 md:px-6 md:pt-28"
      style={{ ["--scroll-accent" as string]: "#7c3aed" }}
    >
      <section className="mx-auto max-w-6xl">
        <div className="mb-5 text-center md:mb-10">
          <p className="ui-chip mx-auto mb-2 md:mb-4">
            6 категорий · 60 карточек · 600 вопросов
          </p>

          <h1 className="text-3xl font-bold tracking-tight text-[#6d28d9] dark:text-[#c084fc] sm:text-4xl md:text-6xl">
            Викторины
          </h1>

          <p className="mx-auto mt-2 max-w-3xl text-sm leading-relaxed text-[#6d28d9]/75 dark:text-[#d8b4fe]/75 md:mt-5 md:text-lg">
            Каждая категория разделена на 10 карточек. В каждой карточке по 10 вопросов, чтобы проходить тесты короткими блоками и потом сравнивать ответы.
          </p>
        </div>

        <div className="quiz-category-grid grid grid-cols-2 gap-2 rounded-[1.25rem] bg-white/45 p-2 shadow-inner dark:bg-white/5 lg:grid-cols-3">
          {quizCategories.map((category) => {
            const items = quizzes.filter((quiz) => quiz.category === category);
            const completed = items.filter((quiz) => progress.mine.has(quiz.id)).length;
            const isActive = category === activeCategory;

            return (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`ui-lift min-w-0 rounded-[1rem] border p-2.5 text-left sm:p-4 ${
                  isActive
                    ? "border-[#7c3aed]/35 bg-[#7c3aed] text-white shadow-[0_16px_42px_rgba(124,58,237,0.24)]"
                    : "border-white/55 bg-white/72 text-[#6d28d9] shadow-inner hover:bg-violet-50 dark:border-white/10 dark:bg-white/8 dark:text-[#d8b4fe] dark:hover:bg-violet-500/15"
                }`}
              >
                <span className="block truncate text-sm font-black sm:text-xl">{category}</span>
                <span className={isActive ? "mt-1 block text-[11px] font-bold text-white/75 sm:mt-2 sm:text-sm" : "mt-1 block text-[11px] font-bold text-[#6d28d9]/60 dark:text-[#d8b4fe]/60 sm:mt-2 sm:text-sm"}>
                  {items.length} карточек · {items.length * 10} вопросов
                </span>
                <span className={isActive ? "mt-1 block text-[10px] font-bold text-white/65 sm:text-sm" : "mt-1 block text-[10px] font-bold text-[#6d28d9]/50 dark:text-[#d8b4fe]/50 sm:text-sm"}>
                  Пройдено вами: {completed}
                </span>
              </button>
            );
          })}
        </div>

        <section className="ui-card mt-4 p-3 sm:p-5 md:mt-8 md:p-6">
          <div className="mb-3 flex flex-col gap-3 md:mb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="ui-eyebrow">
                Выбранная категория
              </p>
              <h2 className="ui-section-title mt-1 text-2xl md:mt-2 md:text-4xl">
                {activeCategory}
              </h2>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[420px]">
              {[
                ["Карточек", categoryQuizzes.length],
                ["Вы", completedInCategory],
                ["Партнёр", partnerCompletedInCategory],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="ui-card-compact p-3"
                >
                  <span className="block text-2xl font-black text-[#6d28d9] dark:text-[#c084fc]">
                    {value}
                  </span>
                  <span className="text-xs font-bold uppercase text-[#6d28d9]/60 dark:text-[#d8b4fe]/60">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="quiz-card-grid grid grid-cols-2 gap-2 md:gap-4 lg:grid-cols-3">
            {categoryQuizzes.map((quiz, index) => {
              const isMineCompleted = progress.mine.has(quiz.id);
              const isPartnerCompleted = progress.partner.has(quiz.id);
              const firstQuestion = quiz.questions[0]?.text;

              return (
                <article
                  key={quiz.id}
                  className={`quiz-card ui-card-compact ui-lift flex min-h-0 min-w-0 flex-col p-2.5 sm:p-4 md:min-h-72 md:p-6 ${
                    isMineCompleted
                      ? "bg-slate-200/85 text-slate-700 hover:bg-slate-200 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:bg-slate-700/80"
                      : "bg-white/72 text-[#6d28d9] hover:bg-violet-50/70 dark:bg-white/8 dark:text-[#d8b4fe] dark:hover:bg-violet-500/15"
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between gap-1.5 md:mb-5 md:gap-3">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-wide opacity-70 sm:text-xs md:text-sm">
                        Карточка {index + 1}
                      </p>
                      <h3 className="mt-1 line-clamp-2 text-sm font-black leading-tight sm:text-base md:mt-2 md:text-2xl">{quiz.title}</h3>
                    </div>
                    <span className="ui-chip shrink-0 bg-[#7c3aed] text-white">
                      10
                    </span>
                  </div>

                  <p className="line-clamp-2 flex-1 text-[10px] font-semibold leading-4 opacity-75 sm:text-xs md:line-clamp-3 md:text-sm md:leading-6">
                    {firstQuestion}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-1 md:mt-5 md:gap-2">
                      <span className="ui-chip">
                      {quiz.duration}
                    </span>
                    {isMineCompleted && (
                      <span className="ui-chip bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-950">
                        Вы прошли
                      </span>
                    )}
                    {isPartnerCompleted && (
                      <span className="ui-chip">
                        Партнёр прошёл
                      </span>
                    )}
                  </div>

                  <Link
                    href={
                      isMineCompleted
                        ? `/quizzes/result?quiz=${quiz.id}`
                        : `/quizzes/play?quiz=${quiz.id}`
                    }
                    className={`ui-button mt-2 px-2 py-2 text-center text-[10px] sm:text-xs md:mt-6 md:text-sm ${
                      isMineCompleted
                        ? "bg-slate-700 text-white hover:bg-slate-800 dark:bg-slate-200 dark:text-slate-950 dark:hover:bg-white"
                        : "bg-[#7c3aed] text-white hover:bg-[#8b5cf6]"
                    }`}
                  >
                    {isMineCompleted ? "Открыть результат" : "Начать карточку"}
                  </Link>
                </article>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}
