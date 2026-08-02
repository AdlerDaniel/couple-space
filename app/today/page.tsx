"use client";

import AppSkeleton from "@/components/AppSkeleton";
import EmptyState from "@/components/EmptyState";
import MemoryComposer from "@/components/MemoryComposer";
import NavIcon from "@/components/NavIcon";
import { getDailyQuestion, getDailyQuestionDate } from "@/lib/dailyQuestions";
import { createPartnerNotification } from "@/lib/notifications";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

type Couple = {
  id: string;
  partner_one_id: string;
  partner_two_id: string | null;
};

type CoupleProfile = {
  partner_one: string | null;
  partner_two: string | null;
  time_zone: string | null;
};

type QuestionAnswer = {
  id: string;
  answer_one: string | null;
  answer_two: string | null;
};

type TodayState = {
  userId: string | null;
  couple: Couple | null;
  profile: CoupleProfile | null;
  answer: QuestionAnswer | null;
  watchRemaining: number;
  question: string;
  questionDate: string;
  timeZone: string;
  isLoading: boolean;
};

type FocusId = "question" | "memories" | "movies";

const defaultTimeZone = "Europe/Moscow";

const emptyState: TodayState = {
  userId: null,
  couple: null,
  profile: null,
  answer: null,
  watchRemaining: 0,
  question: getDailyQuestion(new Date(), defaultTimeZone),
  questionDate: getDailyQuestionDate(new Date(), defaultTimeZone),
  timeZone: defaultTimeZone,
  isLoading: true,
};

function getReadableName(value?: string | null, fallback = "Партнёр") {
  const name = value?.trim();
  if (!name || /^\d{5,}$/.test(name)) return fallback;
  return name;
}

function formatTodayDate(timeZone: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone,
  }).format(new Date());
}

export default function TodayPage() {
  const [state, setState] = useState<TodayState>(emptyState);
  const [activeFocus, setActiveFocus] = useState<FocusId>("question");
  const [questionDraft, setQuestionDraft] = useState("");
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);
  const [questionMessage, setQuestionMessage] = useState("");
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const isPartnerOne = state.userId === state.couple?.partner_one_id;
  const myAnswer = isPartnerOne ? state.answer?.answer_one : state.answer?.answer_two;
  const partnerAnswer = isPartnerOne ? state.answer?.answer_two : state.answer?.answer_one;
  const myName = isPartnerOne
    ? getReadableName(state.profile?.partner_one, "Вы")
    : getReadableName(state.profile?.partner_two, "Вы");
  const partnerName = isPartnerOne
    ? getReadableName(state.profile?.partner_two)
    : getReadableName(state.profile?.partner_one);

  useEffect(() => {
    let ignore = false;

    async function loadToday() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!ignore) setState({ ...emptyState, isLoading: false });
        return;
      }

      const { data: couple } = await supabase
        .from("couples")
        .select("id, partner_one_id, partner_two_id")
        .or(`partner_one_id.eq.${user.id},partner_two_id.eq.${user.id}`)
        .limit(1)
        .maybeSingle<Couple>();

      if (!couple) {
        if (!ignore) setState({ ...emptyState, userId: user.id, isLoading: false });
        return;
      }

      const { data: profileData } = await supabase
        .from("couple_profiles")
        .select("partner_one, partner_two, time_zone")
        .eq("couple_id", couple.id)
        .limit(1)
        .maybeSingle<CoupleProfile>();

      const timeZone = profileData?.time_zone || defaultTimeZone;
      const question = getDailyQuestion(new Date(), timeZone);
      const questionDate = getDailyQuestionDate(new Date(), timeZone);

      const [answerResult, watchResult] = await Promise.all([
          supabase
            .from("question_answers")
            .select("id, answer_one, answer_two")
            .eq("couple_id", couple.id)
            .eq("date", questionDate)
            .eq("question", question)
            .limit(1)
            .maybeSingle<QuestionAnswer>(),
          supabase
            .from("watch_items")
            .select("id", { count: "exact", head: true })
            .eq("couple_id", couple.id)
            .eq("is_watched", false),
        ]);

      if (ignore) return;

      const answer = answerResult.data || null;
      const userIsPartnerOne = user.id === couple.partner_one_id;
      const savedAnswer = userIsPartnerOne ? answer?.answer_one : answer?.answer_two;

      setState({
        userId: user.id,
        couple,
        profile: profileData || null,
        answer,
        watchRemaining: watchResult.count || 0,
        question,
        questionDate,
        timeZone,
        isLoading: false,
      });
      setActiveFocus(savedAnswer ? "memories" : "question");
    }

    loadToday();

    return () => {
      ignore = true;
    };
  }, []);

  async function saveQuestionAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const answer = questionDraft.trim();
    if (!answer || !state.couple || !state.userId || isSavingQuestion || myAnswer) return;

    setIsSavingQuestion(true);
    setQuestionMessage("");
    const answerField = isPartnerOne ? "answer_one" : "answer_two";
    const editedAtField = isPartnerOne ? "answer_one_edited_at" : "answer_two_edited_at";
    const savedAt = new Date().toISOString();

    const query = state.answer
      ? supabase
          .from("question_answers")
          .update({ [answerField]: answer, [editedAtField]: savedAt })
          .eq("id", state.answer.id)
          .select("id, answer_one, answer_two")
          .single<QuestionAnswer>()
      : supabase
          .from("question_answers")
          .insert([
            {
              couple_id: state.couple.id,
              question: state.question,
              date: state.questionDate,
              [answerField]: answer,
              [editedAtField]: savedAt,
            },
          ])
          .select("id, answer_one, answer_two")
          .single<QuestionAnswer>();

    const { data, error } = await query;

    if (error || !data) {
      setQuestionMessage(error?.message || "Не удалось сохранить ответ.");
      setIsSavingQuestion(false);
      return;
    }

    setState((current) => ({ ...current, answer: data }));
    setQuestionDraft("");
    setQuestionMessage("Ответ сохранён.");
    await createPartnerNotification(state.couple, state.userId, {
      type: "question_answered",
      title: "Ответ на вопрос дня",
      body: "Партнёр ответил на ежедневный вопрос.",
      href: "/questions/today",
    });
    setIsSavingQuestion(false);
  }

  if (state.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-6 text-slate-700 dark:bg-[#070c14] dark:text-white">
        <div className="w-full max-w-xl"><AppSkeleton rows={4} accent="#ea580c" /></div>
      </main>
    );
  }

  return (
    <main className={`today-page today-page-${activeFocus} min-h-screen px-4 pb-28 pt-7 text-slate-900 dark:text-white sm:px-6 lg:px-10 lg:pb-12 lg:pt-10`}>
      <section className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-extrabold capitalize text-slate-500 dark:text-slate-400">
              {formatTodayDate(state.timeZone)}
            </p>
            <h1 className="mt-1 text-4xl font-black tracking-normal text-slate-950 dark:text-white md:text-5xl">
              Сегодня
            </h1>
          </div>
          {state.couple && (
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
              {myName} <span className="px-1 text-rose-500">♥</span> {partnerName}
            </p>
          )}
        </header>

        {!state.userId ? (
          <div className="mt-8">
            <EmptyState
              icon="◌"
              title="Войдите, чтобы открыть ваш день"
              text="Здесь появятся вопрос дня и ваши общие воспоминания."
              actionHref="/login"
              actionLabel="Войти"
              accent="#ea580c"
            />
          </div>
        ) : !state.couple ? (
          <div className="mt-8">
            <EmptyState
              icon="♡"
              title="Создайте пару"
              text="Пригласите партнёра, чтобы начать общий день."
              actionHref="/profile"
              actionLabel="Создать пару"
              accent="#ea580c"
            />
          </div>
        ) : (
          <>
            <div className="today-focus-tabs mt-7 grid grid-cols-3 gap-1 p-1" role="tablist" aria-label="Этапы дня">
              {([
                { id: "question" as const, label: "Вопрос", icon: "questions" as const, note: myAnswer ? "Готово" : "Сейчас" },
                { id: "memories" as const, label: "Воспоминания", icon: "memories" as const, note: "Добавить" },
                { id: "movies" as const, label: "Фильмы", icon: "watch" as const, note: state.watchRemaining ? `${state.watchRemaining} идей` : "Добавить" },
              ]).map((focus) => (
                <button
                  key={focus.id}
                  type="button"
                  role="tab"
                  aria-selected={activeFocus === focus.id}
                  onClick={() => setActiveFocus(focus.id)}
                  className={`today-focus-tab ${activeFocus === focus.id ? "today-focus-tab-active" : ""}`}
                >
                  <NavIcon name={focus.icon} className="h-7 w-7" />
                  <span className="min-w-0 text-left">
                    <span className="block truncate text-sm font-black">{focus.label}</span>
                    <span className="block truncate text-[11px] font-bold opacity-60">{focus.note}</span>
                  </span>
                </button>
              ))}
            </div>

            <section className={`today-focus-card today-focus-${activeFocus} mt-3`} role="tabpanel">
              {activeFocus === "question" && (
                <div className="mx-auto max-w-3xl">
                  <p className="today-focus-eyebrow">Вопрос дня</p>
                  <h2 className="mt-4 text-3xl font-black leading-tight md:text-5xl">{state.question}</h2>

                  {myAnswer ? (
                    <div className="mt-7">
                      <p className="text-sm font-black opacity-60">Ваш ответ</p>
                      <p className="mt-2 line-clamp-3 text-lg font-bold leading-8">{myAnswer}</p>
                      <div className="mt-6 flex flex-wrap gap-3">
                        <Link href="/questions/today" className="today-primary-action">Открыть ответы</Link>
                        {!partnerAnswer && <span className="today-status-pill">Ответ партнёра ещё не открыт</span>}
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={saveQuestionAnswer} className="mt-7">
                      <textarea
                        value={questionDraft}
                        onChange={(event) => {
                          setQuestionDraft(event.target.value);
                          if (questionMessage) setQuestionMessage("");
                        }}
                        rows={4}
                        maxLength={600}
                        placeholder="Ваш ответ..."
                        className="today-focus-input"
                      />
                      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-bold opacity-60">Ответ увидит только ваш партнёр.</p>
                        <button
                          type="submit"
                          disabled={!questionDraft.trim() || isSavingQuestion}
                          className="today-primary-action disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isSavingQuestion ? "Сохраняем..." : "Ответить"}
                        </button>
                      </div>
                    </form>
                  )}
                  {questionMessage && <p className="mt-3 text-sm font-black">{questionMessage}</p>}
                </div>
              )}

              {activeFocus === "memories" && (
                <div className="mx-auto max-w-3xl">
                  <p className="today-focus-eyebrow">Воспоминания</p>
                  <h2 className="mt-4 text-3xl font-black leading-tight md:text-5xl">
                    Сохраните момент этого дня
                  </h2>
                  <p className="mt-4 max-w-2xl text-base font-semibold leading-7 opacity-70 md:text-lg">
                    Фотография, голос или несколько слов помогут вернуться к этому дню позже.
                  </p>
                  <div className="mt-7">
                    <MemoryComposer
                      couple={state.couple}
                      currentUserId={state.userId}
                      embedded
                    />
                  </div>
                </div>
              )}

              {activeFocus === "movies" && (
                <div className="mx-auto max-w-3xl">
                  <p className="today-focus-eyebrow">Фильмы</p>
                  <h2 className="mt-4 text-3xl font-black leading-tight md:text-5xl">
                    {state.watchRemaining ? "Выберите, что посмотреть вместе" : "Добавьте идею для общего вечера"}
                  </h2>
                  <p className="mt-4 max-w-2xl text-base font-semibold leading-7 opacity-70 md:text-lg">
                    {state.watchRemaining
                      ? `${state.watchRemaining} вариантов уже ждут выбора. Рулетка решит за вас.`
                      : "Фильм, сериал или аниме — сохраните один вариант, чтобы вечером не тратить время на поиск."}
                  </p>
                  <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                    <Link href="/watch?add=1" className="today-primary-action">Добавить фильм</Link>
                    <Link href="/watch?spin=1" className="today-secondary-action">Запустить рулетку</Link>
                  </div>
                </div>
              )}
            </section>

            <div className="mt-4">
              <button
                type="button"
                onClick={() => setIsMoreOpen((current) => !current)}
                className="today-more-toggle"
                aria-expanded={isMoreOpen}
              >
                <span>Что ещё сегодня</span>
                <NavIcon name="chevronRight" className={`h-7 w-7 transition-transform ${isMoreOpen ? "rotate-90" : ""}`} />
              </button>

              {isMoreOpen && (
                <div className="today-more-list mt-2 grid gap-1 p-2 sm:grid-cols-3">
                  {[
                    { label: "Чат", text: "Написать партнёру", href: "/chat", icon: "chat" as const },
                    { label: "Трекер", text: "Отметить прогресс", href: "/tracker", icon: "tracker" as const },
                    { label: "Кабинет", text: "Посмотреть итоги", href: "/dashboard", icon: "dashboard" as const },
                  ].map((item) => (
                    <Link key={item.href} href={item.href} className="today-more-row">
                      <NavIcon name={item.icon} className="h-9 w-9" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black">{item.label}</span>
                        <span className="block truncate text-xs font-bold opacity-60">{item.text}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
