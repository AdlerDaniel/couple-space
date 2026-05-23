"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { quizCategories, quizzes, type QuizCategory } from "@/lib/quizzes";
import { supabase } from "@/lib/supabaseClient";

const QUIZZES_PER_PAGE = 9;

const categoryNotes: Record<string, string> = {
  Быт: "Дом, уют, привычки и маленькие договорённости.",
  Путешествия: "Маршруты, темп поездок и ваши общие приключения.",
  Красота: "Комплименты, стиль свиданий и забота о себе.",
  Отношения: "Близость, поддержка, планы и ежедневные ритуалы.",
  Интим: "Деликатные вопросы про комфорт, границы и доверие.",
  "Согласен/не согласен":
    "Быстрые утверждения, где видно совпадения и различия.",
  "Было/не было":
    "Список общих историй, которые уже случились или ждут своего момента.",
  "Фото-ответы":
    "Викторины, где вместо текста нужно отвечать фотографиями.",
};

type Couple = {
  id: string;
  partner_one_id: string;
  partner_two_id: string | null;
};

type QuizProgress = {
  mine: Set<string>;
  partner: Set<string>;
};

type StoredAnswers = Record<string, Record<string, string>>;

function localAnswersKey(coupleId: string, quizId: string) {
  return `couple-space:quiz-answers:${coupleId}:${quizId}`;
}

export default function QuizzesPage() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [activeCategory, setActiveCategory] = useState<QuizCategory>(quizCategories[0]);
  const [currentPage, setCurrentPage] = useState(1);
  const [progress, setProgress] = useState<QuizProgress>({
    mine: new Set(),
    partner: new Set(),
  });

  const activeCategoryQuizzes = useMemo(
    () => quizzes.filter((quiz) => quiz.category === activeCategory),
    [activeCategory]
  );
  const totalPages = Math.max(
    1,
    Math.ceil(activeCategoryQuizzes.length / QUIZZES_PER_PAGE)
  );
  const visibleQuizzes = activeCategoryQuizzes.slice(
    (currentPage - 1) * QUIZZES_PER_PAGE,
    currentPage * QUIZZES_PER_PAGE
  );
  const activeCompletedCount = activeCategoryQuizzes.filter((quiz) =>
    progress.mine.has(quiz.id)
  ).length;
  const activePartnerCompletedCount = activeCategoryQuizzes.filter((quiz) =>
    progress.partner.has(quiz.id)
  ).length;

  useEffect(() => {
    async function loadProgress() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      setCurrentUserId(user.id);

      const { data: coupleData } = await supabase
        .from("couples")
        .select("*")
        .or(`partner_one_id.eq.${user.id},partner_two_id.eq.${user.id}`)
        .limit(1)
        .single();

      if (!coupleData) return;

      setCouple(coupleData);

      const partnerId =
        user.id === coupleData.partner_one_id
          ? coupleData.partner_two_id
          : coupleData.partner_one_id;

      const myCompleted = new Set<string>();
      const partnerCompleted = new Set<string>();
      const localSyncJobs: Promise<Response>[] = [];

      quizzes.forEach((quiz) => {
        const raw = localStorage.getItem(localAnswersKey(coupleData.id, quiz.id));
        if (!raw) return;

        try {
          const stored = JSON.parse(raw) as StoredAnswers;
          if (stored[user.id]) {
            myCompleted.add(quiz.id);
            localSyncJobs.push(
              fetch("/api/quizzes/progress", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  quizId: quiz.id,
                  coupleId: coupleData.id,
                  userId: user.id,
                  answers: stored[user.id],
                }),
              })
            );
          }
          if (partnerId && stored[partnerId]) partnerCompleted.add(quiz.id);
        } catch {
          return;
        }
      });

      await Promise.allSettled(localSyncJobs);

      const response = await fetch(`/api/quizzes/progress?coupleId=${coupleData.id}`);
      const result = response.ok
        ? ((await response.json()) as {
            answers?: Array<{ quiz_id: string; user_id: string }>;
          })
        : { answers: [] };

      result.answers?.forEach((answer) => {
        if (answer.user_id === user.id) {
          myCompleted.add(answer.quiz_id);
        }

        if (partnerId && answer.user_id === partnerId) {
          partnerCompleted.add(answer.quiz_id);
        }
      });

      setProgress({
        mine: myCompleted,
        partner: partnerCompleted,
      });
    }

    loadProgress();
  }, []);

  function openCategory(category: QuizCategory) {
    setActiveCategory(category);
    setCurrentPage(1);
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f1e7ff] to-[#fbf7ff] px-6 pb-28 pt-28 text-[#7c3aed] transition-colors dark:from-[#170525] dark:to-[#09020f] dark:text-[#c084fc]">
      <section className="mx-auto max-w-6xl">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 inline-flex rounded-full border border-[#7c3aed]/20 bg-white/45 px-5 py-2 text-sm font-semibold text-[#7c3aed] shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-white/5 dark:text-[#c084fc]">
            Совместные тесты без подсказок
          </div>

          <h1 className="text-5xl font-bold tracking-tight text-[#6d28d9] dark:text-[#c084fc] md:text-6xl">
            Викторины
          </h1>

          <p className="mx-auto mt-5 max-w-3xl text-lg leading-relaxed text-[#6d28d9]/75 dark:text-[#d8b4fe]/75">
            Выберите категорию, откройте страницу с тестами и отвечайте отдельно.
            После прохождения можно сравнить ответы и обсудить совпадения.
          </p>
        </div>

        <div className="rounded-[2rem] border border-white/55 bg-white/35 p-4 shadow-[0_24px_90px_rgba(124,58,237,0.16)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {quizCategories.map((category) => {
              const categoryQuizzes = quizzes.filter((quiz) => quiz.category === category);
              const completedCount = categoryQuizzes.filter((quiz) =>
                progress.mine.has(quiz.id)
              ).length;
              const isActive = category === activeCategory;

              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => openCategory(category)}
                  className={`rounded-3xl border p-4 text-left shadow-lg transition hover:-translate-y-0.5 ${
                    isActive
                      ? "border-[#7c3aed]/35 bg-[#7c3aed] text-white shadow-[0_20px_60px_rgba(124,58,237,0.28)]"
                      : "border-white/55 bg-white/45 text-[#6d28d9] hover:bg-violet-50 dark:border-white/10 dark:bg-white/5 dark:text-[#d8b4fe] dark:hover:bg-violet-500/15"
                  }`}
                >
                  <span className="block text-lg font-black">{category}</span>
                  <span
                    className={`mt-2 block text-sm font-semibold ${
                      isActive
                        ? "text-white/75"
                        : "text-[#6d28d9]/60 dark:text-[#d8b4fe]/60"
                    }`}
                  >
                    {completedCount} из {categoryQuizzes.length} пройдено
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <section className="mt-8 rounded-[2rem] bg-gradient-to-b from-[#dfc8ff] to-[#eadcff] p-6 shadow-2xl dark:from-[#2b1240] dark:to-[#1b0828]">
          <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#8b5cf6] dark:text-[#d8b4fe]">
                Категория
              </p>
              <h2 className="mt-2 text-4xl font-black text-[#6d28d9] dark:text-[#c084fc]">
                {activeCategory}
              </h2>
              <p className="mt-3 max-w-2xl text-[#6d28d9]/70 dark:text-[#d8b4fe]/70">
                {categoryNotes[activeCategory]}
              </p>
            </div>

            <div className="grid w-full grid-cols-3 gap-2 text-center sm:min-w-[420px] lg:w-auto">
              {[
                ["Всего", activeCategoryQuizzes.length],
                ["Вы", activeCompletedCount],
                ["Партнёр", activePartnerCompletedCount],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-2xl bg-white/45 p-3 shadow-inner dark:bg-white/8"
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

          <div className="mb-6 flex flex-col gap-3 rounded-3xl bg-white/35 p-3 shadow-inner dark:bg-white/5 sm:p-4 md:flex-row md:items-center md:justify-between">
            <p className="text-sm font-bold text-[#6d28d9]/70 dark:text-[#d8b4fe]/70">
              Страница {currentPage} из {totalPages}. На странице до{" "}
              {QUIZZES_PER_PAGE} викторин.
            </p>
            <div className="flex max-w-full flex-wrap gap-2 overflow-hidden">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="rounded-full bg-white/70 px-4 py-2 text-sm font-black text-[#6d28d9] shadow transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-white/10 dark:text-[#d8b4fe] dark:hover:bg-violet-500/15"
              >
                Назад
              </button>
              {Array.from({ length: totalPages }).map((_, index) => {
                const page = index + 1;
                const shouldShowPage =
                  totalPages <= 5 ||
                  page === 1 ||
                  page === totalPages ||
                  Math.abs(page - currentPage) <= 1;

                if (!shouldShowPage) return null;

                return (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`h-10 w-10 rounded-full text-sm font-black shadow transition ${
                      currentPage === page
                        ? "bg-[#7c3aed] text-white"
                        : "bg-white/70 text-[#6d28d9] hover:bg-violet-50 dark:bg-white/10 dark:text-[#d8b4fe] dark:hover:bg-violet-500/15"
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className="rounded-full bg-white/70 px-4 py-2 text-sm font-black text-[#6d28d9] shadow transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-white/10 dark:text-[#d8b4fe] dark:hover:bg-violet-500/15"
              >
                Вперёд
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {visibleQuizzes.map((quiz) => {
              const isMineCompleted = progress.mine.has(quiz.id);
              const isPartnerCompleted = progress.partner.has(quiz.id);
              const isBothCompleted = isMineCompleted && isPartnerCompleted;

              return (
                <article
                  key={quiz.id}
                  className={`relative flex min-h-64 flex-col rounded-3xl p-6 shadow-inner backdrop-blur transition hover:-translate-y-1 ${
                    isMineCompleted
                      ? "bg-slate-300/70 text-slate-700 hover:bg-slate-300/80 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:bg-slate-700/80"
                      : "bg-white/35 hover:bg-violet-50/70 dark:bg-white/5 dark:hover:bg-violet-500/15"
                  }`}
                >
                  {isMineCompleted && (
                    <div className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-[#7c3aed] text-lg font-bold text-white shadow-lg">
                      ✓
                    </div>
                  )}

                  <div className="mb-5 flex items-center justify-between gap-4 pr-12">
                    <span
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${
                        isMineCompleted
                          ? "bg-white/70 text-slate-600 dark:bg-white/10 dark:text-slate-200"
                          : "bg-[#7c3aed]/15 text-[#6d28d9] dark:bg-white/10 dark:text-[#d8b4fe]"
                      }`}
                    >
                      {quiz.duration}
                    </span>
                    {!isMineCompleted && <span className="text-2xl">✦</span>}
                  </div>

                  <h3
                    className={`text-2xl font-bold ${
                      isMineCompleted
                        ? "text-slate-700 dark:text-slate-100"
                        : "text-[#6d28d9] dark:text-[#c084fc]"
                    }`}
                  >
                    {quiz.title}
                  </h3>

                  <p
                    className={`mt-3 flex-1 ${
                      isMineCompleted
                        ? "text-slate-600 dark:text-slate-300"
                        : "text-[#6d28d9]/70 dark:text-[#d8b4fe]/70"
                    }`}
                  >
                    {quiz.description}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {isMineCompleted && (
                      <span className="rounded-full bg-white/70 px-3 py-1 text-sm font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-200">
                        Вы прошли
                      </span>
                    )}

                    {isPartnerCompleted && (
                      <span className="rounded-full bg-[#7c3aed]/15 px-3 py-1 text-sm font-semibold text-[#6d28d9] dark:bg-white/10 dark:text-[#d8b4fe]">
                        Партнёр прошёл
                      </span>
                    )}

                    {isBothCompleted && (
                      <span className="rounded-full bg-[#7c3aed] px-3 py-1 text-sm font-semibold text-white">
                        Можно сравнить
                      </span>
                    )}
                  </div>

                  <Link
                    href={
                      isMineCompleted
                        ? `/quizzes/result?quiz=${quiz.id}`
                        : `/quizzes/play?quiz=${quiz.id}`
                    }
                    className={`mt-6 rounded-full px-6 py-3 text-center font-semibold shadow-lg transition ${
                      isMineCompleted
                        ? "bg-slate-700 text-white hover:bg-slate-800 dark:bg-slate-200 dark:text-slate-950 dark:hover:bg-white"
                        : "bg-[#7c3aed] text-white hover:bg-[#8b5cf6]"
                    }`}
                  >
                    {isMineCompleted ? "Открыть результат" : "Начать тест"}
                  </Link>
                </article>
              );
            })}
          </div>
        </section>

        {currentUserId && couple && (
          <div className="mt-6 rounded-3xl bg-white/35 p-5 text-sm font-semibold text-[#6d28d9]/70 shadow-inner backdrop-blur dark:bg-white/5 dark:text-[#d8b4fe]/70">
            Серые карточки с галочкой уже пройдены вами. Метка “Партнёр
            прошёл” показывает викторины, которые уже ответил второй человек.
          </div>
        )}
      </section>
    </main>
  );
}
