"use client";

import { supabase } from "@/lib/supabaseClient";
import { getQuizById } from "@/lib/quizzes";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Couple = {
  id: string;
  partner_one_id: string;
  partner_two_id: string | null;
};

type CoupleProfile = {
  partner_one: string;
  partner_two: string;
};

type StoredAnswers = Record<string, Record<string, string>>;

type DiscussionComment = {
  id: string;
  user_id: string;
  text: string;
  created_at: string;
};

function localAnswersKey(coupleId: string, quizId: string) {
  return `couple-space:quiz-answers:${coupleId}:${quizId}`;
}

function localCommentsKey(coupleId: string, quizId: string) {
  return `couple-space:quiz-comments:${coupleId}:${quizId}`;
}

function AnswerValue({ value, isPhoto }: { value?: string; isPhoto: boolean }) {
  if (!value) {
    return (
      <p className="text-lg font-bold text-[#6d28d9] dark:text-[#c084fc]">
        Ответ ещё не сохранён
      </p>
    );
  }

  if (isPhoto) {
    return (
      <Image
        src={value}
        alt="Фото-ответ"
        width={720}
        height={420}
        sizes="(min-width: 768px) 50vw, 100vw"
        className="max-h-64 w-full rounded-2xl object-cover shadow-lg"
      />
    );
  }

  return (
    <p className="text-lg font-bold text-[#6d28d9] dark:text-[#c084fc]">
      {value}
    </p>
  );
}

export default function QuizResultClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quizId = searchParams.get("quiz");
  const quiz = useMemo(() => getQuizById(quizId), [quizId]);

  const [couple, setCouple] = useState<Couple | null>(null);
  const [profile, setProfile] = useState<CoupleProfile | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [answersByUser, setAnswersByUser] = useState<StoredAnswers>({});
  const [comments, setComments] = useState<DiscussionComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [isLoading, setIsLoading] = useState(true);

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

      const { data: profileData } = await supabase
        .from("couple_profiles")
        .select("partner_one, partner_two")
        .eq("couple_id", coupleData.id)
        .limit(1)
        .single();

      if (profileData) setProfile(profileData);

      setIsLoading(false);
    }

    loadData();
  }, [router]);

  useEffect(() => {
    if (!quiz || !couple) return;

    const activeCouple = couple;
    const activeQuiz = quiz;

    const rawAnswers = localStorage.getItem(localAnswersKey(activeCouple.id, activeQuiz.id));
    if (rawAnswers) {
      try {
        queueMicrotask(() => setAnswersByUser(JSON.parse(rawAnswers) as StoredAnswers));
      } catch {
        queueMicrotask(() => setAnswersByUser({}));
      }
    }

    const rawComments = localStorage.getItem(localCommentsKey(activeCouple.id, activeQuiz.id));
    if (rawComments) {
      try {
        queueMicrotask(() => setComments(JSON.parse(rawComments) as DiscussionComment[]));
      } catch {
        queueMicrotask(() => setComments([]));
      }
    }

    async function loadRemote() {
      const response = await fetch(
        `/api/quizzes/progress?coupleId=${activeCouple.id}&quizId=${activeQuiz.id}`
      );
      const result = response.ok
        ? ((await response.json()) as {
            answers?: Array<{
              user_id: string;
              answers: Record<string, string>;
            }>;
          })
        : { answers: [] };

      if (result.answers?.length) {
        setAnswersByUser((current) => {
          const next = { ...current };
          result.answers?.forEach((item) => {
            next[item.user_id] = item.answers;
          });
          localStorage.setItem(localAnswersKey(activeCouple.id, activeQuiz.id), JSON.stringify(next));
          return next;
        });
      }

      const { data: commentsData } = await supabase
        .from("quiz_comments")
        .select("id, user_id, text, created_at")
        .eq("couple_id", activeCouple.id)
        .eq("quiz_id", activeQuiz.id)
        .order("created_at", { ascending: true });

      if (commentsData?.length) {
        setComments(commentsData);
        localStorage.setItem(localCommentsKey(activeCouple.id, activeQuiz.id), JSON.stringify(commentsData));
      }
    }

    loadRemote();
  }, [couple, quiz]);

  async function addComment() {
    if (!quiz || !couple || !currentUserId || !commentText.trim()) return;

    const newComment = {
      id: crypto.randomUUID(),
      user_id: currentUserId,
      text: commentText.trim(),
      created_at: new Date().toISOString(),
    };

    const nextComments = [...comments, newComment];
    setComments(nextComments);
    localStorage.setItem(localCommentsKey(couple.id, quiz.id), JSON.stringify(nextComments));
    setCommentText("");

    await supabase.from("quiz_comments").insert([
      {
        quiz_id: quiz.id,
        couple_id: couple.id,
        user_id: currentUserId,
        text: newComment.text,
      },
    ]);
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#f1e7ff] to-[#fbf7ff] px-6 text-[#7c3aed] dark:from-[#170525] dark:to-[#09020f] dark:text-[#c084fc]">
        <div className="rounded-3xl bg-white/40 p-8 font-semibold shadow-2xl backdrop-blur dark:bg-white/5">
          Собираем ответы...
        </div>
      </main>
    );
  }

  if (!quiz || !couple || !currentUserId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#f1e7ff] to-[#fbf7ff] px-6 text-[#7c3aed] dark:from-[#170525] dark:to-[#09020f] dark:text-[#c084fc]">
        <div className="max-w-md rounded-3xl bg-white/40 p-8 text-center shadow-2xl backdrop-blur dark:bg-white/5">
          <h1 className="text-3xl font-bold">Результат не найден</h1>
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

  const isPartnerOne = currentUserId === couple.partner_one_id;
  const myId = currentUserId;
  const partnerId = isPartnerOne ? couple.partner_two_id : couple.partner_one_id;
  const myName = isPartnerOne ? profile?.partner_one || "Я" : profile?.partner_two || "Я";
  const partnerName = isPartnerOne
    ? profile?.partner_two || "Партнёр"
    : profile?.partner_one || "Партнёр";
  const myAnswers = answersByUser[myId] || {};
  const partnerAnswers = partnerId ? answersByUser[partnerId] || {} : {};
  const matches = quiz.questions.filter(
    (question) => myAnswers[question.id] && myAnswers[question.id] === partnerAnswers[question.id]
  ).length;

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f1e7ff] to-[#fbf7ff] px-6 pb-28 pt-28 text-[#7c3aed] transition-colors dark:from-[#170525] dark:to-[#09020f] dark:text-[#c084fc]">
      <section className="mx-auto max-w-6xl">
        <div className="mb-8 rounded-3xl bg-gradient-to-b from-[#dfc8ff] to-[#eadcff] p-8 shadow-2xl dark:from-[#2b1240] dark:to-[#1b0828]">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#8b5cf6] dark:text-[#d8b4fe]">
            Результаты · {quiz.category}
          </p>
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-4xl font-bold text-[#6d28d9] dark:text-[#c084fc]">
                {quiz.title}
              </h1>
              <p className="mt-3 text-[#6d28d9]/75 dark:text-[#d8b4fe]/75">
                Совпадений: {matches} из {quiz.questions.length}
              </p>
            </div>

            <button
              onClick={() => router.push(`/quizzes/play?quiz=${quiz.id}`)}
              className="rounded-full bg-[#7c3aed] px-6 py-3 font-semibold text-white shadow-lg transition hover:bg-[#8b5cf6]"
            >
              Изменить мои ответы
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            {quiz.questions.map((question, index) => {
              const myAnswer = myAnswers[question.id];
              const partnerAnswer = partnerAnswers[question.id];
              const isPhotoQuestion = question.answerType === "photo";

              return (
                <section
                  key={question.id}
                  className="rounded-3xl bg-gradient-to-b from-[#dfc8ff] to-[#eadcff] p-6 shadow-lg dark:from-[#2b1240] dark:to-[#1b0828]"
                >
                  <div className="mb-5">
                    <p className="text-sm font-semibold text-[#8b5cf6] dark:text-[#d8b4fe]">
                      Вопрос {index + 1}
                    </p>
                    <h2 className="text-2xl font-bold text-[#6d28d9] dark:text-[#c084fc]">
                      {question.text}
                    </h2>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl bg-white/35 p-5 shadow-inner dark:bg-white/5">
                      <p className="mb-2 text-sm font-semibold text-[#8b5cf6] dark:text-[#d8b4fe]">
                        {myName}
                      </p>
                      <AnswerValue value={myAnswer} isPhoto={isPhotoQuestion} />
                    </div>

                    <div className="rounded-2xl bg-white/35 p-5 shadow-inner dark:bg-white/5">
                      <p className="mb-2 text-sm font-semibold text-[#8b5cf6] dark:text-[#d8b4fe]">
                        {partnerName}
                      </p>
                      <AnswerValue value={partnerAnswer} isPhoto={isPhotoQuestion} />
                    </div>
                  </div>
                </section>
              );
            })}
          </div>

          <aside className="h-fit rounded-3xl bg-gradient-to-b from-[#dfc8ff] to-[#eadcff] p-6 shadow-2xl dark:from-[#2b1240] dark:to-[#1b0828]">
            <h2 className="text-2xl font-bold text-[#6d28d9] dark:text-[#c084fc]">
              Обсуждение
            </h2>
            <p className="mt-2 text-sm text-[#6d28d9]/70 dark:text-[#d8b4fe]/70">
              Оставьте комментарий к результатам или договоритесь о маленьком плане.
            </p>

            <div className="mt-5 max-h-80 space-y-3 overflow-y-auto pr-1">
              {comments.length === 0 ? (
                <div className="rounded-2xl bg-white/35 p-4 text-sm font-semibold text-[#6d28d9]/70 shadow-inner dark:bg-white/5 dark:text-[#d8b4fe]/70">
                  Комментариев пока нет.
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="rounded-2xl bg-white/35 p-4 shadow-inner dark:bg-white/5">
                    <p className="text-sm font-semibold text-[#8b5cf6] dark:text-[#d8b4fe]">
                      {comment.user_id === currentUserId ? myName : partnerName}
                    </p>
                    <p className="mt-1 text-[#6d28d9] dark:text-[#c084fc]">
                      {comment.text}
                    </p>
                  </div>
                ))
              )}
            </div>

            <textarea
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              placeholder="Напишите, что хочется обсудить..."
              className="mt-5 min-h-28 w-full rounded-2xl border border-[#7c3aed]/25 bg-white/60 p-4 text-[#6d28d9] outline-none placeholder:text-[#8b5cf6]/60 dark:border-white/10 dark:bg-black/20 dark:text-[#d8b4fe] dark:placeholder:text-[#d8b4fe]/50"
            />

            <button
              onClick={addComment}
              className="mt-3 w-full rounded-full bg-[#7c3aed] px-6 py-3 font-semibold text-white shadow-lg transition hover:bg-[#8b5cf6]"
            >
              Добавить комментарий
            </button>
          </aside>
        </div>
      </section>
    </main>
  );
}
