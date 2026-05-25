"use client";

import { getDailyQuestion, getDailyQuestionDate } from "@/lib/dailyQuestions";
import { quizzes } from "@/lib/quizzes";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Couple = {
  id: string;
  invite_code?: string | null;
  partner_one_id: string | null;
  partner_two_id: string | null;
};

type CoupleProfile = {
  partner_one: string;
  partner_two: string;
  start_date: string | null;
  time_zone?: string | null;
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
  answer_one_reactions?: Record<string, string>;
  answer_two_reactions?: Record<string, string>;
  answer_one_likes?: Record<string, boolean>;
  answer_two_likes?: Record<string, boolean>;
  favorite_answers?: Record<string, string>;
};

type TrackerEvent = {
  id: string;
  count: number | null;
  duration_minutes: number | null;
  mood: string | null;
  date: string;
};

type TrackerGoal = {
  id: string;
  title: string;
  period: string;
  target_count: number;
  created_at: string;
};

type WatchPreview = {
  title: string;
  content_type: string;
  is_watched: boolean;
  updated_at: string;
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

type HomeState = {
  isLoading: boolean;
  userId: string | null;
  couple: Couple | null;
  profile: CoupleProfile | null;
  memories: MemoryPreview[];
  chats: ChatPreview[];
  todayAnswer: QuestionAnswer | null;
  todayTrackerEvents: TrackerEvent[];
  latestGoal: TrackerGoal | null;
  latestWatchItem: WatchPreview | null;
  latestUnreadNotification: CoupleNotification | null;
  loadedAt: number;
  stats: {
    memories: number;
    answers: number;
    quizzes: number;
    tracker: number;
    chat: number;
    watch: number;
    watchRemaining: number;
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
  latestGoal: null,
  latestWatchItem: null,
  latestUnreadNotification: null,
  loadedAt: 0,
  stats: {
    memories: 0,
    answers: 0,
    quizzes: 0,
    tracker: 0,
    chat: 0,
    watch: 0,
    watchRemaining: 0,
  },
};

const quickActions = [
  {
    title: "Ответить на вопрос дня",
    text: "Откройте сегодняшнюю карточку и сохраните ответ отдельно от партнёра.",
    href: "/questions/answer",
    icon: "✉",
    color: "from-orange-500 to-amber-500",
  },
  {
    title: "Добавить воспоминание",
    text: "Фото, подпись, дата события, реакции и комментарии партнёра.",
    href: "/memories",
    icon: "▣",
    color: "from-orange-500 to-amber-600",
  },
  {
    title: "Пройти викторину",
    text: "Выберите категорию, ответьте отдельно и сравните ответы.",
    href: "/quizzes",
    icon: "✦",
    color: "from-orange-500 to-amber-500",
  },
  {
    title: "Отметить цель",
    text: "Быстро внесите прогресс по привычке, свиданию или общей договорённости.",
    href: "/tracker",
    icon: "◫",
    color: "from-amber-500 to-orange-600",
  },
  {
    title: "Написать",
    text: "Сообщения, голосовые, фото, реакции, стикеры и закрепы.",
    href: "/chat",
    icon: "◌",
    color: "from-orange-500 to-amber-600",
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

function getGoalPeriodLabel(period: string) {
  if (period === "day") return "на день";
  if (period === "month") return "на месяц";
  if (period === "year") return "на год";
  return "на неделю";
}

function getWatchTypeLabel(type: string) {
  if (type === "series") return "Сериал";
  if (type === "cartoon") return "Мультфильм";
  if (type === "anime") return "Аниме";
  return "Фильм";
}

function getReadableName(value?: string | null, fallback = "Партнёр") {
  const name = value?.trim();
  if (!name) return fallback;
  if (/^\d{5,}$/.test(name)) return fallback;
  return name;
}

export default function Home() {
  const [state, setState] = useState<HomeState>(emptyState);
  const [dailyQuestionState, setDailyQuestionState] = useState(() => ({
    question: getDailyQuestion(),
    date: getDailyQuestionDate(),
  }));
  const todayQuestion = dailyQuestionState.question;
  const recommendedQuiz = quizzes[0];

  const coupleName = useMemo(() => {
    if (!state.profile) return "Ваша пара";
    return `${getReadableName(state.profile.partner_one, "Партнёр 1")} + ${getReadableName(state.profile.partner_two, "Партнёр 2")}`;
  }, [state.profile]);

  const daysTogether = getDaysTogether(state.profile?.start_date);
  const isPartnerOne = state.userId && state.couple?.partner_one_id === state.userId;
  const myAnswer = isPartnerOne ? state.todayAnswer?.answer_one : state.todayAnswer?.answer_two;
  const partnerAnswer = isPartnerOne ? state.todayAnswer?.answer_two : state.todayAnswer?.answer_one;
  const isWaitingForPartnerAnswer = Boolean(myAnswer && !partnerAnswer);
  const isPartnerAnswerReady = Boolean(partnerAnswer);
  const lastChat = state.chats[0];
  const partnerId = isPartnerOne ? state.couple?.partner_two_id : state.couple?.partner_one_id;
  const partnerReactionOnMyAnswer =
    partnerId && state.todayAnswer
      ? (isPartnerOne
          ? state.todayAnswer.answer_one_reactions?.[partnerId]
          : state.todayAnswer.answer_two_reactions?.[partnerId])
      : null;
  const chatIsQuiet =
    !lastChat || state.loadedAt - new Date(lastChat.created_at).getTime() > 1000 * 60 * 60 * 24;
  const totalStats =
    state.stats.memories +
    state.stats.answers +
    state.stats.quizzes +
    state.stats.tracker +
    state.stats.chat +
    state.stats.watch;
  const onboardingSteps = [
    {
      title: "Создайте пару",
      text: "Общее пространство и invite-код.",
      href: "/profile",
      done: Boolean(state.couple),
    },
    {
      title: "Пригласите партнёра",
      text: "Поделитесь кодом или ссылкой.",
      href: state.couple?.invite_code ? `/invite?code=${state.couple.invite_code}` : "/profile",
      done: Boolean(state.couple?.partner_two_id),
    },
    {
      title: "Ответьте на первый вопрос",
      text: "Откроет ежедневный ритуал.",
      href: "/questions/answer",
      done: state.stats.answers > 0,
    },
    {
      title: "Добавьте первое воспоминание",
      text: "Фото, дата и подпись.",
      href: "/memories",
      done: state.stats.memories > 0,
    },
  ];
  const hasOnboarding = state.userId && onboardingSteps.some((step) => !step.done);
  const primaryAction = (() => {
    if (!state.userId) {
      return {
        label: "Первый шаг",
        title: "Войдите, чтобы открыть пространство пары",
        text: "После входа здесь появится личный сценарий на сегодня.",
        href: "/login",
        button: "Войти",
        icon: "↗",
        tone: "orange",
      };
    }

    if (!state.couple) {
      return {
        label: "Первый шаг",
        title: "Создайте пару",
        text: "Заполните профиль и пригласите партнёра, чтобы открыть общий центр активности.",
        href: "/profile",
        button: "Создать пару",
        icon: "＋",
        tone: "orange",
      };
    }

    if (!state.couple.partner_two_id) {
      return {
        label: "Приглашение",
        title: "Пригласите партнёра",
        text: "Пространство станет живым, когда второй человек присоединится к паре.",
        href: "/profile",
        button: "Открыть профиль",
        icon: "↗",
        tone: "orange",
      };
    }

    if (!myAnswer && !partnerAnswer) {
      return {
        label: "Лучший следующий шаг",
        title: "Ответьте на первый вопрос дня",
        text: "Оба ещё не отвечали. Начните коротко, а партнёр увидит свой шаг следом.",
        href: "/questions/answer",
        button: "Ответить",
        icon: "✉",
        tone: "orange",
      };
    }

    if (myAnswer && !partnerAnswer) {
      return {
        label: "Статус дня",
        title: "Ждём ответ партнёра",
        text: "Ваш ответ сохранён. Можно перейти в чат и мягко напомнить.",
        href: "/chat",
        button: "Написать",
        icon: "⌛",
        tone: "orange",
      };
    }

    if (partnerAnswer) {
      return {
        label: partnerReactionOnMyAnswer ? "Новая реакция" : "Ответ готов",
        title: partnerReactionOnMyAnswer
          ? `Партнёр отреагировал ${partnerReactionOnMyAnswer}`
          : "Откройте ответ партнёра и оставьте реакцию",
        text: partnerReactionOnMyAnswer
          ? "Можно открыть карточку, посмотреть ответ и ответить своей реакцией."
          : "Ответ уже доступен. Самый тёплый следующий шаг - реакция или лайк.",
        href: "/questions/today",
        button: "Открыть ответ",
        icon: partnerReactionOnMyAnswer || "❤",
        tone: "orange",
      };
    }

    if (state.latestUnreadNotification) {
      return {
        label: "Новое событие",
        title: state.latestUnreadNotification.title,
        text:
          state.latestUnreadNotification.body ||
          "Откройте уведомление и продолжите действие партнёра.",
        href: state.latestUnreadNotification.href || "/notifications",
        button: "Открыть",
        icon: "●",
        tone: "orange",
      };
    }

    if (state.stats.watchRemaining > 0) {
      return {
        label: "Вечерний выбор",
        title: "Запустите рулетку просмотра",
        text: state.latestWatchItem
          ? `${state.stats.watchRemaining} вариантов ждут выбора. Последнее обновление: ${state.latestWatchItem.title}.`
          : `${state.stats.watchRemaining} вариантов ждут выбора на вечер.`,
        href: "/watch?spin=1",
        button: "Крутить",
        icon: "▥",
        tone: "orange",
      };
    }

    if (state.latestGoal) {
      return {
        label: "Цель пары",
        title: "Внесите прогресс по цели",
        text: `${state.latestGoal.title}: ${state.latestGoal.target_count} ${getGoalPeriodLabel(state.latestGoal.period)}.`,
        href: "/tracker",
        button: "Отметить",
        icon: "◫",
        tone: "amber",
      };
    }

    if (chatIsQuiet) {
      return {
        label: "Связь",
        title: "Напишите короткое сообщение",
        text: "В чате давно не было новых сообщений. Одной фразы достаточно, чтобы оживить день.",
        href: "/chat",
        button: "Открыть чат",
        icon: "◌",
        tone: "orange",
      };
    }

    return {
      label: "Рекомендуем сегодня",
      title: recommendedQuiz?.title || "Выберите короткую викторину",
      text: recommendedQuiz?.description || "Пройдите тест отдельно, а потом сравните результаты.",
      href: recommendedQuiz ? `/quizzes/play?quiz=${recommendedQuiz.id}` : "/quizzes",
      button: "Начать",
      icon: "✦",
      tone: "orange",
    };
  })();
  const primaryToneClass =
    primaryAction.tone === "amber"
      ? "from-amber-50 via-white to-orange-50 text-amber-900 dark:from-amber-500/16 dark:via-white/8 dark:to-orange-500/12"
      : "from-orange-50 via-white to-amber-50 text-orange-900 dark:from-orange-500/16 dark:via-white/8 dark:to-amber-500/12";

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
        .select("id, invite_code, partner_one_id, partner_two_id")
        .or(`partner_one_id.eq.${user.id},partner_two_id.eq.${user.id}`)
        .limit(1)
        .maybeSingle<Couple>();

      if (!couple) {
        setState({ ...emptyState, isLoading: false, userId: user.id });
        return;
      }

      const { data: profileData } = await supabase
        .from("couple_profiles")
        .select("partner_one, partner_two, start_date, time_zone")
        .eq("couple_id", couple.id)
        .limit(1)
        .maybeSingle<CoupleProfile>();

      const timeZone = profileData?.time_zone || "Europe/Moscow";
      const activeQuestion = getDailyQuestion(new Date(), timeZone);
      const activeQuestionDate = getDailyQuestionDate(new Date(), timeZone);
      setDailyQuestionState({ question: activeQuestion, date: activeQuestionDate });

      const todayKey = getTodayKey();
      const [
        memoriesResult,
        memoryCountResult,
        answersCountResult,
        todayAnswerResult,
        quizCountResult,
        trackerCountResult,
        todayTrackerResult,
        latestGoalResult,
        watchCountResult,
        watchRemainingResult,
        latestWatchResult,
        chatCountResult,
        chatResult,
        latestNotificationResult,
      ] = await Promise.all([
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
          .select(
            "answer_one, answer_two, answer_one_reactions, answer_two_reactions, answer_one_likes, answer_two_likes, favorite_answers",
          )
          .eq("couple_id", couple.id)
          .eq("date", activeQuestionDate)
          .eq("question", activeQuestion)
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
          .from("tracker_goals")
          .select("id, title, period, target_count, created_at")
          .eq("couple_id", couple.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle<TrackerGoal>(),
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
        supabase
          .from("couple_notifications")
          .select("id, type, title, body, href, read_at, created_at")
          .eq("recipient_id", user.id)
          .is("read_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle<CoupleNotification>(),
      ]);

      setState({
        isLoading: false,
        userId: user.id,
        couple,
        profile: profileData || null,
        memories: (memoriesResult.data || []) as MemoryPreview[],
        chats: (chatResult.data || []) as ChatPreview[],
        todayAnswer: todayAnswerResult.data || null,
        todayTrackerEvents: (todayTrackerResult.data || []) as TrackerEvent[],
        latestGoal: latestGoalResult.data || null,
        latestWatchItem: latestWatchResult.data || null,
        latestUnreadNotification: latestNotificationResult.data || null,
        loadedAt: Date.now(),
        stats: {
          memories: memoryCountResult.count || 0,
          answers: answersCountResult.count || 0,
          quizzes: quizCountResult.count || 0,
          tracker: trackerCountResult.count || 0,
          chat: chatCountResult.count || 0,
          watch: watchCountResult.count || 0,
          watchRemaining: watchRemainingResult.count || 0,
        },
      });
    }

    loadHome();
  }, []);

  return (
    <main className="home-main min-h-screen bg-[#fff8ed] px-4 pb-24 pt-3 text-[#7c2d12] transition-colors dark:bg-[#140b05] dark:text-[#ffedd5] md:px-6 md:pt-24">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_8%,rgba(249,115,22,0.22),transparent_28%),radial-gradient(circle_at_88%_14%,rgba(245,158,11,0.18),transparent_30%),radial-gradient(circle_at_50%_88%,rgba(234,88,12,0.12),transparent_34%),linear-gradient(135deg,#fff8ed_0%,#ffedd5_46%,#fff7ed_100%)] dark:bg-[radial-gradient(circle_at_14%_8%,rgba(249,115,22,0.18),transparent_28%),radial-gradient(circle_at_88%_14%,rgba(245,158,11,0.16),transparent_30%),linear-gradient(135deg,#140b05_0%,#271006_48%,#120a04_100%)]" />
      </div>

      <section className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-3 rounded-[1.35rem] border border-white/60 bg-white/66 p-4 shadow-[0_18px_58px_rgba(194,65,12,0.12)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/8 sm:flex-row sm:items-center sm:justify-between md:rounded-[1.8rem] md:p-5">
          <div className="min-w-0">
            <p className="truncate text-xl font-black leading-tight text-[#c2410c] dark:text-white md:text-2xl">
              {state.isLoading ? "Загружаем обзор пары..." : state.couple ? coupleName : "Couple Space"}
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

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Дней", daysTogether ?? "—"],
            ["Воспоминаний", state.stats.memories],
            ["Ответов", state.stats.answers],
            ["Викторин", state.stats.quizzes],
            ["К просмотру", state.stats.watchRemaining],
            ["Активности", totalStats],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/55 bg-white/58 p-3 shadow-inner backdrop-blur-xl dark:border-white/10 dark:bg-white/8 md:p-4">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.08em] text-[#c2410c]/52 dark:text-white/45">{label}</p>
              <p className="mt-1 text-2xl font-black leading-none text-[#c2410c] dark:text-white md:text-3xl">{value}</p>
            </div>
          ))}
        </div>

        {hasOnboarding && (
          <div className="mt-3 rounded-[1.35rem] border border-white/60 bg-white/62 p-4 shadow-[0_18px_58px_rgba(194,65,12,0.10)] backdrop-blur-xl dark:border-white/10 dark:bg-white/8 md:rounded-[1.8rem] md:p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ea580c]/58 dark:text-orange-100/55">
                  Первый запуск
                </p>
                <h2 className="mt-1 !text-xl font-black text-[#c2410c] dark:text-white">
                  Быстрый путь к живому пространству
                </h2>
              </div>
              <span className="text-sm font-black text-[#7c2d12]/58 dark:text-white/50">
                {onboardingSteps.filter((step) => step.done).length} из {onboardingSteps.length}
              </span>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-4">
              {onboardingSteps.map((step, index) => (
                <Link
                  key={step.title}
                  href={step.href}
                  className={`rounded-2xl p-3 shadow-inner transition hover:-translate-y-0.5 ${
                    step.done
                      ? "bg-orange-50 text-orange-900 dark:bg-orange-500/12 dark:text-orange-100"
                      : "bg-orange-50 text-orange-900 dark:bg-orange-500/12 dark:text-orange-100"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/72 text-sm font-black shadow-inner dark:bg-white/10">
                      {step.done ? "✓" : index + 1}
                    </span>
                    <p className="min-w-0 truncate font-black">{step.title}</p>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs font-semibold opacity-65">{step.text}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="mx-auto mt-3 max-w-7xl rounded-[1.35rem] border border-white/60 bg-white/66 p-4 shadow-[0_20px_64px_rgba(194,65,12,0.10)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/8 md:mt-5 md:rounded-[2rem] md:p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-[#ea580c]/65 dark:text-orange-100/65">
              Обзор пары
            </p>
            <h2 className="mt-1 !text-2xl font-black text-[#c2410c] dark:text-white md:!text-3xl">
              Главное состояние и свежие события
            </h2>
          </div>
          <Link
            href="/notifications"
            className="rounded-full bg-[#ea580c] px-4 py-2 text-center text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#f97316]"
          >
            Все события
          </Link>
        </div>

        <Link
          href={primaryAction.href}
          className={`mt-4 block rounded-[1.4rem] border border-white/70 bg-gradient-to-br p-5 shadow-[0_18px_58px_rgba(194,65,12,0.12)] transition hover:-translate-y-0.5 dark:border-white/10 md:rounded-[1.8rem] md:p-6 ${primaryToneClass}`}
        >
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.16em] opacity-55">
                {primaryAction.label}
              </p>
              <h3 className="mt-2 !text-2xl font-black leading-tight md:!text-4xl">
                {primaryAction.title}
              </h3>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 opacity-68 md:text-base">
                {primaryAction.text}
              </p>
            </div>
            <div className="flex items-center gap-3 md:shrink-0">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/72 text-2xl shadow-inner dark:bg-white/10">
                {primaryAction.icon}
              </span>
              <span className="rounded-full bg-[#ea580c] px-5 py-3 text-sm font-black text-white shadow-lg">
                {primaryAction.button}
              </span>
            </div>
          </div>
        </Link>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {[
            state.latestUnreadNotification
              ? {
                  label: "Новое",
                  title: state.latestUnreadNotification.title,
                  text: state.latestUnreadNotification.body || "Есть новое событие пары.",
                  href: state.latestUnreadNotification.href || "/notifications",
                  icon: "●",
                  className: "bg-orange-50/90 text-orange-800 dark:bg-orange-500/12 dark:text-orange-100",
                }
              : null,
            state.latestWatchItem
              ? {
                  label: "Что посмотрим",
                  title: state.latestWatchItem.title,
                  text: `${getWatchTypeLabel(state.latestWatchItem.content_type)} · ${
                    state.latestWatchItem.is_watched ? "уже посмотрели" : "ждёт вечера"
                  }`,
                  href: "/watch",
                  icon: "▥",
                  className: "bg-orange-50/90 text-orange-800 dark:bg-orange-500/12 dark:text-orange-100",
                }
              : null,
            lastChat
              ? {
                  label: "Чат",
                  title: getMessagePreview(lastChat),
                  text: formatTime(lastChat.created_at),
                  href: "/chat",
                  icon: "◌",
                  className: "bg-orange-50/90 text-orange-800 dark:bg-orange-500/12 dark:text-orange-100",
                }
              : null,
          ]
            .filter(Boolean)
            .map((item) => (
              <Link
                key={item!.label}
                href={item!.href}
                className={`rounded-2xl p-4 shadow-inner transition hover:-translate-y-0.5 ${item!.className}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.12em] opacity-60">
                      {item!.label}
                    </p>
                    <h3 className="mt-2 line-clamp-1 !text-lg font-black">{item!.title}</h3>
                  </div>
                  <span className="text-2xl">{item!.icon}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm font-semibold opacity-70">{item!.text}</p>
              </Link>
            ))}
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {[
            {
              label: "Вопрос дня",
              title: myAnswer
                ? isPartnerAnswerReady
                  ? "Ответ партнёра открыт"
                  : "Ждём ответ партнёра"
                : "Ответьте на вопрос",
              text: myAnswer
                ? isPartnerAnswerReady
                  ? "Можно прочитать и оставить реакцию."
                  : "Ваш ответ сохранён, партнёр ещё думает."
                : "Начните с короткого ответа на сегодняшний вопрос.",
              href: myAnswer ? "/questions/today" : "/questions/answer",
              icon: isWaitingForPartnerAnswer ? "⌛" : "✉",
              accentClass: "text-orange-800 dark:text-orange-100",
              bgClass: "bg-orange-50/90 dark:bg-orange-500/12",
            },
            {
              label: "Цель пары",
              title: state.latestGoal ? state.latestGoal.title : "Поставьте новую цель",
              text: state.latestGoal
                ? `${state.latestGoal.target_count} ${getGoalPeriodLabel(state.latestGoal.period)}`
                : "Например: тренировки, свидания или вечер без телефона.",
              href: "/tracker",
              icon: "◫",
              accentClass: "text-orange-800 dark:text-orange-100",
              bgClass: "bg-orange-50/90 dark:bg-orange-500/12",
            },
            {
              label: "Последнее сообщение",
              title: lastChat ? getMessagePreview(lastChat) : "Напишите в чат",
              text: lastChat ? formatTime(lastChat.created_at) : "Оставьте короткое сообщение партнёру.",
              href: "/chat",
              icon: "◌",
              accentClass: "text-orange-800 dark:text-orange-100",
              bgClass: "bg-orange-50/90 dark:bg-orange-500/12",
            },
            {
              label: "Что посмотрим",
              title: state.stats.watchRemaining
                ? `${state.stats.watchRemaining} вариантов`
                : "Добавьте варианты",
              text: state.stats.watchRemaining
                ? "Запустите рулетку и выберите вечерний просмотр."
                : "Соберите общий список фильмов и сериалов.",
              href: state.stats.watchRemaining ? "/watch?spin=1" : "/watch",
              icon: "▥",
              accentClass: "text-orange-800 dark:text-orange-100",
              bgClass: "bg-orange-50/90 dark:bg-orange-500/12",
            },
            {
              label: "Викторина",
              title: recommendedQuiz?.title || "Выберите тест",
              text: state.stats.quizzes > 0
                ? `Уже есть ${state.stats.quizzes} ответов`
                : "Пройдите один короткий тест отдельно.",
              href: recommendedQuiz ? `/quizzes/play?quiz=${recommendedQuiz.id}` : "/quizzes",
              icon: "✦",
              accentClass: "text-orange-800 dark:text-orange-100",
              bgClass: "bg-orange-50/90 dark:bg-orange-500/12",
            },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`rounded-2xl p-4 shadow-inner transition hover:-translate-y-0.5 ${item.bgClass}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-xs font-black uppercase tracking-[0.12em] opacity-60 ${item.accentClass}`}>
                    {item.label}
                  </p>
                  <h3 className={`mt-2 line-clamp-2 !text-lg font-black ${item.accentClass}`}>
                    {item.title}
                  </h3>
                </div>
                <span className={`text-2xl ${item.accentClass}`}>{item.icon}</span>
              </div>
              <p className={`mt-3 line-clamp-2 text-sm font-semibold opacity-68 ${item.accentClass}`}>
                {item.text}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-3 grid max-w-7xl gap-3 md:mt-5 md:gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[1.35rem] border border-orange-100/80 bg-white/64 p-4 shadow-[0_20px_64px_rgba(234,88,12,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-white/8 md:rounded-[2rem] md:p-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600/70 dark:text-orange-100/70">
                Вопрос дня
              </p>
              <h2 className="mt-2 !text-2xl font-black leading-tight text-orange-900 dark:text-white md:mt-3 md:!text-5xl">
                {todayQuestion}
              </h2>
            </div>
            <Link
              href="/questions/answer"
              className="shrink-0 rounded-full bg-[#ea580c] px-5 py-3 text-center font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#f97316]"
            >
              Ответить
            </Link>
          </div>

          <div className="mt-4 grid gap-2 md:mt-6 md:grid-cols-2 md:gap-3">
            <div className="rounded-2xl bg-orange-50 p-4 shadow-inner dark:bg-white/8">
              <p className="text-sm font-black text-orange-700 dark:text-orange-100">Ваш статус</p>
              <p className="mt-2 font-semibold text-orange-950/70 dark:text-white/60">
                {myAnswer ? "Вы уже ответили сегодня." : "Ответ ещё не сохранён."}
              </p>
            </div>
            <div className="rounded-2xl bg-orange-50 p-4 shadow-inner dark:bg-white/8">
              <p className="text-sm font-black text-orange-700 dark:text-orange-100">Партнёр</p>
              <p className="mt-2 font-semibold text-orange-950/70 dark:text-white/60">
                {partnerAnswer ? "Ответ партнёра уже ждёт раскрытия." : "Партнёр ещё отвечает."}
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-[1.35rem] border border-orange-100/80 bg-white/64 p-4 shadow-[0_20px_64px_rgba(234,88,12,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-white/8 md:rounded-[2rem] md:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600/70 dark:text-orange-100/70">
                Воспоминания
              </p>
              <h2 className="mt-2 !text-2xl font-black text-orange-900 dark:text-white md:!text-3xl">
                Последние моменты
              </h2>
            </div>
            <Link href="/memories" className="rounded-full bg-[#ea580c] px-4 py-2 text-sm font-black text-white">
              Открыть
            </Link>
          </div>

          <div className="mt-5 grid gap-3">
            {state.memories.length === 0 ? (
              <Link
                href="/memories"
                className="rounded-2xl bg-orange-50/80 p-5 text-center shadow-inner transition hover:bg-orange-100 dark:bg-white/8 dark:hover:bg-orange-500/15"
              >
                <p className="text-3xl">▣</p>
                <p className="mt-2 font-black text-orange-950 dark:text-white">
                  Добавьте первое воспоминание
                </p>
                <p className="mt-1 text-sm font-semibold text-orange-950/58 dark:text-white/50">
                  Фото, дата и короткая подпись сделают главную живее.
                </p>
              </Link>
            ) : (
              state.memories.map((memory) => (
                <Link
                  key={memory.id}
                  href="/memories"
                  className="grid grid-cols-[4.5rem_1fr] gap-3 rounded-2xl bg-orange-50/80 p-2 shadow-inner transition hover:bg-orange-100 dark:bg-white/8 dark:hover:bg-orange-500/15"
                >
                  <div
                    className="h-16 rounded-xl bg-cover bg-center bg-orange-200"
                    style={{
                      backgroundImage: memory.image
                        ? `url("${memory.image}")`
                        : "linear-gradient(135deg,#fed7aa,#ffedd5)",
                    }}
                  />
                  <div className="min-w-0 py-1">
                    <p className="truncate font-black text-orange-950 dark:text-white">
                      {memory.title || "Воспоминание"}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm font-semibold text-orange-950/58 dark:text-white/50">
                      {memory.caption || formatDate(memory.event_date)}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="mx-auto mt-3 grid max-w-7xl grid-cols-2 gap-3 md:mt-5 lg:grid-cols-5">
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
            {state.latestGoal
              ? `Сегодня отмечено: ${state.todayTrackerEvents.length || 0}. Полная история, графики и heatmap доступны в трекере.`
              : "Поставьте первую цель: свидания, спорт, вечер без телефона или любой общий ритуал."}
          </p>
        </article>

        <div className="grid gap-3 md:grid-cols-2 md:gap-5">
          <article className="rounded-[1.35rem] border border-orange-100/80 bg-white/64 p-4 shadow-[0_20px_64px_rgba(234,88,12,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-white/8 md:rounded-[2rem] md:p-7">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600/70 dark:text-orange-100/70">
              Викторина
            </p>
            <h2 className="mt-2 !text-2xl font-black text-orange-900 dark:text-white md:mt-3 md:!text-3xl">
              {recommendedQuiz?.title || "Выберите тест"}
            </h2>
            <p className="mt-3 line-clamp-3 font-semibold leading-7 text-orange-950/62 dark:text-white/55">
              {recommendedQuiz?.description || "Категории и тесты ждут вас в разделе викторин."}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-black text-orange-700 dark:bg-white/10 dark:text-orange-100">
                {recommendedQuiz?.duration || "тесты"}
              </span>
              <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-black text-orange-700 dark:bg-white/10 dark:text-orange-100">
                пройдено: {state.stats.quizzes}
              </span>
            </div>
            <Link
              href={recommendedQuiz ? `/quizzes/play?quiz=${recommendedQuiz.id}` : "/quizzes"}
              className="mt-6 inline-flex rounded-full bg-[#ea580c] px-5 py-3 font-black text-white shadow-lg transition hover:-translate-y-0.5"
            >
              Начать
            </Link>
          </article>

          <article className="rounded-[1.35rem] border border-orange-100/80 bg-white/64 p-4 shadow-[0_20px_64px_rgba(234,88,12,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-white/8 md:rounded-[2rem] md:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600/70 dark:text-orange-100/70">
                  Чат
                </p>
                <h2 className="mt-2 !text-2xl font-black text-orange-900 dark:text-white md:!text-3xl">
                  Последнее
                </h2>
              </div>
              <Link href="/chat" className="rounded-full bg-[#ea580c] px-4 py-2 text-sm font-black text-white">
                Открыть
              </Link>
            </div>
            <div className="mt-5 space-y-2">
              {state.chats.length === 0 ? (
                <Link
                  href="/chat"
                  className="block rounded-2xl bg-orange-50 p-4 text-center shadow-inner transition hover:bg-orange-100 dark:bg-white/8 dark:hover:bg-orange-500/15"
                >
                  <p className="font-black text-orange-950 dark:text-white">
                    Напишите первое сообщение
                  </p>
                  <p className="mt-2 text-sm font-semibold text-orange-950/50 dark:text-white/45">
                    “Как прошёл день?”, “Что сделаем вечером?” или просто тёплая фраза.
                  </p>
                </Link>
              ) : (
                state.chats.map((message) => (
                  <Link
                    key={message.id}
                    href="/chat"
                    className="block rounded-2xl bg-orange-50 p-3 shadow-inner transition hover:bg-orange-100 dark:bg-white/8 dark:hover:bg-orange-500/15"
                  >
                    <p className="line-clamp-1 font-black text-orange-950 dark:text-white">
                      {getMessagePreview(message)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-orange-950/50 dark:text-white/45">
                      {formatTime(message.created_at)}
                    </p>
                  </Link>
                ))
              )}
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
