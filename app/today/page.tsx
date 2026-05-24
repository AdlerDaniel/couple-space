"use client";

import { getDailyQuestion, getDailyQuestionDate } from "@/lib/dailyQuestions";
import { quizzes } from "@/lib/quizzes";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useEffect, useState } from "react";

type Couple = {
  id: string;
  partner_one_id: string;
  partner_two_id: string | null;
};

type QuestionAnswer = {
  answer_one: string | null;
  answer_two: string | null;
};

type TrackerGoal = {
  title: string;
  target_count: number;
  period: string;
};

type ChatMessage = {
  body: string | null;
  attachment_type: string | null;
  created_at: string;
};

type WatchPreview = {
  title: string;
  content_type: string;
  is_watched: boolean;
  updated_at: string;
};

type TodayState = {
  userId: string | null;
  couple: Couple | null;
  answer: QuestionAnswer | null;
  goal: TrackerGoal | null;
  chat: ChatMessage | null;
  latestWatchItem: WatchPreview | null;
  watchTotal: number;
  watchRemaining: number;
  question: string;
  questionDate: string;
  timeZone: string;
  isLoading: boolean;
};

const emptyState: TodayState = {
  userId: null,
  couple: null,
  answer: null,
  goal: null,
  chat: null,
  latestWatchItem: null,
  watchTotal: 0,
  watchRemaining: 0,
  question: getDailyQuestion(),
  questionDate: getDailyQuestionDate(),
  timeZone: "Europe/Moscow",
  isLoading: true,
};

function getGoalPeriodLabel(period: string) {
  if (period === "day") return "на день";
  if (period === "month") return "на месяц";
  if (period === "year") return "на год";
  return "на неделю";
}

function getChatPreview(message: ChatMessage | null) {
  if (!message) return "Сообщений сегодня пока нет";
  if (message.body) return message.body;
  if (message.attachment_type === "audio") return "Голосовое сообщение";
  return "Вложение";
}

function getWatchTypeLabel(type: string) {
  if (type === "series") return "Сериал";
  if (type === "cartoon") return "Мультфильм";
  if (type === "anime") return "Аниме";
  return "Фильм";
}

export default function TodayPage() {
  const [state, setState] = useState<TodayState>(emptyState);
  const recommendedQuiz = quizzes[0];
  const isPartnerOne = state.userId === state.couple?.partner_one_id;
  const myAnswer = isPartnerOne ? state.answer?.answer_one : state.answer?.answer_two;
  const partnerAnswer = isPartnerOne ? state.answer?.answer_two : state.answer?.answer_one;

  useEffect(() => {
    async function loadToday() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setState({ ...emptyState, isLoading: false });
        return;
      }

      const { data: couple } = await supabase
        .from("couples")
        .select("id, partner_one_id, partner_two_id")
        .or(`partner_one_id.eq.${user.id},partner_two_id.eq.${user.id}`)
        .limit(1)
        .maybeSingle<Couple>();

      if (!couple) {
        setState({ ...emptyState, userId: user.id, isLoading: false });
        return;
      }

      const { data: profileData } = await supabase
        .from("couple_profiles")
        .select("time_zone")
        .eq("couple_id", couple.id)
        .limit(1)
        .maybeSingle<{ time_zone: string | null }>();

      const timeZone = profileData?.time_zone || "Europe/Moscow";
      const question = getDailyQuestion(new Date(), timeZone);
      const questionDate = getDailyQuestionDate(new Date(), timeZone);

      const [answerResult, goalResult, chatResult, watchCountResult, watchRemainingResult, latestWatchResult] = await Promise.all([
        supabase
          .from("question_answers")
          .select("answer_one, answer_two")
          .eq("couple_id", couple.id)
          .eq("date", questionDate)
          .eq("question", question)
          .limit(1)
          .maybeSingle<QuestionAnswer>(),
        supabase
          .from("tracker_goals")
          .select("title, target_count, period")
          .eq("couple_id", couple.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle<TrackerGoal>(),
        supabase
          .from("couple_chat_messages")
          .select("body, attachment_type, created_at")
          .eq("couple_id", couple.id)
          .eq("deleted_for_everyone", false)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle<ChatMessage>(),
        supabase
          .from("watch_items")
          .select("id", { count: "exact", head: true })
          .eq("couple_id", couple.id),
        supabase
          .from("watch_items")
          .select("id", { count: "exact", head: true })
          .eq("couple_id", couple.id)
          .eq("is_watched", false),
        supabase
          .from("watch_items")
          .select("title, content_type, is_watched, updated_at")
          .eq("couple_id", couple.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle<WatchPreview>(),
      ]);

      setState({
        userId: user.id,
        couple,
        answer: answerResult.data || null,
        goal: goalResult.data || null,
        chat: chatResult.data || null,
        latestWatchItem: latestWatchResult.data || null,
        watchTotal: watchCountResult.count || 0,
        watchRemaining: watchRemainingResult.count || 0,
        question,
        questionDate,
        timeZone,
        isLoading: false,
      });
    }

    loadToday();
  }, []);

  const cards = [
    {
      title: myAnswer ? "Открыть ответ дня" : "Ответить на вопрос",
      text: myAnswer
        ? partnerAnswer
          ? "Оба ответа готовы, можно прочитать и отреагировать."
          : "Ваш ответ сохранён, партнёр ещё думает."
        : state.question,
      href: myAnswer ? "/questions/today" : "/questions/answer",
      icon: "✉",
      color: "emerald",
    },
    {
      title: state.goal ? "Отметить цель" : "Поставить первую цель",
      text: state.goal
        ? `${state.goal.title}: ${state.goal.target_count} ${getGoalPeriodLabel(state.goal.period)}`
        : "Выберите общий ритуал, который хочется поддерживать.",
      href: "/tracker",
      icon: "◫",
      color: "amber",
    },
    {
      title: "Последнее сообщение",
      text: getChatPreview(state.chat),
      href: "/chat",
      icon: "◌",
      color: "sky",
    },
    {
      title: state.watchRemaining ? "Выбрать фильм на вечер" : "Добавить первый фильм",
      text: state.watchRemaining
        ? `${state.watchRemaining} вариантов ждут рулетку${state.latestWatchItem ? ` · последнее: ${state.latestWatchItem.title}` : ""}`
        : "Соберите общий список фильмов, сериалов и аниме.",
      href: state.watchRemaining ? "/watch?spin=1" : "/watch",
      icon: "▥",
      color: "lime",
    },
    {
      title: "Викторина дня",
      text: recommendedQuiz.description,
      href: `/quizzes/play?quiz=${recommendedQuiz.id}`,
      icon: "✦",
      color: "violet",
    },
  ];

  if (state.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fff8ed] px-6 text-[#c2410c] dark:bg-[#140b05] dark:text-white">
        <div className="rounded-3xl bg-white/60 p-8 font-black shadow-xl dark:bg-white/8">
          Собираем день пары...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fff8ed] px-4 pb-28 pt-24 text-[#7c2d12] dark:bg-[#140b05] dark:text-white md:px-6 md:pt-28">
      <section className="mx-auto max-w-6xl">
        <div className="rounded-[2rem] border border-white/60 bg-white/66 p-5 shadow-[0_24px_90px_rgba(194,65,12,0.14)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/8 md:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#ea580c]/65 dark:text-orange-100/65">
                Сегодня
              </p>
              <h1 className="mt-2 text-4xl font-black text-[#c2410c] dark:text-white md:text-5xl">
                Один рабочий экран пары
              </h1>
              <p className="mt-3 max-w-2xl font-semibold leading-7 text-[#7c2d12]/62 dark:text-white/55">
                Вопрос дня, цель, чат и короткая викторина собраны здесь, чтобы не прыгать по разделам.
              </p>
            </div>
            {state.couple && (
              <div className="rounded-2xl bg-white/62 px-4 py-3 text-sm font-black shadow-inner dark:bg-white/10">
                Таймзона: {state.timeZone}
              </div>
            )}
          </div>
        </div>

        {!state.userId ? (
          <div className="mt-5 rounded-[2rem] bg-white/62 p-6 text-center shadow-inner dark:bg-white/8">
            <p className="text-2xl font-black">Войдите, чтобы собрать день пары</p>
            <p className="mt-2 font-semibold opacity-65">После входа здесь появятся вопрос дня, цель, чат и быстрые действия.</p>
            <Link href="/login" className="mt-4 inline-flex rounded-full bg-[#ea580c] px-5 py-3 font-black text-white">
              Войти
            </Link>
          </div>
        ) : !state.couple ? (
          <div className="mt-5 rounded-[2rem] bg-white/62 p-6 text-center shadow-inner dark:bg-white/8">
            <p className="text-2xl font-black">Создайте пару</p>
            <p className="mt-2 font-semibold opacity-65">Пригласите партнёра, чтобы открыть общий день, ответы и цели.</p>
            <Link href="/profile" className="mt-4 inline-flex rounded-full bg-[#ea580c] px-5 py-3 font-black text-white">
              Создать пару
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-5 rounded-[2rem] border border-orange-200/60 bg-orange-50/80 p-5 shadow-inner dark:border-orange-200/10 dark:bg-orange-500/10">
              <p className="text-sm font-black uppercase tracking-[0.18em] opacity-55">Лучший следующий шаг</p>
              <h2 className="mt-2 text-3xl font-black">
                {!myAnswer
                  ? "Ответьте на первый вопрос дня"
                  : partnerAnswer
                    ? "Откройте ответ партнёра и оставьте реакцию"
                    : "Подождите партнёра или напишите короткое сообщение"}
              </h2>
              <p className="mt-2 font-semibold leading-7 opacity-65">
                {!myAnswer
                  ? state.question
                  : partnerAnswer
                    ? "Оба ответа готовы, поэтому самое полезное действие сейчас — сравнить их."
                    : "Ваш ответ уже есть. Можно мягко напомнить партнёру в чате."}
              </p>
              <Link
                href={!myAnswer ? "/questions/answer" : partnerAnswer ? "/questions/today" : "/chat"}
                className="mt-4 inline-flex rounded-full bg-[#ea580c] px-5 py-3 font-black text-white shadow-lg"
              >
                Открыть
              </Link>
            </div>

            <div className="mt-5 rounded-[2rem] border border-lime-200/70 bg-lime-50/80 p-5 shadow-inner dark:border-lime-200/10 dark:bg-lime-500/10">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-lime-700/60 dark:text-lime-100/60">
                    Вечерний выбор
                  </p>
                  <h2 className="mt-2 text-3xl font-black text-lime-900 dark:text-white">
                    {state.watchRemaining ? "Рулетка готова" : "Соберите список на просмотр"}
                  </h2>
                  <p className="mt-2 font-semibold leading-7 text-lime-900/65 dark:text-white/55">
                    {state.watchRemaining
                      ? `${state.watchRemaining} вариантов в списке. ${
                          state.latestWatchItem
                            ? `Последнее обновление: ${state.latestWatchItem.title} (${getWatchTypeLabel(state.latestWatchItem.content_type).toLowerCase()}).`
                            : "Можно выбрать случайный вариант на вечер."
                        }`
                      : "Добавьте фильмы, сериалы, мультфильмы или аниме, а потом доверьте выбор рулетке."}
                  </p>
                </div>
                <Link
                  href={state.watchRemaining ? "/watch?spin=1" : "/watch"}
                  className="shrink-0 rounded-full bg-lime-600 px-5 py-3 text-center font-black text-white shadow-lg transition hover:-translate-y-0.5"
                >
                  {state.watchRemaining ? "Крутить рулетку" : "Открыть список"}
                </Link>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {cards.map((card) => (
                <Link
                  key={card.title}
                  href={card.href}
                  className="rounded-[1.6rem] border border-white/60 bg-white/62 p-5 shadow-inner transition hover:-translate-y-1 hover:bg-orange-50 dark:border-white/10 dark:bg-white/8 dark:hover:bg-orange-500/15"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="text-2xl font-black text-[#c2410c] dark:text-white">
                        {card.title}
                      </h2>
                      <p className="mt-3 line-clamp-3 font-semibold leading-7 text-[#7c2d12]/62 dark:text-white/55">
                        {card.text}
                      </p>
                      {!state.goal && card.href === "/tracker" && (
                        <p className="mt-3 text-sm font-black text-[#ea580c]">
                          Начните с маленькой цели на сегодня.
                        </p>
                      )}
                      {!state.chat && card.href === "/chat" && (
                        <p className="mt-3 text-sm font-black text-[#ea580c]">
                          Например: “Как ты сегодня?”
                        </p>
                      )}
                    </div>
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/75 text-2xl shadow-inner dark:bg-white/10">
                      {card.icon}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
