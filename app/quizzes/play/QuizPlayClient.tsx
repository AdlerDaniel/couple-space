"use client";

import { supabase } from "@/lib/supabaseClient";
import { getQuizById } from "@/lib/quizzes";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Couple = {
  id: string;
  partner_one_id: string;
  partner_two_id: string | null;
};

type StoredAnswers = Record<string, Record<string, string>>;

function localAnswersKey(coupleId: string, quizId: string) {
  return `couple-space:quiz-answers:${coupleId}:${quizId}`;
}

export default function QuizPlayClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quizId = searchParams.get("quiz");
  const quiz = useMemo(() => getQuizById(quizId), [quizId]);

  const [couple, setCouple] = useState<Couple | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadCouple() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setCurrentUserId(user.id);

      const { data: coupleData, error } = await supabase
        .from("couples")
        .select("*")
        .or(`partner_one_id.eq.${user.id},partner_two_id.eq.${user.id}`)
        .limit(1)
        .single();

      if (error || !coupleData) {
        router.push("/couple");
        return;
      }

      setCouple(coupleData);
      setIsLoading(false);
    }

    loadCouple();
  }, [router]);

  useEffect(() => {
    if (!quiz || !couple || !currentUserId) return;

    const raw = localStorage.getItem(localAnswersKey(couple.id, quiz.id));
    if (!raw) return;

    try {
      const stored = JSON.parse(raw) as StoredAnswers;
      queueMicrotask(() => setAnswers(stored[currentUserId] || {}));
    } catch {
      queueMicrotask(() => setAnswers({}));
    }
  }, [couple, currentUserId, quiz]);

  function updateAnswer(questionId: string, value: string) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  }

  async function saveAnswers() {
    if (!quiz || !couple || !currentUserId) return;

    const hasMissingAnswer = quiz.questions.some((question) => !answers[question.id]);
    if (hasMissingAnswer) {
      setMessage("Ответьте на все вопросы, чтобы увидеть результат.");
      return;
    }

    setIsSaving(true);
    setMessage("");

    const key = localAnswersKey(couple.id, quiz.id);
    const stored = (() => {
      try {
        return JSON.parse(localStorage.getItem(key) || "{}") as StoredAnswers;
      } catch {
        return {};
      }
    })();

    stored[currentUserId] = answers;
    localStorage.setItem(key, JSON.stringify(stored));

    const response = await fetch("/api/quizzes/progress", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        quizId: quiz.id,
        coupleId: couple.id,
        userId: currentUserId,
        answers,
      }),
    });

    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      setIsSaving(false);
      setMessage(result.error || "Не удалось сохранить прогресс для партнёра");
      return;
    }

    setIsSaving(false);
    router.push(`/quizzes/result?quiz=${quiz.id}`);
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#f1e7ff] to-[#fbf7ff] px-6 text-[#7c3aed] dark:from-[#170525] dark:to-[#09020f] dark:text-[#c084fc]">
        <div className="rounded-3xl bg-white/40 p-8 font-semibold shadow-2xl backdrop-blur dark:bg-white/5">
          Загружаем викторину...
        </div>
      </main>
    );
  }

  if (!quiz) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#f1e7ff] to-[#fbf7ff] px-6 text-[#7c3aed] dark:from-[#170525] dark:to-[#09020f] dark:text-[#c084fc]">
        <div className="max-w-md rounded-3xl bg-white/40 p-8 text-center shadow-2xl backdrop-blur dark:bg-white/5">
          <h1 className="text-3xl font-bold">Викторина не найдена</h1>
          <button
            onClick={() => router.push("/quizzes")}
            className="mt-6 rounded-full bg-[#7c3aed] px-6 py-3 font-semibold text-white"
          >
            Вернуться к викторинам
          </button>
        </div>
      </main>
    );
  }

  const answeredCount = quiz.questions.filter((question) => answers[question.id]).length;

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f1e7ff] to-[#fbf7ff] px-6 pb-28 pt-28 text-[#7c3aed] transition-colors dark:from-[#170525] dark:to-[#09020f] dark:text-[#c084fc]">
      <section className="mx-auto max-w-4xl">
        <button
          onClick={() => router.push("/quizzes")}
          className="mb-6 rounded-full border border-[#7c3aed]/20 bg-white/45 px-5 py-2 font-semibold text-[#6d28d9] shadow-lg backdrop-blur transition hover:bg-white/70 dark:border-white/10 dark:bg-white/5 dark:text-[#d8b4fe]"
        >
          Назад
        </button>

        <div className="mb-8 rounded-3xl bg-gradient-to-b from-[#dfc8ff] to-[#eadcff] p-8 shadow-2xl dark:from-[#2b1240] dark:to-[#1b0828]">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#8b5cf6] dark:text-[#d8b4fe]">
            {quiz.category} · {answeredCount} из {quiz.questions.length}
          </p>
          <h1 className="text-4xl font-bold text-[#6d28d9] dark:text-[#c084fc]">
            {quiz.title}
          </h1>
          <p className="mt-4 text-[#6d28d9]/75 dark:text-[#d8b4fe]/75">
            Отвечайте самостоятельно. После сохранения откроется страница сравнения ответов.
          </p>
        </div>

        <div className="space-y-5">
          {quiz.questions.map((question, index) => (
            <section
              key={question.id}
              className="rounded-3xl bg-gradient-to-b from-[#dfc8ff] to-[#eadcff] p-6 shadow-lg dark:from-[#2b1240] dark:to-[#1b0828]"
            >
              <p className="mb-2 text-sm font-semibold text-[#8b5cf6] dark:text-[#d8b4fe]">
                Вопрос {index + 1}
              </p>
              <h2 className="mb-5 text-2xl font-bold text-[#6d28d9] dark:text-[#c084fc]">
                {question.text}
              </h2>

              <div className="grid gap-3 md:grid-cols-2">
                {question.options.map((option) => {
                  const isSelected = answers[question.id] === option;

                  return (
                    <button
                      key={option}
                      onClick={() => updateAnswer(question.id, option)}
                      className={`rounded-2xl border p-4 text-left font-semibold shadow-inner transition ${
                        isSelected
                          ? "border-[#7c3aed] bg-[#7c3aed] text-white"
                          : "border-[#7c3aed]/20 bg-white/35 text-[#6d28d9] hover:bg-white/55 dark:border-white/10 dark:bg-white/5 dark:text-[#d8b4fe] dark:hover:bg-white/10"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-8 rounded-3xl bg-gradient-to-b from-[#dfc8ff] to-[#eadcff] p-6 shadow-2xl dark:from-[#2b1240] dark:to-[#1b0828]">
          <button
            onClick={saveAnswers}
            disabled={isSaving}
            className="w-full rounded-full bg-[#7c3aed] px-6 py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-[#8b5cf6] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Сохраняем..." : "Сохранить и посмотреть результат"}
          </button>

          {message && (
            <p className="mt-4 text-center font-semibold text-[#6d28d9] dark:text-[#d8b4fe]">
              {message}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
