"use client";

import { createPartnerNotification } from "@/lib/notifications";
import { supabase } from "@/lib/supabaseClient";
import { getQuizById, quizzes } from "@/lib/quizzes";
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

function getReadableName(value?: string | null, fallback = "Партнёр") {
  const name = value?.trim();
  if (!name) return fallback;
  if (/^\d{5,}$/.test(name)) return fallback;
  return name;
}

const quizDiscussionDraftKey = "couple-space:chat-draft";

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
        const storedAnswers = JSON.parse(rawAnswers) as StoredAnswers;
        queueMicrotask(() => setAnswersByUser(storedAnswers));
      } catch {
        queueMicrotask(() => setAnswersByUser({}));
      }
    }

    const rawComments = localStorage.getItem(localCommentsKey(activeCouple.id, activeQuiz.id));
    if (rawComments) {
      try {
        const storedComments = JSON.parse(rawComments) as DiscussionComment[];
        queueMicrotask(() => setComments(storedComments));
      } catch {
        queueMicrotask(() => setComments([]));
      }
    }

    async function loadRemote() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const authHeaders: Record<string, string> = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {};
      const response = await fetch(
        `/api/quizzes/progress?coupleId=${activeCouple.id}&quizId=${activeQuiz.id}`,
        { headers: authHeaders }
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

    await createPartnerNotification(couple, currentUserId, {
      type: "quiz_comment",
      title: "Комментарий к результатам",
      body: newComment.text,
      href: `/quizzes/result?quiz=${quiz.id}`,
    });
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

  if (quiz.questions.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#f1e7ff] to-[#fbf7ff] px-6 py-28 text-[#7c3aed] dark:from-[#170525] dark:to-[#09020f] dark:text-[#c084fc]">
        <section className="w-full max-w-2xl rounded-[2rem] bg-gradient-to-b from-[#dfc8ff] to-[#eadcff] p-8 text-center shadow-2xl dark:from-[#2b1240] dark:to-[#1b0828]">
          <p className="text-sm font-black uppercase tracking-wide text-[#8b5cf6] dark:text-[#d8b4fe]">
            Результаты · {quiz.category}
          </p>
          <h1 className="mt-3 text-4xl font-black text-[#6d28d9] dark:text-[#c084fc]">
            {quiz.title}
          </h1>
          <p className="mx-auto mt-4 max-w-lg font-semibold leading-7 text-[#6d28d9]/72 dark:text-[#d8b4fe]/72">
            В этой викторине сейчас нет вопросов, поэтому результаты временно не показываются. Комментарии и база прогресса остались на месте.
          </p>
          <button
            onClick={() => router.push("/quizzes")}
            className="mt-6 rounded-full bg-[#7c3aed] px-6 py-3 font-black text-white shadow-lg transition hover:bg-[#8b5cf6]"
          >
            Вернуться к викторинам
          </button>
        </section>
      </main>
    );
  }

  const isPartnerOne = currentUserId === couple.partner_one_id;
  const myId = currentUserId;
  const partnerId = isPartnerOne ? couple.partner_two_id : couple.partner_one_id;
  const myName = isPartnerOne
    ? getReadableName(profile?.partner_one, "Я")
    : getReadableName(profile?.partner_two, "Я");
  const partnerName = isPartnerOne
    ? getReadableName(profile?.partner_two, "Партнёр")
    : getReadableName(profile?.partner_one, "Партнёр");
  const myAnswers = answersByUser[myId] || {};
  const partnerAnswers = partnerId ? answersByUser[partnerId] || {} : {};
  const matches = quiz.questions.filter(
    (question) => myAnswers[question.id] && myAnswers[question.id] === partnerAnswers[question.id]
  ).length;
  const answeredTogether = quiz.questions.filter(
    (question) => myAnswers[question.id] && partnerAnswers[question.id]
  ).length;
  const matchPercent =
    quiz.questions.length > 0 ? Math.round((matches / quiz.questions.length) * 100) : 0;
  const differences = Math.max(0, answeredTogether - matches);
  const discussionTopics = quiz.questions
    .filter((question) => {
      const myAnswer = myAnswers[question.id];
      const partnerAnswer = partnerAnswers[question.id];
      return myAnswer && partnerAnswer && myAnswer !== partnerAnswer;
    })
    .slice(0, 3);
  const strongestMatch = quiz.questions.find((question) => {
    const myAnswer = myAnswers[question.id];
    return myAnswer && myAnswer === partnerAnswers[question.id];
  });
  const similarQuiz =
    quizzes.find((item) => item.category === quiz.category && item.id !== quiz.id) ||
    quizzes.find((item) => item.id !== quiz.id);

  function sendResultToChat() {
    if (!quiz) return;

    const lines = [
      `Я хочу обсудить викторину “${quiz.title}”.`,
      `Совпадение: ${matchPercent}% (${matches} из ${quiz.questions.length}).`,
      discussionTopics.length
        ? `Темы: ${discussionTopics.map((topic) => topic.text).join("; ")}`
        : "Кажется, у нас нет явных расхождений в ответах.",
    ];

    localStorage.setItem(quizDiscussionDraftKey, lines.join("\n"));
    router.push("/chat");
  }

  function sendQuestionToChat(question: { id: string; text: string }) {
    if (!quiz) return;

    const myAnswer = myAnswers[question.id] || "нет ответа";
    const partnerAnswer = partnerAnswers[question.id] || "нет ответа";
    const lines = [
      `Хочу обсудить вопрос из викторины “${quiz.title}”.`,
      `Вопрос: ${question.text}`,
      `${myName}: ${myAnswer}`,
      `${partnerName}: ${partnerAnswer}`,
    ];

    localStorage.setItem(quizDiscussionDraftKey, lines.join("\n"));
    router.push("/chat");
  }

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

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => router.push(`/quizzes/play?quiz=${quiz.id}`)}
                className="rounded-full bg-[#7c3aed] px-6 py-3 font-semibold text-white shadow-lg transition hover:bg-[#8b5cf6]"
              >
                Изменить мои ответы
              </button>
              <button
                onClick={sendResultToChat}
                className="rounded-full bg-white/60 px-6 py-3 font-semibold text-[#6d28d9] shadow-inner transition hover:bg-violet-50 dark:bg-white/10 dark:text-[#d8b4fe]"
              >
                Отправить в чат
              </button>
            </div>
          </div>

          <div className="mt-5 rounded-2xl bg-white/38 p-4 font-semibold text-[#6d28d9]/72 shadow-inner dark:bg-white/8 dark:text-[#d8b4fe]/72">
            {!Object.keys(myAnswers).length
              ? "Вы ещё не прошли тест. Ответьте, чтобы увидеть сравнение."
              : partnerId && !Object.keys(partnerAnswers).length
                ? "Партнёр ещё не прошёл тест. Результаты обновятся после его ответов."
                : answeredTogether === quiz.questions.length
                  ? "Оба прошли тест, можно сравнить ответы по каждому вопросу."
                  : "Часть ответов ещё не заполнена, поэтому сравнение неполное."}
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            {[
              ["Совпадение", `${matchPercent}%`],
              ["Одинаково", matches],
              ["Различается", differences],
              ["Ответили оба", answeredTogether],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-white/42 p-4 text-center shadow-inner dark:bg-white/8">
                <p className="text-3xl font-black text-[#6d28d9] dark:text-[#c084fc]">{value}</p>
                <p className="mt-1 text-xs font-black uppercase tracking-wide text-[#6d28d9]/58 dark:text-[#d8b4fe]/58">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            {(discussionTopics.length > 0 || strongestMatch) && (
              <section className="rounded-3xl bg-gradient-to-b from-[#dfc8ff] to-[#eadcff] p-6 shadow-lg dark:from-[#2b1240] dark:to-[#1b0828]">
                <h2 className="text-2xl font-black text-[#6d28d9] dark:text-[#c084fc]">
                  Что обсудить
                </h2>
                {strongestMatch && (
                  <div className="mt-4 rounded-2xl bg-emerald-100 p-4 text-emerald-800 shadow-inner dark:bg-emerald-500/15 dark:text-emerald-100">
                    <p className="text-sm font-black uppercase tracking-wide opacity-65">
                      Самое сильное совпадение
                    </p>
                    <p className="mt-1 font-black">{strongestMatch.text}</p>
                  </div>
                )}
                {discussionTopics.length > 0 && (
                  <div className="mt-4 grid gap-2">
                    {discussionTopics.map((topic, index) => (
                      <div
                        key={topic.id}
                        className="rounded-2xl bg-white/42 p-4 font-semibold text-[#6d28d9] shadow-inner dark:bg-white/8 dark:text-[#d8b4fe]"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <span>{index + 1}. {topic.text}</span>
                          <button
                            type="button"
                            onClick={() => sendQuestionToChat(topic)}
                            className="rounded-full bg-[#7c3aed] px-4 py-2 text-sm font-black text-white shadow-lg"
                          >
                            Обсудить
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

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
                  {myAnswer && partnerAnswer && (
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div
                        className={`rounded-2xl px-4 py-3 text-sm font-black shadow-inner ${
                          myAnswer === partnerAnswer
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-100"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-100"
                        }`}
                      >
                        {myAnswer === partnerAnswer ? "Совпали" : "Разные ответы, стоит обсудить"}
                      </div>
                      {myAnswer !== partnerAnswer && (
                        <button
                          type="button"
                          onClick={() => sendQuestionToChat(question)}
                          className="rounded-full bg-[#7c3aed] px-5 py-3 text-sm font-black text-white shadow-lg"
                        >
                          Обсудить в чате
                        </button>
                      )}
                    </div>
                  )}
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
              disabled={!commentText.trim()}
              className="mt-3 w-full rounded-full bg-[#7c3aed] px-6 py-3 font-semibold text-white shadow-lg transition hover:bg-[#8b5cf6]"
            >
              Добавить комментарий
            </button>

            {similarQuiz && (
              <button
                onClick={() => router.push(`/quizzes/play?quiz=${similarQuiz.id}`)}
                className="mt-3 w-full rounded-full bg-white/55 px-6 py-3 font-semibold text-[#6d28d9] shadow-inner transition hover:bg-violet-50 dark:bg-white/10 dark:text-[#d8b4fe]"
              >
                Пройти похожую викторину
              </button>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}
