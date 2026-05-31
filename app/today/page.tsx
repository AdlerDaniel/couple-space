"use client";

import AppSkeleton from "@/components/AppSkeleton";
import EmptyState from "@/components/EmptyState";
import { createPartnerNotification } from "@/lib/notifications";
import { getDailyQuestion, getDailyQuestionDate } from "@/lib/dailyQuestions";
import { quizzes } from "@/lib/quizzes";
import { supabase } from "@/lib/supabaseClient";
import { formatRuDate, formatRuTime, getDateTimestamp, getTodayNextStep } from "@/lib/today";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";

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
  answer_one: string | null;
  answer_two: string | null;
};

type TrackerGoal = {
  title: string;
  target_count: number;
  period: string;
};

type ChatMessage = {
  id: string;
  body: string | null;
  sender_id: string;
  attachment_type: string | null;
  created_at: string;
};

type CoupleNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

type WatchPreview = {
  title: string;
  content_type: string;
  is_watched: boolean;
  updated_at: string;
};

type MemoryEvent = {
  id: string;
  title: string | null;
  event_date: string | null;
  created_at: string;
};

type TodayState = {
  userId: string | null;
  couple: Couple | null;
  profile: CoupleProfile | null;
  answer: QuestionAnswer | null;
  goal: TrackerGoal | null;
  latestChat: ChatMessage | null;
  unreadChat: ChatMessage | null;
  unreadNotification: CoupleNotification | null;
  latestWatchItem: WatchPreview | null;
  nextEvent: MemoryEvent | null;
  watchTotal: number;
  watchRemaining: number;
  question: string;
  questionDate: string;
  timeZone: string;
  isLoading: boolean;
};

type UnreadItem = {
  title: string;
  text: string;
  href: string;
  createdAt: string;
  icon: string;
};

const defaultTimeZone = "Europe/Moscow";
const recommendedQuiz = quizzes[0];

const emptyState: TodayState = {
  userId: null,
  couple: null,
  profile: null,
  answer: null,
  goal: null,
  latestChat: null,
  unreadChat: null,
  unreadNotification: null,
  latestWatchItem: null,
  nextEvent: null,
  watchTotal: 0,
  watchRemaining: 0,
  question: getDailyQuestion(new Date(), defaultTimeZone),
  questionDate: getDailyQuestionDate(new Date(), defaultTimeZone),
  timeZone: defaultTimeZone,
  isLoading: true,
};

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getGoalPeriodLabel(period: string) {
  if (period === "day") return "на день";
  if (period === "month") return "на месяц";
  if (period === "year") return "на год";
  return "на неделю";
}

function getChatPreview(message: ChatMessage | null) {
  if (!message) return "Сообщений пока нет";
  if (message.body) return message.body;
  if (message.attachment_type === "audio") return "Голосовое сообщение";
  return "Вложение";
}

function getWatchTypeLabel(type: string) {
  if (type === "series") return "сериал";
  if (type === "cartoon") return "мультфильм";
  if (type === "anime") return "аниме";
  return "фильм";
}

function getReadableName(value?: string | null, fallback = "Партнёр") {
  const name = value?.trim();
  if (!name) return fallback;
  if (/^\d{5,}$/.test(name)) return fallback;
  return name;
}

function getUnreadItem(state: TodayState): UnreadItem | null {
  const notification = state.unreadNotification;
  const chat = state.unreadChat;

  if (!notification && !chat) return null;
  if (
    chat &&
    (!notification || getDateTimestamp(chat.created_at) > getDateTimestamp(notification.created_at))
  ) {
    return {
      title: "Новое сообщение",
      text: getChatPreview(chat),
      href: "/chat",
      createdAt: chat.created_at,
      icon: "◌",
    };
  }

  return notification
    ? {
        title: notification.title,
        text: notification.body || "Новое событие пары",
        href: notification.href || "/notifications",
        createdAt: notification.created_at,
        icon: notification.type.includes("question") ? "✉" : "●",
      }
    : null;
}

export default function TodayPage() {
  const [state, setState] = useState<TodayState>(emptyState);
  const [quickReply, setQuickReply] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [replyMessage, setReplyMessage] = useState("");

  const isPartnerOne = state.userId === state.couple?.partner_one_id;
  const myAnswer = isPartnerOne ? state.answer?.answer_one : state.answer?.answer_two;
  const partnerAnswer = isPartnerOne ? state.answer?.answer_two : state.answer?.answer_one;
  const partnerId = isPartnerOne ? state.couple?.partner_two_id : state.couple?.partner_one_id;
  const partnerName = isPartnerOne
    ? getReadableName(state.profile?.partner_two)
    : getReadableName(state.profile?.partner_one);
  const unreadItem = getUnreadItem(state);

  const nextStep = useMemo(
    () =>
      getTodayNextStep({
        isAuthenticated: Boolean(state.userId),
        hasCouple: Boolean(state.couple),
        hasPartner: Boolean(partnerId),
        hasUnread: Boolean(unreadItem),
        hasMyAnswer: Boolean(myAnswer),
        hasPartnerAnswer: Boolean(partnerAnswer),
        hasUpcomingEvent: Boolean(state.nextEvent),
        watchRemaining: state.watchRemaining,
        hasGoal: Boolean(state.goal),
        quizHref: recommendedQuiz ? `/quizzes/play?quiz=${recommendedQuiz.id}` : "/quizzes",
        unreadHref: unreadItem?.href,
        upcomingEventHref: state.nextEvent ? "/calendar" : null,
      }),
    [
      myAnswer,
      partnerAnswer,
      partnerId,
      state.couple,
      state.goal,
      state.nextEvent,
      state.userId,
      state.watchRemaining,
      unreadItem,
    ],
  );

  const ritualSteps = [
    { label: "Вопрос", done: Boolean(myAnswer), href: myAnswer ? "/questions/today" : "/questions/answer" },
    { label: "Ответ партнёра", done: Boolean(partnerAnswer), href: "/questions/today" },
    { label: "Связь", done: Boolean(state.latestChat), href: "/chat" },
    { label: "Вечер", done: state.watchRemaining > 0, href: "/watch" },
  ];

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
      const todayKey = getTodayKey();

      const [
        answerResult,
        goalResult,
        latestChatResult,
        unreadChatResult,
        unreadNotificationResult,
        watchCountResult,
        watchRemainingResult,
        latestWatchResult,
        nextEventResult,
      ] = await Promise.all([
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
          .select("id, body, sender_id, attachment_type, created_at")
          .eq("couple_id", couple.id)
          .eq("deleted_for_everyone", false)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle<ChatMessage>(),
        supabase
          .from("couple_chat_messages")
          .select("id, body, sender_id, attachment_type, created_at")
          .eq("couple_id", couple.id)
          .eq("deleted_for_everyone", false)
          .neq("sender_id", user.id)
          .is("read_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle<ChatMessage>(),
        supabase
          .from("couple_notifications")
          .select("id, type, title, body, href, read_at, created_at")
          .eq("recipient_id", user.id)
          .is("read_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle<CoupleNotification>(),
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
        supabase
          .from("memories")
          .select("id, title, event_date, created_at")
          .eq("couple_id", couple.id)
          .not("event_date", "is", null)
          .gte("event_date", todayKey)
          .order("event_date", { ascending: true })
          .limit(1)
          .maybeSingle<MemoryEvent>(),
      ]);

      if (ignore) return;

      setState({
        userId: user.id,
        couple,
        profile: profileData || null,
        answer: answerResult.data || null,
        goal: goalResult.data || null,
        latestChat: latestChatResult.data || null,
        unreadChat: unreadChatResult.data || null,
        unreadNotification: unreadNotificationResult.data || null,
        latestWatchItem: latestWatchResult.data || null,
        nextEvent: nextEventResult.data || null,
        watchTotal: watchCountResult.count || 0,
        watchRemaining: watchRemainingResult.count || 0,
        question,
        questionDate,
        timeZone,
        isLoading: false,
      });
    }

    loadToday();

    return () => {
      ignore = true;
    };
  }, []);

  async function sendQuickReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = quickReply.trim();
    if (!body || !state.couple || !state.userId || !partnerId || isSendingReply) return;

    setIsSendingReply(true);
    setReplyMessage("");

    const { data, error } = await supabase
      .from("couple_chat_messages")
      .insert([
        {
          couple_id: state.couple.id,
          sender_id: state.userId,
          body,
        },
      ])
      .select("id, body, sender_id, attachment_type, created_at")
      .single<ChatMessage>();

    if (error || !data) {
      setReplyMessage(error?.message || "Не удалось отправить сообщение.");
      setIsSendingReply(false);
      return;
    }

    setState((current) => ({ ...current, latestChat: data }));
    setQuickReply("");
    setReplyMessage("Сообщение отправлено.");
    await createPartnerNotification(state.couple, state.userId, {
      type: "chat_message",
      title: "Новое сообщение",
      body,
      href: "/chat",
    });
    setIsSendingReply(false);
  }

  if (state.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fff8ed] px-6 text-[#c2410c] dark:bg-[#140b05] dark:text-white">
        <div className="w-full max-w-xl">
          <AppSkeleton rows={5} accent="#ea580c" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fff8ed] px-4 pb-28 pt-24 text-[#7c2d12] dark:bg-[#140b05] dark:text-white md:px-6 md:pt-28">
      <section className="mx-auto max-w-6xl">
        <div className="rounded-[2rem] border border-white/60 bg-white/66 p-5 shadow-[0_24px_90px_rgba(194,65,12,0.14)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/8 md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#ea580c]/65 dark:text-orange-100/65">
                Сегодня
              </p>
              <h1 className="mt-2 text-4xl font-black text-[#c2410c] dark:text-white md:text-5xl">
                Ежедневный центр пары
              </h1>
              <p className="mt-3 max-w-2xl font-semibold leading-7 text-[#7c2d12]/62 dark:text-white/55">
                Один экран показывает вопрос дня, непрочитанное, быстрый ответ и лучший следующий шаг.
              </p>
            </div>
            {state.couple && (
              <div className="rounded-2xl bg-white/62 px-4 py-3 text-sm font-black shadow-inner dark:bg-white/10">
                Ритуал в 10:00 · {state.timeZone}
              </div>
            )}
          </div>
        </div>

        {!state.userId ? (
          <div className="mt-5">
            <EmptyState
              icon="◌"
              title="Войдите, чтобы открыть день пары"
              text="После входа здесь появится вопрос дня, чат и лучший следующий шаг."
              actionHref="/login"
              actionLabel="Войти"
              accent="#ea580c"
            />
          </div>
        ) : !state.couple ? (
          <div className="mt-5">
            <EmptyState
              icon="♡"
              title="Создайте пару"
              text="Пригласите партнёра, чтобы открыть общий день, ответы и цели."
              actionHref="/profile"
              actionLabel="Создать пару"
              accent="#ea580c"
            />
          </div>
        ) : (
          <>
            <Link
              href={nextStep.href}
              className="mt-5 block rounded-[2rem] border border-orange-200/70 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-5 shadow-[0_24px_80px_rgba(234,88,12,0.14)] transition hover:-translate-y-0.5 dark:border-orange-200/10 dark:from-orange-500/16 dark:via-white/8 dark:to-amber-500/12 md:p-6"
            >
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-700/60 dark:text-orange-100/60">
                    {nextStep.label}
                  </p>
                  <h2 className="mt-2 text-3xl font-black text-orange-950 dark:text-white md:text-4xl">
                    {nextStep.title}
                  </h2>
                  <p className="mt-3 max-w-3xl font-semibold leading-7 text-orange-900/65 dark:text-white/58">
                    {nextStep.text}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/72 text-2xl shadow-inner dark:bg-white/10">
                    {nextStep.icon}
                  </span>
                  <span className="rounded-full bg-[#ea580c] px-5 py-3 font-black text-white shadow-lg">
                    {nextStep.button}
                  </span>
                </div>
              </div>
            </Link>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <section className="rounded-[2rem] border border-white/60 bg-white/66 p-5 shadow-inner backdrop-blur-2xl dark:border-white/10 dark:bg-white/8 md:p-6">
                <p className="text-sm font-black uppercase tracking-[0.18em] text-[#ea580c]/62 dark:text-orange-100/60">
                  Вопрос дня
                </p>
                <h2 className="mt-3 text-3xl font-black text-[#c2410c] dark:text-white">
                  {state.question}
                </h2>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {[
                    ["Вы", myAnswer ? "Ответ сохранён" : "Ждёт ответа", Boolean(myAnswer)],
                    [partnerName, partnerAnswer ? "Ответ готов" : "Пока ждём", Boolean(partnerAnswer)],
                    ["Дата", formatRuDate(state.questionDate), true],
                  ].map(([label, text, done]) => (
                    <div
                      key={String(label)}
                      className="rounded-2xl bg-orange-50/80 p-4 shadow-inner dark:bg-orange-500/10"
                    >
                      <p className="text-xs font-black uppercase tracking-[0.14em] opacity-55">
                        {label}
                      </p>
                      <p className="mt-2 font-black">
                        {done ? "✓ " : ""}
                        {text}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href={myAnswer ? "/questions/today" : "/questions/answer"}
                    className="rounded-full bg-[#ea580c] px-5 py-3 text-center font-black text-white shadow-lg"
                  >
                    {myAnswer ? "Открыть вопрос" : "Ответить"}
                  </Link>
                  {partnerAnswer && (
                    <Link
                      href="/questions/today"
                      className="rounded-full bg-white/78 px-5 py-3 text-center font-black text-orange-900 shadow-inner dark:bg-white/10 dark:text-white"
                    >
                      Посмотреть ответ партнёра
                    </Link>
                  )}
                </div>
              </section>

              <section className="rounded-[2rem] border border-white/60 bg-white/66 p-5 shadow-inner backdrop-blur-2xl dark:border-white/10 dark:bg-white/8 md:p-6">
                <p className="text-sm font-black uppercase tracking-[0.18em] text-[#ea580c]/62 dark:text-orange-100/60">
                  Последнее непрочитанное
                </p>
                {unreadItem ? (
                  <Link href={unreadItem.href} className="mt-4 block rounded-2xl bg-orange-50/80 p-4 shadow-inner transition hover:bg-orange-100 dark:bg-orange-500/10 dark:hover:bg-orange-500/18">
                    <div className="flex items-start gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/72 text-xl shadow-inner dark:bg-white/10">
                        {unreadItem.icon}
                      </span>
                      <div className="min-w-0">
                        <h2 className="text-xl font-black text-orange-950 dark:text-white">
                          {unreadItem.title}
                        </h2>
                        <p className="mt-2 line-clamp-3 font-semibold leading-6 text-orange-900/65 dark:text-white/58">
                          {unreadItem.text}
                        </p>
                        <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] opacity-55">
                          {formatRuTime(unreadItem.createdAt) || "только что"}
                        </p>
                      </div>
                    </div>
                  </Link>
                ) : (
                  <div className="mt-4 rounded-2xl bg-orange-50/80 p-4 font-semibold leading-7 text-orange-900/65 shadow-inner dark:bg-orange-500/10 dark:text-white/58">
                    Непрочитанного нет. Можно начать день с вопроса или короткого сообщения.
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 gap-2">
                  {ritualSteps.map((step, index) => (
                    <Link
                      key={step.label}
                      href={step.href}
                      className="rounded-2xl bg-white/62 p-3 font-black shadow-inner transition hover:bg-orange-50 dark:bg-white/8 dark:hover:bg-white/12"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{step.label}</span>
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-orange-100 text-sm text-orange-900 dark:bg-white/10 dark:text-white">
                          {step.done ? "✓" : index + 1}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <section id="quick-reply" className="rounded-[2rem] border border-white/60 bg-white/66 p-5 shadow-inner backdrop-blur-2xl dark:border-white/10 dark:bg-white/8 md:p-6">
                <p className="text-sm font-black uppercase tracking-[0.18em] text-[#ea580c]/62 dark:text-orange-100/60">
                  Быстрый ответ партнёру
                </p>
                <h2 className="mt-2 text-2xl font-black text-[#c2410c] dark:text-white">
                  Написать {partnerName}
                </h2>
                <p className="mt-2 font-semibold leading-7 text-orange-900/60 dark:text-white/55">
                  Последнее в чате: {getChatPreview(state.latestChat)}
                </p>
                <form onSubmit={sendQuickReply} className="mt-4 space-y-3">
                  <textarea
                    value={quickReply}
                    onChange={(event) => {
                      setQuickReply(event.target.value);
                      if (replyMessage) setReplyMessage("");
                    }}
                    disabled={!partnerId || isSendingReply}
                    placeholder={partnerId ? "Короткое сообщение партнёру..." : "Сначала пригласите партнёра"}
                    rows={3}
                    maxLength={1000}
                    className="w-full resize-none rounded-2xl border border-orange-200/70 bg-white/82 px-4 py-3 font-semibold text-orange-950 outline-none transition placeholder:text-orange-900/35 focus:border-orange-500 disabled:opacity-55 dark:border-white/10 dark:bg-black/20 dark:text-white"
                  />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <button
                      type="submit"
                      disabled={!quickReply.trim() || !partnerId || isSendingReply}
                      className="rounded-full bg-[#ea580c] px-5 py-3 font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      {isSendingReply ? "Отправляем..." : "Отправить"}
                    </button>
                    <Link
                      href="/chat"
                      className="rounded-full bg-white/78 px-5 py-3 text-center font-black text-orange-900 shadow-inner dark:bg-white/10 dark:text-white"
                    >
                      Открыть чат
                    </Link>
                  </div>
                </form>
                {replyMessage && (
                  <p className="mt-3 text-sm font-black text-orange-800/70 dark:text-orange-100/70">
                    {replyMessage}
                  </p>
                )}
              </section>

              <section className="rounded-[2rem] border border-white/60 bg-white/66 p-5 shadow-inner backdrop-blur-2xl dark:border-white/10 dark:bg-white/8 md:p-6">
                <p className="text-sm font-black uppercase tracking-[0.18em] text-[#ea580c]/62 dark:text-orange-100/60">
                  Ближайшее и вечер
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Link
                    href={state.nextEvent ? "/calendar" : "/questions/today"}
                    className="rounded-2xl bg-orange-50/80 p-4 shadow-inner transition hover:bg-orange-100 dark:bg-orange-500/10 dark:hover:bg-orange-500/18"
                  >
                    <p className="text-xs font-black uppercase tracking-[0.14em] opacity-55">
                      Ближайшее событие
                    </p>
                    <h2 className="mt-2 text-xl font-black">
                      {state.nextEvent?.title || "Сегодняшний ритуал"}
                    </h2>
                    <p className="mt-2 font-semibold leading-6 opacity-65">
                      {state.nextEvent
                        ? formatRuDate(state.nextEvent.event_date)
                        : "Если в календаре нет дат, главным событием остаётся вопрос дня."}
                    </p>
                  </Link>
                  <Link
                    href={state.watchRemaining ? "/watch?spin=1" : "/watch"}
                    className="rounded-2xl bg-orange-50/80 p-4 shadow-inner transition hover:bg-orange-100 dark:bg-orange-500/10 dark:hover:bg-orange-500/18"
                  >
                    <p className="text-xs font-black uppercase tracking-[0.14em] opacity-55">
                      Что посмотреть
                    </p>
                    <h2 className="mt-2 text-xl font-black">
                      {state.watchRemaining ? "Рулетка готова" : "Добавьте вариант"}
                    </h2>
                    <p className="mt-2 font-semibold leading-6 opacity-65">
                      {state.watchRemaining
                        ? `${state.watchRemaining} вариантов${
                            state.latestWatchItem
                              ? ` · последнее: ${state.latestWatchItem.title} (${getWatchTypeLabel(state.latestWatchItem.content_type)})`
                              : ""
                          }`
                        : "Список просмотра пока пуст."}
                    </p>
                  </Link>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <Link
                    href="/tracker"
                    className="rounded-2xl bg-white/62 p-4 shadow-inner transition hover:bg-orange-50 dark:bg-white/8 dark:hover:bg-white/12"
                  >
                    <p className="text-xs font-black uppercase tracking-[0.14em] opacity-55">
                      Цель
                    </p>
                    <h2 className="mt-2 text-lg font-black">
                      {state.goal ? state.goal.title : "Поставить первую цель"}
                    </h2>
                    <p className="mt-2 text-sm font-semibold leading-6 opacity-65">
                      {state.goal
                        ? `${state.goal.target_count} ${getGoalPeriodLabel(state.goal.period)}`
                        : "Выберите общий ритуал, который хочется поддерживать."}
                    </p>
                  </Link>
                  <Link
                    href={recommendedQuiz ? `/quizzes/play?quiz=${recommendedQuiz.id}` : "/quizzes"}
                    className="rounded-2xl bg-white/62 p-4 shadow-inner transition hover:bg-orange-50 dark:bg-white/8 dark:hover:bg-white/12"
                  >
                    <p className="text-xs font-black uppercase tracking-[0.14em] opacity-55">
                      Викторина
                    </p>
                    <h2 className="mt-2 text-lg font-black">
                      {recommendedQuiz?.title || "Викторина дня"}
                    </h2>
                    <p className="mt-2 line-clamp-2 text-sm font-semibold leading-6 opacity-65">
                      {recommendedQuiz?.description || "Пройдите короткий тест и сравните ответы."}
                    </p>
                  </Link>
                </div>
              </section>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
