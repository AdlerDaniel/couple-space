"use client";

import { getDailyQuestion, getDailyQuestionDate } from "@/lib/dailyQuestions";
import { quizzes } from "@/lib/quizzes";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Couple = {
  id: string;
  partner_one_id: string | null;
  partner_two_id: string | null;
};

type CoupleProfile = {
  partner_one: string;
  partner_two: string;
  start_date: string | null;
};

type MemoryPreview = {
  id: string;
  title: string | null;
  caption: string | null;
  image: string | null;
  event_date: string | null;
  created_at: string;
};

type ChatPreview = {
  id: string;
  body: string | null;
  sender_id: string;
  attachment_type: string | null;
  attachment_name: string | null;
  created_at: string;
};

type QuestionAnswer = {
  answer_one: string | null;
  answer_two: string | null;
};

type TrackerEvent = {
  id: string;
  count: number | null;
  duration_minutes: number | null;
  mood: string | null;
  date: string;
};

type HomeState = {
  isLoading: boolean;
  userId: string | null;
  couple: Couple | null;
  profile: CoupleProfile | null;
  memories: MemoryPreview[];
  chats: ChatPreview[];
  todayAnswer: QuestionAnswer | null;
  todayTrackerEvents: TrackerEvent[];
  stats: {
    memories: number;
    answers: number;
    quizzes: number;
    tracker: number;
    chat: number;
  };
};

const emptyState: HomeState = {
  isLoading: true,
  userId: null,
  couple: null,
  profile: null,
  memories: [],
  chats: [],
  todayAnswer: null,
  todayTrackerEvents: [],
  stats: {
    memories: 0,
    answers: 0,
    quizzes: 0,
    tracker: 0,
    chat: 0,
  },
};

const quickActions = [
  {
    title: "Ответить на вопрос дня",
    text: "Откройте сегодняшнюю карточку и сохраните ответ отдельно от партнёра.",
    href: "/questions/answer",
    icon: "✉",
    color: "from-emerald-500 to-teal-500",
  },
  {
    title: "Добавить воспоминание",
    text: "Фото, подпись, дата события, реакции и комментарии партнёра.",
    href: "/memories",
    icon: "▣",
    color: "from-blue-600 to-indigo-700",
  },
  {
    title: "Пройти викторину",
    text: "Выберите категорию, ответьте отдельно и сравните ответы.",
    href: "/quizzes",
    icon: "✦",
    color: "from-violet-600 to-fuchsia-600",
  },
  {
    title: "Написать в чат",
    text: "Сообщения, голосовые, фото, реакции, стикеры и закрепы.",
    href: "/chat",
    icon: "◌",
    color: "from-sky-500 to-blue-700",
  },
];

const trackerShortcuts = [
  { label: "Поели", icon: "🍽️", href: "/tracker" },
  { label: "Секс", icon: "❤️", href: "/tracker" },
  { label: "Спорт", icon: "🏃", href: "/tracker" },
  { label: "Игры", icon: "🎮", href: "/tracker" },
];

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value?: string | null) {
  if (!value) return "дата не указана";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getDaysTogether(startDate?: string | null) {
  if (!startDate) return null;
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return null;
  const diff = Date.now() - start.getTime();
  return Math.max(1, Math.floor(diff / 86400000) + 1);
}

function getMessagePreview(message: ChatPreview) {
  if (message.body) return message.body;
  if (message.attachment_type === "audio") return "Голосовое сообщение";
  if (message.attachment_name) return message.attachment_name;
  return "Вложение";
}

export default function Home() {
  const [state, setState] = useState<HomeState>(emptyState);
  const todayQuestion = getDailyQuestion();
  const todayQuestionDate = getDailyQuestionDate();
  const recommendedQuiz = quizzes[0];

  const coupleName = useMemo(() => {
    if (!state.profile) return "Ваша пара";
    return `${state.profile.partner_one || "Партнёр 1"} + ${state.profile.partner_two || "Партнёр 2"}`;
  }, [state.profile]);

  const daysTogether = getDaysTogether(state.profile?.start_date);
  const isPartnerOne = state.userId && state.couple?.partner_one_id === state.userId;
  const myAnswer = isPartnerOne ? state.todayAnswer?.answer_one : state.todayAnswer?.answer_two;
  const partnerAnswer = isPartnerOne ? state.todayAnswer?.answer_two : state.todayAnswer?.answer_one;
  const totalStats =
    state.stats.memories +
    state.stats.answers +
    state.stats.quizzes +
    state.stats.tracker +
    state.stats.chat;

  useEffect(() => {
    async function loadHome() {
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
        setState({ ...emptyState, isLoading: false, userId: user.id });
        return;
      }

      const todayKey = getTodayKey();
      const [
        profileResult,
        memoriesResult,
        memoryCountResult,
        answersCountResult,
        todayAnswerResult,
        quizCountResult,
        trackerCountResult,
        todayTrackerResult,
        chatCountResult,
        chatResult,
      ] = await Promise.all([
        supabase
          .from("couple_profiles")
          .select("partner_one, partner_two, start_date")
          .eq("couple_id", couple.id)
          .limit(1)
          .maybeSingle<CoupleProfile>(),
        supabase
          .from("memories")
          .select("id, title, caption, image, event_date, created_at")
          .eq("couple_id", couple.id)
          .order("created_at", { ascending: false })
          .limit(3),
        supabase
          .from("memories")
          .select("id", { count: "exact", head: true })
          .eq("couple_id", couple.id),
        supabase
          .from("question_answers")
          .select("id", { count: "exact", head: true })
          .eq("couple_id", couple.id),
        supabase
          .from("question_answers")
          .select("answer_one, answer_two")
          .eq("couple_id", couple.id)
          .eq("date", todayQuestionDate)
          .eq("question", todayQuestion)
          .limit(1)
          .maybeSingle<QuestionAnswer>(),
        supabase
          .from("quiz_answers")
          .select("quiz_id", { count: "exact", head: true })
          .eq("couple_id", couple.id),
        supabase
          .from("tracker_events")
          .select("id", { count: "exact", head: true })
          .eq("couple_id", couple.id),
        supabase
          .from("tracker_events")
          .select("id, count, duration_minutes, mood, date")
          .eq("couple_id", couple.id)
          .eq("date", todayKey)
          .limit(8),
        supabase
          .from("couple_chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("couple_id", couple.id),
        supabase
          .from("couple_chat_messages")
          .select("id, body, sender_id, attachment_type, attachment_name, created_at")
          .eq("couple_id", couple.id)
          .eq("deleted_for_everyone", false)
          .order("created_at", { ascending: false })
          .limit(3),
      ]);

      setState({
        isLoading: false,
        userId: user.id,
        couple,
        profile: profileResult.data || null,
        memories: (memoriesResult.data || []) as MemoryPreview[],
        chats: (chatResult.data || []) as ChatPreview[],
        todayAnswer: todayAnswerResult.data || null,
        todayTrackerEvents: (todayTrackerResult.data || []) as TrackerEvent[],
        stats: {
          memories: memoryCountResult.count || 0,
          answers: answersCountResult.count || 0,
          quizzes: quizCountResult.count || 0,
          tracker: trackerCountResult.count || 0,
          chat: chatCountResult.count || 0,
        },
      });
    }

    loadHome();
  }, [todayQuestion, todayQuestionDate]);

  return (
    <main className="home-main min-h-screen bg-[#fff8ed] px-4 pb-24 pt-3 text-[#7c2d12] transition-colors dark:bg-[#140b05] dark:text-[#ffedd5] md:px-6 md:pt-24">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_8%,rgba(249,115,22,0.22),transparent_28%),radial-gradient(circle_at_88%_14%,rgba(245,158,11,0.18),transparent_30%),radial-gradient(circle_at_50%_88%,rgba(234,88,12,0.12),transparent_34%),linear-gradient(135deg,#fff8ed_0%,#ffedd5_46%,#fff7ed_100%)] dark:bg-[radial-gradient(circle_at_14%_8%,rgba(249,115,22,0.18),transparent_28%),radial-gradient(circle_at_88%_14%,rgba(245,158,11,0.16),transparent_30%),linear-gradient(135deg,#140b05_0%,#271006_48%,#120a04_100%)]" />
      </div>

      <section className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-3 rounded-[1.35rem] border border-white/60 bg-white/66 p-4 shadow-[0_18px_58px_rgba(194,65,12,0.12)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/8 sm:flex-row sm:items-center sm:justify-between md:rounded-[1.8rem] md:p-5">
          <div className="min-w-0">
            <p className="truncate text-xl font-black leading-tight text-[#c2410c] dark:text-white md:text-2xl">
              {state.isLoading ? "Загрузка..." : state.couple ? coupleName : "Couple Space"}
            </p>
            <p className="mt-1 text-sm font-bold text-[#7c2d12]/58 dark:text-white/52">
              {daysTogether ? `${daysTogether} дней вместе` : state.couple ? "Дата начала пока не указана" : "Создайте пару в профиле"}
            </p>
          </div>
          <Link
            href={state.couple ? "/dashboard" : "/profile"}
            className="rounded-full bg-[#ea580c] px-4 py-2.5 text-center text-sm font-black text-white shadow-[0_14px_34px_rgba(234,88,12,0.24)] transition hover:-translate-y-0.5 hover:bg-[#f97316] sm:shrink-0"
          >
            {state.couple ? "Кабинет" : "Профиль"}
          </Link>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {[
            ["Дней", daysTogether ?? "—"],
            ["Воспоминаний", state.stats.memories],
            ["Ответов", state.stats.answers],
            ["Викторин", state.stats.quizzes],
            ["Активности", totalStats],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/55 bg-white/58 p-3 shadow-inner backdrop-blur-xl dark:border-white/10 dark:bg-white/8 md:p-4">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.08em] text-[#c2410c]/52 dark:text-white/45">{label}</p>
              <p className="mt-1 text-2xl font-black leading-none text-[#c2410c] dark:text-white md:text-3xl">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-3 grid max-w-7xl gap-3 md:mt-5 md:gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[1.35rem] border border-emerald-100/80 bg-white/64 p-4 shadow-[0_20px_64px_rgba(21,128,61,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-white/8 md:rounded-[2rem] md:p-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-600/70 dark:text-emerald-100/70">
                Вопрос дня
              </p>
              <h2 className="mt-2 !text-2xl font-black leading-tight text-emerald-800 dark:text-white md:mt-3 md:!text-5xl">
                {todayQuestion}
              </h2>
            </div>
            <Link
              href="/questions/answer"
              className="shrink-0 rounded-full bg-emerald-600 px-5 py-3 text-center font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-emerald-700"
            >
              Ответить
            </Link>
          </div>

          <div className="mt-4 grid gap-2 md:mt-6 md:grid-cols-2 md:gap-3">
            <div className="rounded-2xl bg-emerald-50 p-4 shadow-inner dark:bg-white/8">
              <p className="text-sm font-black text-emerald-700 dark:text-emerald-100">Ваш статус</p>
              <p className="mt-2 font-semibold text-emerald-950/70 dark:text-white/60">
                {myAnswer ? "Вы уже ответили сегодня." : "Ответ ещё не сохранён."}
              </p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-4 shadow-inner dark:bg-white/8">
              <p className="text-sm font-black text-emerald-700 dark:text-emerald-100">Партнёр</p>
              <p className="mt-2 font-semibold text-emerald-950/70 dark:text-white/60">
                {partnerAnswer ? "Ответ партнёра уже ждёт раскрытия." : "Партнёр ещё отвечает."}
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-[1.35rem] border border-blue-100/80 bg-white/64 p-4 shadow-[0_20px_64px_rgba(37,99,235,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-white/8 md:rounded-[2rem] md:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-600/70 dark:text-blue-100/70">
                Воспоминания
              </p>
              <h2 className="mt-2 !text-2xl font-black text-blue-900 dark:text-white md:!text-3xl">
                Последние моменты
              </h2>
            </div>
            <Link href="/memories" className="rounded-full bg-blue-600 px-4 py-2 text-sm font-black text-white">
              Открыть
            </Link>
          </div>

          <div className="mt-5 grid gap-3">
            {(state.memories.length ? state.memories : [null, null, null]).map((memory, index) => (
              <Link
                key={memory?.id || index}
                href="/memories"
                className="grid grid-cols-[4.5rem_1fr] gap-3 rounded-2xl bg-blue-50/80 p-2 shadow-inner transition hover:bg-blue-100 dark:bg-white/8 dark:hover:bg-blue-500/15"
              >
                <div
                  className="h-16 rounded-xl bg-cover bg-center bg-blue-200"
                  style={{
                    backgroundImage: memory?.image
                      ? `url("${memory.image}")`
                      : "linear-gradient(135deg,#bfdbfe,#dbeafe)",
                  }}
                />
                <div className="min-w-0 py-1">
                  <p className="truncate font-black text-blue-950 dark:text-white">
                    {memory?.title || "Добавьте новое воспоминание"}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm font-semibold text-blue-950/58 dark:text-white/50">
                    {memory?.caption || (memory ? formatDate(memory.event_date) : "Фото, описание и дата события появятся здесь.")}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </article>
      </section>

      <section className="mx-auto mt-3 grid max-w-7xl grid-cols-2 gap-3 md:mt-5 lg:grid-cols-4">
        {quickActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="group rounded-[1.25rem] border border-white/60 bg-white/62 p-4 shadow-[0_18px_54px_rgba(194,65,12,0.10)] backdrop-blur-xl transition hover:-translate-y-1 dark:border-white/10 dark:bg-white/8 md:rounded-[1.6rem] md:p-5"
          >
            <div className={`grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br ${action.color} text-xl text-white shadow-lg md:h-13 md:w-13 md:text-2xl`}>
              {action.icon}
            </div>
            <h3 className="mt-3 !text-base font-black leading-tight text-[#c2410c] dark:text-white md:mt-5 md:!text-xl">{action.title}</h3>
            <p className="mt-2 hidden text-sm font-semibold leading-6 text-[#7c2d12]/62 dark:text-white/54 sm:block">{action.text}</p>
            <p className="mt-4 text-sm font-black text-[#ea580c] transition group-hover:translate-x-1 dark:text-orange-100">
              Перейти →
            </p>
          </Link>
        ))}
      </section>

      <section className="mx-auto mt-3 grid max-w-7xl gap-3 md:mt-5 md:gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <article className="rounded-[1.35rem] border border-amber-100/80 bg-white/64 p-4 shadow-[0_20px_64px_rgba(217,119,6,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-white/8 md:rounded-[2rem] md:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-amber-600/70 dark:text-amber-100/70">
                Трекер пары
              </p>
              <h2 className="mt-2 !text-2xl font-black text-amber-900 dark:text-white md:!text-3xl">
                Сегодня
              </h2>
            </div>
            <Link href="/tracker" className="rounded-full bg-amber-600 px-4 py-2 text-sm font-black text-white">
              Отметить
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 md:mt-5 md:gap-3">
            {trackerShortcuts.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-2xl bg-amber-50 p-3 text-center shadow-inner transition hover:bg-amber-100 dark:bg-white/8 dark:hover:bg-amber-500/15 md:p-4"
              >
                <p className="text-2xl">{item.icon}</p>
                <p className="mt-2 font-black text-amber-900 dark:text-white">{item.label}</p>
              </Link>
            ))}
          </div>
          <p className="mt-4 rounded-2xl bg-white/64 p-3 text-sm font-semibold text-amber-950/62 shadow-inner dark:bg-white/8 dark:text-white/55 md:mt-5 md:p-4">
            Сегодня отмечено: {state.todayTrackerEvents.length || 0}. Полная история, графики и heatmap доступны в трекере.
          </p>
        </article>

        <div className="grid gap-3 md:grid-cols-2 md:gap-5">
          <article className="rounded-[1.35rem] border border-violet-100/80 bg-white/64 p-4 shadow-[0_20px_64px_rgba(124,58,237,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-white/8 md:rounded-[2rem] md:p-7">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-violet-600/70 dark:text-violet-100/70">
              Викторина
            </p>
            <h2 className="mt-2 !text-2xl font-black text-violet-900 dark:text-white md:mt-3 md:!text-3xl">
              {recommendedQuiz?.title || "Выберите тест"}
            </h2>
            <p className="mt-3 line-clamp-3 font-semibold leading-7 text-violet-950/62 dark:text-white/55">
              {recommendedQuiz?.description || "Категории и тесты ждут вас в разделе викторин."}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-black text-violet-700 dark:bg-white/10 dark:text-violet-100">
                {recommendedQuiz?.duration || "тесты"}
              </span>
              <span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-black text-violet-700 dark:bg-white/10 dark:text-violet-100">
                пройдено: {state.stats.quizzes}
              </span>
            </div>
            <Link
              href={recommendedQuiz ? `/quizzes/play?quiz=${recommendedQuiz.id}` : "/quizzes"}
              className="mt-6 inline-flex rounded-full bg-violet-600 px-5 py-3 font-black text-white shadow-lg transition hover:-translate-y-0.5"
            >
              Начать
            </Link>
          </article>

          <article className="rounded-[1.35rem] border border-sky-100/80 bg-white/64 p-4 shadow-[0_20px_64px_rgba(2,132,199,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-white/8 md:rounded-[2rem] md:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-sky-600/70 dark:text-sky-100/70">
                  Чат
                </p>
                <h2 className="mt-2 !text-2xl font-black text-sky-900 dark:text-white md:!text-3xl">
                  Последнее
                </h2>
              </div>
              <Link href="/chat" className="rounded-full bg-sky-600 px-4 py-2 text-sm font-black text-white">
                Открыть
              </Link>
            </div>
            <div className="mt-5 space-y-2">
              {(state.chats.length ? state.chats : [null, null, null]).map((message, index) => (
                <Link
                  key={message?.id || index}
                  href="/chat"
                  className="block rounded-2xl bg-sky-50 p-3 shadow-inner transition hover:bg-sky-100 dark:bg-white/8 dark:hover:bg-sky-500/15"
                >
                  <p className="line-clamp-1 font-black text-sky-950 dark:text-white">
                    {message ? getMessagePreview(message) : "Сообщений пока нет"}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-sky-950/50 dark:text-white/45">
                    {message ? formatTime(message.created_at) : "Начните диалог в чате"}
                  </p>
                </Link>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="mx-auto mt-3 max-w-7xl rounded-[1.35rem] border border-white/60 bg-white/62 p-4 shadow-[0_20px_64px_rgba(194,65,12,0.10)] backdrop-blur-xl dark:border-white/10 dark:bg-white/8 md:mt-5 md:rounded-[2rem] md:p-7">
        <div className="grid gap-3 md:grid-cols-3 md:gap-4">
          {[
            ["Кабинет", "Статус, достижения, активность и таймлайн.", "/dashboard", "❤️"],
            ["Профиль", "Имя, фото, пара и тёмная тема.", "/profile", "◉"],
            ["Архив вопросов", "Прошлые ответы, поиск и категории.", "/questions/archive", "⌕"],
          ].map(([title, text, href, icon]) => (
            <Link
              key={href}
              href={href}
              className="rounded-2xl bg-white/66 p-4 shadow-inner transition hover:bg-orange-50 dark:bg-white/8 dark:hover:bg-orange-500/15"
            >
              <p className="text-2xl">{icon}</p>
              <h3 className="mt-3 !text-lg font-black text-[#c2410c] dark:text-white md:!text-xl">{title}</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#7c2d12]/60 dark:text-white/52">{text}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
