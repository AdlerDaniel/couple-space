"use client";

import { supabase } from "@/lib/supabaseClient";
import { createOwnNotification, createPartnerNotification } from "@/lib/notifications";
import { compressImageFile } from "@/lib/imageCompression";
import {
  dashboardAccentEventName,
  dashboardAccentStorageKey,
  dashboardThemeAccents,
} from "@/lib/dashboardTheme";
import NextImage from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Cropper from "react-easy-crop";

type CoupleProfile = {
  partner_one: string;
  partner_two: string;
  start_date: string;
  id: string;
  avatar?: string | null;
  avatar_one?: string | null;
  avatar_two?: string | null;
  status_one_text?: string | null;
  status_one_emoji?: string | null;
  status_two_text?: string | null;
  status_two_emoji?: string | null;
  status_updates_one?: number | null;
  status_updates_two?: number | null;
};

type Couple = {
  id: string;
  partner_one_id: string;
  partner_two_id: string | null;
};

type CropPixels = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type DashboardStats = {
  memories: number;
  questionAnswers: number;
  quizzes: number;
  streak: number;
  statusUpdates: number;
};

type ActivityItem = {
  id: string;
  text: string;
  time: string;
  createdAt: string;
  icon: string;
};

type Achievement = {
  id: string;
  title: string;
  name: string;
  description: string;
  category: string;
  level: number;
  target: number;
  special?: boolean;
  icon: string;
  value: number;
  gradient: string;
  border: string;
  unlocked: boolean;
};

type TimelineItem = {
  id: string;
  year: number | string;
  icon: string;
  title: string;
  text: string;
  dateLabel: string;
  status: "done" | "next";
  category: string;
  gradient: string;
};

const theme = {
  page: "from-[#ffe7ef] via-[#fff1f4] to-[#fff7f8]",
  text: "text-[#dc2626]",
  muted: "text-[#dc2626]/70",
  panel: "from-[#ffd6e3] to-[#ffe3ec]",
  soft: "bg-white/35",
  button: "bg-[#dc2626]",
  buttonHover: "hover:bg-[#ff5a6b]",
  darkPage: "dark:from-[#2a080c] dark:via-[#21070b] dark:to-[#140704]",
  darkPanel: "dark:from-[#3a1017] dark:to-[#24070c]",
};

const statusEmojis = ["❤️", "🥰", "😊", "✨", "🌙", "💌", "🌸", "😴"];

function localKey(coupleId: string, key: string) {
  return `couple-space:dashboard:${coupleId}:${key}`;
}

function initials(name?: string | null) {
  return (name || "?").trim().slice(0, 1).toUpperCase();
}

function formatDate(date: string) {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "недавно";
  }

  return parsedDate.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getActivityTime(date?: string | null) {
  return date || new Date(0).toISOString();
}

function shouldUseNotificationForActivity(type: string) {
  return [
    "status_updated",
    "memory_deleted",
    "memory_reaction",
    "question_voice",
    "question_photo",
    "achievement_unlocked",
  ].includes(type);
}

function addDays(date: string, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function calculateStreak(dates: string[]) {
  const uniqueDates = [...new Set(dates)].sort((a, b) => b.localeCompare(a));
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  let streak = 0;

  for (const date of uniqueDates) {
    const current = new Date(date);
    current.setHours(0, 0, 0, 0);

    if (current.getTime() === cursor.getTime()) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else if (streak === 0) {
      cursor.setDate(cursor.getDate() - 1);
      if (current.getTime() === cursor.getTime()) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      }
    } else {
      break;
    }
  }

  return streak;
}

function getStatus(profile: CoupleProfile, slot: "one" | "two") {
  const text =
    slot === "one" ? profile.status_one_text || "" : profile.status_two_text || "";
  const emoji =
    slot === "one" ? profile.status_one_emoji || "❤️" : profile.status_two_emoji || "❤️";

  return { text, emoji };
}

function AvatarBubble({
  name,
  image,
  status,
  size = "large",
}: {
  name?: string | null;
  image?: string | null;
  status?: { text: string; emoji: string };
  size?: "large" | "small";
}) {
  const sizeClass = size === "large" ? "h-24 w-24 text-4xl" : "h-14 w-14 text-xl";

  return (
    <div className="relative">
      {image ? (
        <NextImage
          src={image}
          alt={name || "Аватар"}
          width={size === "large" ? 96 : 56}
          height={size === "large" ? 96 : 56}
          sizes={size === "large" ? "96px" : "56px"}
          className={`${sizeClass} rounded-full object-cover shadow-xl ring-4 ring-white/60`}
        />
      ) : (
        <div
          className={`${sizeClass} flex items-center justify-center rounded-full bg-white/55 font-bold shadow-xl ring-4 ring-white/50 backdrop-blur dark:bg-white/10`}
        >
          {initials(name)}
        </div>
      )}

      {status?.text && (
        <>
          <div className="absolute -top-3 left-1/2 grid h-8 w-8 -translate-x-1/2 place-items-center rounded-full bg-white/90 text-base shadow-xl ring-2 ring-white/75 backdrop-blur dark:bg-black/55 dark:ring-white/10">
            {status.emoji}
          </div>
          <div className="absolute -bottom-5 left-1/2 w-max max-w-[142px] -translate-x-1/2 rounded-2xl bg-white/88 px-2.5 py-1.5 text-center text-xs font-black leading-tight text-[#dc2626] shadow-xl ring-1 ring-white/70 backdrop-blur dark:bg-black/50 dark:text-white dark:ring-white/10">
            <span className="line-clamp-2 whitespace-normal break-words">
              {status.text}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function CroppedPreview({
  imageSrc,
  croppedArea,
  size = 100,
}: {
  imageSrc: string;
  croppedArea: CropPixels;
  size?: number;
}) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;

    img.onload = () => {
      ctx.drawImage(
        img,
        croppedArea.x,
        croppedArea.y,
        croppedArea.width,
        croppedArea.height,
        0,
        0,
        size,
        size
      );

      setPreview(canvas.toDataURL("image/webp"));
    };
  }, [imageSrc, croppedArea, size]);

  if (!preview) {
    return <div className="h-24 w-24 rounded-full bg-gray-300 dark:bg-gray-700" />;
  }

  return (
    <NextImage
      src={preview}
      alt="Preview"
      width={96}
      height={96}
      unoptimized
      className="h-24 w-24 rounded-full object-cover shadow-lg"
    />
  );
}

function buildAchievements(stats: DashboardStats, daysTogether: number) {
  const totalActivity =
    stats.memories + stats.questionAnswers + stats.quizzes + stats.statusUpdates;
  const storyPower = stats.memories + stats.questionAnswers;
  const explorerPower = stats.quizzes + stats.questionAnswers;
  const cozyPower = stats.memories + stats.statusUpdates;

  const groups = [
    {
      prefix: "Дней вместе",
      category: "days",
      icon: "❤️",
      gradient: "from-rose-100/90 via-white/70 to-red-100/80 dark:from-rose-950/70 dark:via-red-950/30 dark:to-black/20",
      border: "border-rose-300/80 dark:border-rose-300/25",
      thresholds: [1, 10, 50, 100, 200, 300, 365],
      names: [
        "Первый совместный блин",
        "Уже не случайность",
        "Полтинник обнимашек",
        "Серьезная заявка",
        "Двести дней без возврата",
        "Почти семейный режим",
        "Годовой абонемент на любовь",
      ],
      value: daysTogether,
    },
    {
      prefix: "Обновление статуса",
      category: "status",
      icon: "💬",
      gradient: "from-fuchsia-100/90 via-white/70 to-pink-100/80 dark:from-fuchsia-950/70 dark:via-pink-950/30 dark:to-black/20",
      border: "border-fuchsia-300/80 dark:border-fuchsia-300/25",
      thresholds: [1, 3, 5, 10, 50, 100],
      names: [
        "Статус поставлен, паника снята",
        "Мини-блогер любви",
        "Пять оттенков настроения",
        "Статусный магнат",
        "Редактор сердечных новостей",
        "Главный по табличке настроения",
      ],
      value: stats.statusUpdates,
    },
    {
      prefix: "Добавление воспоминаний",
      category: "memories",
      icon: "📸",
      gradient: "from-amber-100/90 via-white/70 to-orange-100/80 dark:from-amber-950/70 dark:via-orange-950/30 dark:to-black/20",
      border: "border-amber-300/80 dark:border-amber-300/25",
      thresholds: [1, 3, 5, 10, 50, 100, 200, 500],
      names: [
        "Первый кадр не комом",
        "Фотоальбом проснулся",
        "Папка милоты создана",
        "Память телефона в опасности",
        "Архивариус романтики",
        "Хранитель пиксельных легенд",
        "Музей нас двоих",
        "Сервер просит отпуск",
      ],
      value: stats.memories,
    },
    {
      prefix: "Ответов на ежедневный вопрос",
      category: "questions",
      icon: "💌",
      gradient: "from-sky-100/90 via-white/70 to-cyan-100/80 dark:from-sky-950/70 dark:via-cyan-950/30 dark:to-black/20",
      border: "border-sky-300/80 dark:border-sky-300/25",
      thresholds: [1, 3, 5, 10, 20, 50, 67, 100],
      names: [
        "Первый честный вброс",
        "Три вопроса без адвоката",
        "Диалоговый двигатель завелся",
        "Десять маленьких признаний",
        "Глубокий режим включен",
        "Почти подкаст про любовь",
        "Секретный уровень болтливости",
        "Сто ответов и ни одного скучного",
      ],
      value: stats.questionAnswers,
    },
    {
      prefix: "Пройденных викторин",
      category: "quizzes",
      icon: "✦",
      gradient: "from-violet-100/90 via-white/70 to-purple-100/80 dark:from-violet-950/70 dark:via-purple-950/30 dark:to-black/20",
      border: "border-violet-300/80 dark:border-violet-300/25",
      thresholds: [1, 3, 5, 10, 20, 50, 100],
      names: [
        "Первый тестовый поцелуй",
        "Три раунда любопытства",
        "Пара против вопросов",
        "Квизовый ниндзя отношений",
        "Экзамен по вам двоим",
        "Профессор совпадений",
        "Легенда тестовой комнаты",
      ],
      value: stats.quizzes,
    },
    {
      prefix: "Серия ответов",
      category: "streak",
      icon: "🔥",
      gradient: "from-red-100/90 via-white/70 to-rose-100/80 dark:from-red-950/70 dark:via-rose-950/30 dark:to-black/20",
      border: "border-red-300/80 dark:border-red-300/25",
      thresholds: [1, 3, 7, 14, 30, 60],
      names: [
        "Спичка романтики",
        "Три дня без пропуска",
        "Неделя сердечного режима",
        "Две недели без побега",
        "Месяц дисциплины купидона",
        "Легендарный ответственный дуэт",
      ],
      value: stats.streak,
    },
    {
      prefix: "Общая активность",
      category: "activity",
      icon: "⚡",
      gradient: "from-yellow-100/90 via-white/70 to-lime-100/80 dark:from-yellow-950/70 dark:via-lime-950/30 dark:to-black/20",
      border: "border-yellow-300/80 dark:border-yellow-300/25",
      thresholds: [5, 10, 25, 50, 100, 250],
      names: [
        "Первые признаки жизни",
        "Пара нажала газ",
        "Моторчик отношений",
        "Гиперактивные сердечки",
        "Фабрика маленьких моментов",
        "Производственный цех любви",
      ],
      value: totalActivity,
    },
    {
      prefix: "История пары",
      category: "story",
      icon: "📖",
      gradient: "from-teal-100/90 via-white/70 to-emerald-100/80 dark:from-teal-950/70 dark:via-emerald-950/30 dark:to-black/20",
      border: "border-teal-300/80 dark:border-teal-300/25",
      thresholds: [5, 15, 30, 60, 120, 240],
      names: [
        "Черновик вашей легенды",
        "Сюжет начинает шевелиться",
        "Глава с милыми уликами",
        "Роман на мягкой обложке",
        "Сага домашнего масштаба",
        "Полное собрание сердечных дел",
      ],
      value: storyPower,
    },
    {
      prefix: "Любопытство пары",
      category: "curiosity",
      icon: "🔎",
      gradient: "from-indigo-100/90 via-white/70 to-blue-100/80 dark:from-indigo-950/70 dark:via-blue-950/30 dark:to-black/20",
      border: "border-indigo-300/80 dark:border-indigo-300/25",
      thresholds: [5, 12, 25, 50, 90, 150],
      names: [
        "Нос сунут аккуратно",
        "Детективы на свидании",
        "Следствие ведут сердечки",
        "Эксперты по странным вопросам",
        "Археологи внутренних приколов",
        "Доктора наук по друг другу",
      ],
      value: explorerPower,
    },
    {
      prefix: "Домашняя магия",
      category: "cozy",
      icon: "🏡",
      gradient: "from-pink-100/90 via-white/70 to-orange-100/80 dark:from-pink-950/70 dark:via-orange-950/30 dark:to-black/20",
      border: "border-pink-300/80 dark:border-pink-300/25",
      thresholds: [5, 12, 30, 60, 120, 220],
      names: [
        "Плед официально принят",
        "Чайник знает ваши имена",
        "Уют вышел из чата",
        "Квартира подозревает романтику",
        "Домашний культ милоты",
        "Мини-вселенная для двоих",
      ],
      value: cozyPower,
    },
  ];

  const specialAchievements: Achievement[] = [
    {
      id: "special-first-week-photo",
      title: "Особое: 7 дней вместе и первое воспоминание",
      name: "Неделя с фото-доказательством",
      description: "Открывается, когда вы вместе минимум 7 дней и уже добавили первое воспоминание.",
      category: "special",
      level: 1,
      target: 1,
      special: true,
      icon: "🧾",
      value: daysTogether >= 7 && stats.memories >= 1 ? 1 : 0,
      gradient: "from-rose-100/90 via-white/70 to-amber-100/80 dark:from-rose-950/70 dark:via-amber-950/30 dark:to-black/20",
      border: "border-rose-300/80 dark:border-rose-300/25",
      unlocked: daysTogether >= 7 && stats.memories >= 1,
    },
    {
      id: "special-memory-boss",
      title: "Особое: воспоминаний больше, чем ответов",
      name: "Фотоаппарат победил клавиатуру",
      description: "Открывается, когда воспоминаний стало не меньше 10 и их больше, чем ответов на вопросы.",
      category: "special",
      level: 1,
      target: 1,
      special: true,
      icon: "📷",
      value: stats.memories >= 10 && stats.memories > stats.questionAnswers ? 1 : 0,
      gradient: "from-orange-100/90 via-white/70 to-yellow-100/80 dark:from-orange-950/70 dark:via-yellow-950/30 dark:to-black/20",
      border: "border-orange-300/80 dark:border-orange-300/25",
      unlocked: stats.memories >= 10 && stats.memories > stats.questionAnswers,
    },
    {
      id: "special-deep-and-playful",
      title: "Особое: 20 ответов и 5 викторин",
      name: "Глубоко, но с шутками",
      description: "Открывается, когда у пары есть минимум 20 ответов на вопросы и 5 пройденных викторин.",
      category: "special",
      level: 1,
      target: 1,
      special: true,
      icon: "🎭",
      value: stats.questionAnswers >= 20 && stats.quizzes >= 5 ? 1 : 0,
      gradient: "from-violet-100/90 via-white/70 to-sky-100/80 dark:from-violet-950/70 dark:via-sky-950/30 dark:to-black/20",
      border: "border-violet-300/80 dark:border-violet-300/25",
      unlocked: stats.questionAnswers >= 20 && stats.quizzes >= 5,
    },
    {
      id: "special-streak-status",
      title: "Особое: серия 7 дней и 3 статуса",
      name: "Настроение под контролем",
      description: "Открывается за неделю ответов подряд и минимум 3 обновления статуса.",
      category: "special",
      level: 1,
      target: 1,
      special: true,
      icon: "🧠",
      value: stats.streak >= 7 && stats.statusUpdates >= 3 ? 1 : 0,
      gradient: "from-fuchsia-100/90 via-white/70 to-red-100/80 dark:from-fuchsia-950/70 dark:via-red-950/30 dark:to-black/20",
      border: "border-fuchsia-300/80 dark:border-fuchsia-300/25",
      unlocked: stats.streak >= 7 && stats.statusUpdates >= 3,
    },
    {
      id: "special-century-active",
      title: "Особое: 100 дней и 50 действий",
      name: "Сотый день не зря прожит",
      description: "Открывается, когда вы вместе минимум 100 дней и набрали 50 общих действий.",
      category: "special",
      level: 1,
      target: 1,
      special: true,
      icon: "🎉",
      value: daysTogether >= 100 && totalActivity >= 50 ? 1 : 0,
      gradient: "from-pink-100/90 via-white/70 to-red-100/80 dark:from-pink-950/70 dark:via-red-950/30 dark:to-black/20",
      border: "border-pink-300/80 dark:border-pink-300/25",
      unlocked: daysTogether >= 100 && totalActivity >= 50,
    },
    {
      id: "special-all-rounders",
      title: "Особое: по 5 воспоминаний, ответов и викторин",
      name: "Тройной удар милоты",
      description: "Открывается, когда есть минимум 5 воспоминаний, 5 ответов и 5 викторин.",
      category: "special",
      level: 1,
      target: 1,
      special: true,
      icon: "🎯",
      value: stats.memories >= 5 && stats.questionAnswers >= 5 && stats.quizzes >= 5 ? 1 : 0,
      gradient: "from-emerald-100/90 via-white/70 to-cyan-100/80 dark:from-emerald-950/70 dark:via-cyan-950/30 dark:to-black/20",
      border: "border-emerald-300/80 dark:border-emerald-300/25",
      unlocked: stats.memories >= 5 && stats.questionAnswers >= 5 && stats.quizzes >= 5,
    },
    {
      id: "special-status-memory",
      title: "Особое: 10 статусов и 10 воспоминаний",
      name: "Хроника настроений",
      description: "Открывается за 10 обновлений статуса и 10 добавленных воспоминаний.",
      category: "special",
      level: 1,
      target: 1,
      special: true,
      icon: "📝",
      value: stats.statusUpdates >= 10 && stats.memories >= 10 ? 1 : 0,
      gradient: "from-amber-100/90 via-white/70 to-fuchsia-100/80 dark:from-amber-950/70 dark:via-fuchsia-950/30 dark:to-black/20",
      border: "border-amber-300/80 dark:border-amber-300/25",
      unlocked: stats.statusUpdates >= 10 && stats.memories >= 10,
    },
    {
      id: "special-month-streak",
      title: "Особое: 30 дней вместе и серия 3 дня",
      name: "Маленькая привычка большого чувства",
      description: "Открывается, когда вы вместе минимум 30 дней и держите серию ответов 3 дня.",
      category: "special",
      level: 1,
      target: 1,
      special: true,
      icon: "🌙",
      value: daysTogether >= 30 && stats.streak >= 3 ? 1 : 0,
      gradient: "from-indigo-100/90 via-white/70 to-purple-100/80 dark:from-indigo-950/70 dark:via-purple-950/30 dark:to-black/20",
      border: "border-indigo-300/80 dark:border-indigo-300/25",
      unlocked: daysTogether >= 30 && stats.streak >= 3,
    },
    {
      id: "special-quiz-machine",
      title: "Особое: 100 действий и 10 викторин",
      name: "Тестовый аппарат любви",
      description: "Открывается, когда пара набрала 100 общих действий и прошла 10 викторин.",
      category: "special",
      level: 1,
      target: 1,
      special: true,
      icon: "🕹",
      value: totalActivity >= 100 && stats.quizzes >= 10 ? 1 : 0,
      gradient: "from-blue-100/90 via-white/70 to-violet-100/80 dark:from-blue-950/70 dark:via-violet-950/30 dark:to-black/20",
      border: "border-blue-300/80 dark:border-blue-300/25",
      unlocked: totalActivity >= 100 && stats.quizzes >= 10,
    },
    {
      id: "special-anniversary-library",
      title: "Особое: год вместе и 100 пунктов истории",
      name: "Архив первой годовщины",
      description: "Открывается, когда вы вместе минимум год, а воспоминаний и ответов суммарно не меньше 100.",
      category: "special",
      level: 1,
      target: 1,
      special: true,
      icon: "💎",
      value: daysTogether >= 365 && storyPower >= 100 ? 1 : 0,
      gradient: "from-cyan-100/90 via-white/70 to-rose-100/80 dark:from-cyan-950/70 dark:via-rose-950/30 dark:to-black/20",
      border: "border-cyan-300/80 dark:border-cyan-300/25",
      unlocked: daysTogether >= 365 && storyPower >= 100,
    },
  ];

  return [
    ...groups.flatMap((group) =>
      group.thresholds.map<Achievement>((target, index) => ({
      id: `${group.prefix}-${target}`,
      title: `${group.prefix}: ${target}`,
      name: group.names[index] || `${group.prefix}: ${target}`,
      description: `Открывается, когда показатель "${group.prefix.toLowerCase()}" достигает ${target}.`,
      category: group.category,
      level: index + 1,
      target,
      icon: group.icon,
      value: group.value,
      gradient: group.gradient,
      border: group.border,
      unlocked: group.value >= target,
      }))
    ),
    ...specialAchievements,
  ];
}

function buildTimeline({
  startDate,
  currentYear,
  daysTogether,
  stats,
}: {
  startDate: string;
  currentYear: number;
  daysTogether: number;
  stats: DashboardStats;
}) {
  const items: TimelineItem[] = [
    {
      id: "start",
      year: startDate ? new Date(startDate).getFullYear() : currentYear,
      icon: "❤️",
      title: "Начали встречаться",
      text: "Первый день вашей общей истории.",
      dateLabel: startDate ? formatDate(startDate) : "Дата пока не выбрана",
      status: startDate ? "done" : "next",
      category: "Главное",
      gradient: "from-rose-100/90 to-red-100/70 dark:from-rose-950/70 dark:to-black/20",
    },
  ];

  const dayMilestones = [10, 50, 100, 200, 300, 365];
  dayMilestones.forEach((days) => {
    const done = daysTogether >= days;
    const date = startDate ? addDays(startDate, days - 1) : null;
    items.push({
      id: `days-${days}`,
      year: date ? date.getFullYear() : currentYear,
      icon: days === 365 ? "💍" : "🗓",
      title: `${days} дней вместе`,
      text: done
        ? `Вы уже прошли отметку в ${days} дней.`
        : `До этой отметки осталось ${Math.max(days - daysTogether, 0)} дней.`,
      dateLabel: date ? formatDate(date.toISOString()) : "Будущая дата",
      status: done ? "done" : "next",
      category: "Дни вместе",
      gradient: "from-pink-100/90 to-rose-100/70 dark:from-pink-950/70 dark:to-black/20",
    });
  });

  [
    {
      id: "memories",
      icon: "📸",
      title: "Воспоминания",
      value: stats.memories,
      milestones: [1, 3, 5, 10, 50, 100, 200, 500],
      category: "Воспоминания",
      gradient: "from-amber-100/90 to-orange-100/70 dark:from-amber-950/70 dark:to-black/20",
    },
    {
      id: "questions",
      icon: "💌",
      title: "Ответы на вопросы",
      value: stats.questionAnswers,
      milestones: [1, 3, 5, 10, 20, 50, 67, 100],
      category: "Вопросы",
      gradient: "from-sky-100/90 to-cyan-100/70 dark:from-sky-950/70 dark:to-black/20",
    },
    {
      id: "quizzes",
      icon: "✦",
      title: "Викторины",
      value: stats.quizzes,
      milestones: [1, 3, 5, 10, 20, 50, 100],
      category: "Викторины",
      gradient: "from-violet-100/90 to-purple-100/70 dark:from-violet-950/70 dark:to-black/20",
    },
  ].forEach((group) => {
    const reached = group.milestones.filter((level) => group.value >= level);
    const next = group.milestones.find((level) => group.value < level);

    reached.slice(-2).forEach((level) => {
      items.push({
        id: `${group.id}-${level}`,
        year: currentYear,
        icon: group.icon,
        title: `${group.title}: ${level}`,
        text: `Цель достигнута. Сейчас: ${group.value}.`,
        dateLabel: "уже открыто",
        status: "done",
        category: group.category,
        gradient: group.gradient,
      });
    });

    if (next) {
      items.push({
        id: `${group.id}-next-${next}`,
        year: currentYear,
        icon: group.icon,
        title: `${group.title}: ${next}`,
        text: `Следующая цель. Осталось ${next - group.value}.`,
        dateLabel: "следующая цель",
        status: "next",
        category: group.category,
        gradient: group.gradient,
      });
    }
  });

  return items.sort((a, b) => {
    if (a.status !== b.status) return a.status === "done" ? -1 : 1;
    return String(a.year).localeCompare(String(b.year), "ru");
  });
}

export default function DashboardPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<CoupleProfile | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [startDate, setStartDate] = useState("");
  const [daysTogether, setDaysTogether] = useState(0);
  const [isDashboardLoaded, setIsDashboardLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [avatarMessage, setAvatarMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [avatarOneUrl, setAvatarOneUrl] = useState<string | null>(null);
  const [avatarTwoUrl, setAvatarTwoUrl] = useState<string | null>(null);
  const [croppingImage, setCroppingImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] =
    useState<CropPixels | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    memories: 0,
    questionAnswers: 0,
    quizzes: 0,
    streak: 0,
    statusUpdates: 0,
  });
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [statusText, setStatusText] = useState("");
  const [statusEmoji, setStatusEmoji] = useState("❤️");
  const [recentAchievementIds, setRecentAchievementIds] = useState<string[]>([]);
  const [achievementDates, setAchievementDates] = useState<Record<string, string>>({});
  const [achievementToast, setAchievementToast] = useState<Achievement | null>(null);
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [isAchievementsOpen, setIsAchievementsOpen] = useState(false);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [achievementView, setAchievementView] = useState<"unlocked" | "locked">(
    "unlocked"
  );
  const [currentYear] = useState(() => new Date().getFullYear());

  useEffect(() => {
    const accent = dashboardThemeAccents.rose;
    localStorage.setItem(dashboardAccentStorageKey, accent);
    window.dispatchEvent(
      new CustomEvent(dashboardAccentEventName, {
        detail: accent,
      })
    );
  }, []);

  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setIsDashboardLoaded(false);
      setCurrentUserId(user.id);

      const { data: coupleData, error: coupleError } = await supabase
        .from("couples")
        .select("id, partner_one_id, partner_two_id")
        .or(`partner_one_id.eq.${user.id},partner_two_id.eq.${user.id}`)
        .limit(1)
        .single();

      if (coupleError || !coupleData) {
        router.push("/profile");
        return;
      }

      setCouple(coupleData);

      const { data: profileData, error: profileError } = await supabase
        .from("couple_profiles")
        .select("id, partner_one, partner_two, start_date, avatar, avatar_one, avatar_two, status_one_text, status_one_emoji, status_two_text, status_two_emoji, status_updates_one, status_updates_two")
        .eq("couple_id", coupleData.id)
        .limit(1)
        .single();

      let activeProfile = profileData as CoupleProfile | null;

      if (profileError || !profileData) {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const response = await fetch("/api/couple/profile", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : {}),
          },
          body: JSON.stringify({ coupleId: coupleData.id }),
        });

        const result = (await response.json()) as {
          profile?: CoupleProfile;
          error?: string;
        };

        if (!response.ok || !result.profile) {
          console.error(result.error || "Профиль ещё не создан");
          return;
        }

        activeProfile = result.profile;
      }

      if (!activeProfile) return;

      setProfile(activeProfile);
      setStartDate(activeProfile.start_date);
      setAvatarOneUrl(activeProfile.avatar_one || null);
      setAvatarTwoUrl(activeProfile.avatar_two || null);

      const userIsPartnerOne = user.id === coupleData.partner_one_id;
      const myStatus = getStatus(activeProfile, userIsPartnerOne ? "one" : "two");
      setStatusText(myStatus.text);
      setStatusEmoji(myStatus.emoji);

      const diff = Math.floor(
        (new Date().getTime() - new Date(activeProfile.start_date).getTime()) /
          (1000 * 60 * 60 * 24)
      );

      setDaysTogether(diff);

      const [
        { data: memoriesData },
        { data: commentRows },
        { data: answerRows },
        { data: quizRows },
        { data: notificationRows },
      ] = await Promise.all([
          supabase
            .from("memories")
            .select("id, title, text, caption, created_at, user_id")
            .eq("couple_id", coupleData.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("memory_comments")
            .select("id, memory_id, user_id, text, created_at")
            .eq("couple_id", coupleData.id)
            .order("created_at", { ascending: false })
            .limit(12),
          supabase
            .from("question_answers")
            .select("id, date, answer_one, answer_two, answer_one_edited_at, answer_two_edited_at")
            .eq("couple_id", coupleData.id)
            .order("date", { ascending: false }),
          supabase
            .from("quiz_answers")
            .select("quiz_id, user_id, updated_at")
            .eq("couple_id", coupleData.id)
            .order("updated_at", { ascending: false }),
          supabase
            .from("couple_notifications")
            .select("id, type, title, body, actor_id, created_at")
            .eq("recipient_id", user.id)
            .order("created_at", { ascending: false })
            .limit(20),
        ]);

      const totalQuestionAnswers =
        answerRows?.reduce((sum, row) => {
          return sum + (row.answer_one ? 1 : 0) + (row.answer_two ? 1 : 0);
        }, 0) || 0;

      setStats({
        memories: memoriesData?.length || 0,
        questionAnswers: totalQuestionAnswers,
        quizzes: quizRows?.length || 0,
        streak: calculateStreak(answerRows?.map((row) => row.date) || []),
        statusUpdates:
          (activeProfile.status_updates_one || 0) +
          (activeProfile.status_updates_two || 0),
      });

      const recentActivity: ActivityItem[] = [];
      const getAuthorName = (authorId?: string | null) => {
        if (!authorId) return "Партнёр";
        if (authorId === user.id) return "Вы";
        return authorId === coupleData.partner_one_id
          ? activeProfile?.partner_one || "Партнёр"
          : activeProfile?.partner_two || "Партнёр";
      };

      memoriesData?.slice(0, 8).forEach((memory) => {
        recentActivity.push({
          id: `memory-${memory.id}`,
          text: `${getAuthorName(memory.user_id)} добавил(а) воспоминание`,
          time: formatDate(memory.created_at),
          createdAt: getActivityTime(memory.created_at),
          icon: "📸",
        });
      });

      commentRows?.slice(0, 8).forEach((comment) => {
        recentActivity.push({
          id: `memory-comment-${comment.id}`,
          text: `${getAuthorName(comment.user_id)} оставил(а) комментарий к воспоминанию`,
          time: formatDate(comment.created_at),
          createdAt: getActivityTime(comment.created_at),
          icon: "💬",
        });
      });

      answerRows?.slice(0, 10).forEach((answer) => {
        [
          {
            userId: coupleData.partner_one_id,
            value: answer.answer_one,
            editedAt: answer.answer_one_edited_at,
            slot: "one",
          },
          {
            userId: coupleData.partner_two_id,
            value: answer.answer_two,
            editedAt: answer.answer_two_edited_at,
            slot: "two",
          },
        ].forEach((event) => {
          if (!event.value) return;
          const createdAt = getActivityTime(event.editedAt || answer.date);
          recentActivity.push({
            id: `question-${answer.id}-${event.slot}`,
            text: `${getAuthorName(event.userId)} ответил(а) на вопрос дня`,
            time: formatDate(createdAt),
            createdAt,
            icon: "💌",
          });
        });
      });

      quizRows?.slice(0, 10).forEach((quiz) => {
        const createdAt = getActivityTime(quiz.updated_at);
        recentActivity.push({
          id: `quiz-${quiz.quiz_id}-${quiz.user_id}`,
          text: `${getAuthorName(quiz.user_id)} прошёл(а) викторину`,
          time: formatDate(createdAt),
          createdAt,
          icon: "✨",
        });
      });

      notificationRows
        ?.filter((notification) => shouldUseNotificationForActivity(notification.type))
        .forEach((notification) => {
          recentActivity.push({
            id: `notification-${notification.id}`,
            text: `${getAuthorName(notification.actor_id)}: ${notification.body || notification.title}`,
            time: formatDate(notification.created_at),
            createdAt: getActivityTime(notification.created_at),
            icon: notification.type === "achievement_unlocked" ? "🏆" : "✦",
          });
        });

      setActivity(
        recentActivity
          .sort(
            (first, second) =>
              new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()
          )
          .slice(0, 12)
      );
      setIsDashboardLoaded(true);
    }

    loadData();
  }, [router]);

  const coupleName = `${profile?.partner_one || "Вы"} + ${
    profile?.partner_two || "Партнёр"
  }`;

  const isPartnerOne = currentUserId === couple?.partner_one_id;
  const myAvatarUrl = isPartnerOne ? avatarOneUrl : avatarTwoUrl;
  const leftHeroUrl = avatarOneUrl || null;
  const rightHeroUrl = avatarTwoUrl || null;
  const hasHeroCollage = Boolean(leftHeroUrl && rightHeroUrl);
  const achievements = useMemo(
    () => buildAchievements(stats, daysTogether),
    [daysTogether, stats]
  );
  const unlockedAchievements = achievements.filter((item) => item.unlocked).length;
  const achievementProgress =
    achievements.length > 0
      ? Math.round((unlockedAchievements / achievements.length) * 100)
      : 0;
  const unlockedAchievementList = achievements.filter((item) => item.unlocked);
  const lockedAchievementList = achievements.filter((item) => !item.unlocked);

  useEffect(() => {
    if (!isDashboardLoaded || !couple || !currentUserId || achievements.length === 0) {
      return;
    }

    const unlockedIds = achievements
      .filter((achievement) => achievement.unlocked)
      .map((achievement) => achievement.id);
    const unlockedKey = localKey(couple.id, "achievements-unlocked");
    const datesKey = localKey(couple.id, "achievements-dates");
    const notifiedKey = localKey(couple.id, `achievements-notified-${currentUserId}`);
    const previousRaw = localStorage.getItem(unlockedKey);
    const previousIds = previousRaw ? (JSON.parse(previousRaw) as string[]) : [];
    const notifiedRaw = localStorage.getItem(notifiedKey);
    const notifiedIds = notifiedRaw ? (JSON.parse(notifiedRaw) as string[]) : [];
    const newIds = unlockedIds.filter((id) => !previousIds.includes(id));
    const notificationIds = previousRaw
      ? unlockedIds.filter((id) => !notifiedIds.includes(id))
      : [];
    const savedDates = JSON.parse(localStorage.getItem(datesKey) || "{}") as Record<
      string,
      string
    >;
    const today = new Date().toISOString();

    newIds.forEach((id) => {
      savedDates[id] = today;
    });

    localStorage.setItem(unlockedKey, JSON.stringify(unlockedIds));
    localStorage.setItem(
      notifiedKey,
      JSON.stringify([...new Set([...notifiedIds, ...notificationIds])])
    );
    localStorage.setItem(datesKey, JSON.stringify(savedDates));
    const stateTimer = window.setTimeout(() => {
      setAchievementDates(savedDates);
      setRecentAchievementIds(newIds);

      if (notificationIds.length > 0) {
        const unlockedNotifications = notificationIds
          .map((id) => achievements.find((achievement) => achievement.id === id))
          .filter(Boolean) as Achievement[];
        const newestAchievement = achievements.find(
          (achievement) => achievement.id === notificationIds[0]
        );

        void Promise.all(
          unlockedNotifications.map((achievement) =>
            createOwnNotification(couple.id, currentUserId, {
              type: "achievement_unlocked",
              title: "Достижение открыто",
              body: `${achievement.name} · ${achievement.title}`,
              href: "/dashboard",
            })
          )
        );

        if (newestAchievement) {
          setAchievementToast(newestAchievement);
          window.setTimeout(() => setAchievementToast(null), 3600);
        }
      }
    }, 0);

    return () => window.clearTimeout(stateTimer);
  }, [achievements, couple, currentUserId, isDashboardLoaded]);

  const timeline = useMemo(
    () =>
      buildTimeline({
        startDate,
        currentYear,
        daysTogether,
        stats,
      }),
    [currentYear, daysTogether, startDate, stats]
  );
  const completedTimeline = timeline.filter((item) => item.status === "done");
  const upcomingTimeline = timeline.filter((item) => item.status === "next");
  const timelineProgress =
    timeline.length > 0
      ? Math.round((completedTimeline.length / timeline.length) * 100)
      : 0;

  async function saveStartDate() {
    if (!profile) return;

    setIsSaving(true);

    const { error, data } = await supabase
      .from("couple_profiles")
      .update({ start_date: startDate })
      .eq("id", profile.id)
      .select()
      .single();

    if (error) {
      console.error(error);
      setSaveMessage("Ошибка при сохранении");
    } else if (data) {
      setProfile(data);

      const diff = Math.floor(
        (new Date().getTime() - new Date(data.start_date).getTime()) /
          (1000 * 60 * 60 * 24)
      );

      setDaysTogether(diff);
      setSaveMessage("Дата обновлена ❤️");
    }

    setIsSaving(false);
    setTimeout(() => setSaveMessage(""), 2500);
  }

  async function saveStatus() {
    if (!profile || !couple || !currentUserId) return;

    const text = statusText.trim().slice(0, 20);
    const isFirstPartner = currentUserId === couple.partner_one_id;
    const updatePayload = isFirstPartner
      ? {
          status_one_text: text,
          status_one_emoji: statusEmoji,
          status_updates_one: (profile.status_updates_one || 0) + 1,
        }
      : {
          status_two_text: text,
          status_two_emoji: statusEmoji,
          status_updates_two: (profile.status_updates_two || 0) + 1,
        };

    const { data, error } = await supabase
      .from("couple_profiles")
      .update(updatePayload)
      .eq("id", profile.id)
      .select()
      .single();

    if (error) {
      console.error(error);
      setStatusMessage("Не удалось сохранить статус");
    } else if (data) {
      const nextProfile = data as CoupleProfile;
      setProfile(nextProfile);
      setStatusText(text);
      setStats((current) => ({
        ...current,
        statusUpdates:
          (nextProfile.status_updates_one || 0) +
          (nextProfile.status_updates_two || 0),
      }));
      setStatusMessage("Статус обновлён");
      await createPartnerNotification(couple, currentUserId, {
        type: "status_updated",
        title: "Новый статус",
        body: text ? `${statusEmoji} ${text}` : "Партнёр обновил статус.",
        href: "/dashboard",
      });
    }

    setTimeout(() => setStatusMessage(""), 2500);
  }

  function createImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = url;
      img.onload = () => resolve(img);
      img.onerror = reject;
    });
  }

  async function getCroppedImg(
    imageSrc: string,
    pixelCrop: CropPixels
  ): Promise<File> {
    const image = await createImage(imageSrc);

    const canvas = document.createElement("canvas");
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas не поддерживается");
    }

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Не удалось создать изображение"));
            return;
          }

          resolve(
            new File([blob], `${crypto.randomUUID()}.webp`, {
              type: "image/webp",
            })
          );
        },
        "image/webp",
        0.9
      );
    });
  }

  async function saveCroppedAvatar() {
    if (!croppingImage || !croppedAreaPixels || !profile || !currentUserId || !couple) {
      return;
    }

    try {
      const croppedFile = await getCroppedImg(croppingImage, croppedAreaPixels);
      const compressedAvatar = await compressImageFile(croppedFile, {
        maxWidth: 900,
        maxHeight: 900,
        quality: 0.82,
      });
      const filePath = `${currentUserId}/${crypto.randomUUID()}.webp`;
      const avatarField =
        currentUserId === couple.partner_one_id ? "avatar_one" : "avatar_two";

      const { error: uploadError } = await supabase.storage
        .from("profile-avatars")
        .upload(filePath, compressedAvatar);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("profile-avatars")
        .getPublicUrl(filePath);

      const { error } = await supabase
        .from("couple_profiles")
        .update({ [avatarField]: publicUrlData.publicUrl })
        .eq("id", profile.id);

      if (error) throw error;

      if (avatarField === "avatar_one") {
        setAvatarOneUrl(publicUrlData.publicUrl);
      } else {
        setAvatarTwoUrl(publicUrlData.publicUrl);
      }
      setProfile({
        ...profile,
        [avatarField]: publicUrlData.publicUrl,
      });
      setCroppingImage(null);
      setAvatarMessage("Фото сохранено ❤️");
      setTimeout(() => setAvatarMessage(""), 2500);
    } catch (err) {
      console.error(err);
      setAvatarMessage("Ошибка при сохранении фото");
      setTimeout(() => setAvatarMessage(""), 2500);
    }
  }

  if (!profile || !couple) {
    return (
      <main
        className={`flex min-h-screen items-center justify-center bg-gradient-to-b ${theme.page} ${theme.darkPage} transition-colors`}
      >
        <div
          className={`rounded-3xl bg-gradient-to-b ${theme.panel} ${theme.darkPanel} p-8 text-center shadow-2xl`}
        >
          <p className={`text-lg font-semibold ${theme.text} dark:text-white`}>
            Загружаем кабинет пары...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      className={`min-h-screen bg-gradient-to-b ${theme.page} ${theme.darkPage} px-4 pb-28 pt-20 ${theme.text} transition-colors dark:text-white md:px-6 md:pt-28`}
    >
      <div className="mx-auto max-w-6xl space-y-5 md:space-y-8">
        <section
          className={`relative min-h-[300px] overflow-hidden rounded-[1.5rem] bg-gradient-to-b ${theme.panel} ${theme.darkPanel} p-5 shadow-2xl md:min-h-[360px] md:rounded-3xl md:p-8`}
        >
          {hasHeroCollage && (
            <div className="absolute inset-0 opacity-40">
              <div className="grid h-full w-full grid-cols-2">
                {leftHeroUrl && (
                  <NextImage
                    src={leftHeroUrl}
                    alt="Фото первого участника"
                    width={720}
                    height={360}
                    sizes="(min-width: 1024px) 560px, 50vw"
                    className="h-full w-full object-cover"
                  />
                )}
                {rightHeroUrl && (
                  <NextImage
                    src={rightHeroUrl}
                    alt="Фото второго участника"
                    width={720}
                    height={360}
                    sizes="(min-width: 1024px) 560px, 50vw"
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="absolute inset-y-0 left-1/2 w-[42%] -translate-x-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent blur-3xl dark:via-black/30" />
              <div className="absolute inset-y-0 left-1/2 w-[34%] -translate-x-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent blur-2xl dark:via-white/5" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/18 via-white/10 to-black/18 dark:via-black/10" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/10 dark:from-black/60" />

          <div className="relative flex min-h-[300px] flex-col justify-between gap-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <label className="cursor-pointer rounded-full bg-white/55 px-5 py-2 text-sm font-semibold shadow-lg backdrop-blur transition hover:bg-red-50/90 dark:bg-black/25 dark:hover:bg-red-500/15">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    const reader = new FileReader();
                    reader.onloadend = () =>
                      setCroppingImage(reader.result as string);
                    reader.readAsDataURL(file);
                  }}
                  className="hidden"
                />
                {myAvatarUrl ? "Изменить моё фото" : "Добавить моё фото"}
              </label>

              <Link
                href="/profile"
                className="rounded-full bg-white/55 px-5 py-2 text-sm font-semibold shadow-lg backdrop-blur transition hover:bg-red-50/90 dark:bg-black/25 dark:hover:bg-red-500/15"
              >
                Профиль
              </Link>

              {avatarMessage && (
                <p className="rounded-full bg-white/55 px-4 py-2 text-sm font-semibold shadow-lg backdrop-blur dark:bg-black/25">
                  {avatarMessage}
                </p>
              )}
            </div>

            <div>
              <div className="mb-8 flex items-center justify-center gap-4 md:justify-start">
                <AvatarBubble
                  name={profile.partner_one}
                  image={avatarOneUrl}
                  status={getStatus(profile, "one")}
                />
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-2xl shadow-lg">
                  ❤️
                </div>
                <AvatarBubble
                  name={profile.partner_two}
                  image={avatarTwoUrl}
                  status={getStatus(profile, "two")}
                />
              </div>

              <p className="text-sm font-semibold uppercase tracking-wide text-white/80">
                Вместе с {startDate ? formatDate(startDate) : "первого дня"}
              </p>
              <h1 className="mt-2 text-5xl font-bold tracking-tight text-white md:text-6xl">
                {coupleName}
              </h1>
              <p className="mt-4 text-3xl font-bold text-white">
                {daysTogether} дней вместе ❤️
              </p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
          {[
            ["📸", "Воспоминаний", stats.memories],
            ["💌", "Ответов", stats.questionAnswers],
            ["✦", "Викторин", stats.quizzes],
            ["🔥", "Серия дней", stats.streak],
            ["🗓", "Вместе", daysTogether],
          ].map(([icon, label, value]) => (
            <div
              key={label}
              className={`rounded-[1.25rem] bg-gradient-to-b ${theme.panel} ${theme.darkPanel} p-4 shadow-xl md:rounded-3xl md:p-6`}
            >
              <p className="text-2xl md:text-3xl">{icon}</p>
              <p className={`mt-2 text-xs font-semibold ${theme.muted} dark:text-white/65 md:mt-4 md:text-sm`}>
                {label}
              </p>
              <p className="mt-1 text-3xl font-bold md:text-4xl">{value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div
            className={`rounded-3xl bg-gradient-to-b ${theme.panel} ${theme.darkPanel} p-6 shadow-2xl`}
          >
            <h2 className="text-2xl font-bold">Статус</h2>
            <p className={`mt-2 text-sm font-semibold ${theme.muted} dark:text-white/65`}>
              Короткая подпись будет отображаться рядом с вашей аватаркой.
            </p>

            <div className="mt-5 rounded-2xl bg-white/35 p-5 shadow-inner dark:bg-white/5">
              <div className="flex flex-wrap gap-2">
                {statusEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => setStatusEmoji(emoji)}
                    className={`h-11 w-11 rounded-full text-xl shadow-inner transition ${
                      statusEmoji === emoji
                        ? "bg-white shadow-lg ring-2 ring-[#dc2626]/40"
                        : "bg-white/40 hover:bg-red-50/80"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex gap-3">
                <input
                  value={statusText}
                  onChange={(e) => setStatusText(e.target.value.slice(0, 20))}
                  maxLength={20}
                  placeholder="Например: скучаю"
                  className="min-w-0 flex-1 rounded-2xl border border-white/40 bg-white/70 p-4 outline-none transition focus:border-[#dc2626]/40 focus:shadow-[0_0_0_4px_rgba(220,38,38,0.12)] dark:border-white/10 dark:bg-black/20"
                />
                <button
                  onClick={saveStatus}
                  className={`rounded-2xl ${theme.button} ${theme.buttonHover} px-5 font-semibold text-white shadow-lg transition`}
                >
                  Сохранить
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between text-sm font-semibold">
                <span className={theme.muted}>{statusText.length}/20</span>
                {statusMessage && <span>{statusMessage}</span>}
              </div>
            </div>
          </div>

          <div
            className={`rounded-3xl bg-gradient-to-b ${theme.panel} ${theme.darkPanel} p-6 shadow-2xl`}
          >
            <h2 className="text-2xl font-bold">Дата отношений</h2>
            <p className={`mt-2 text-sm font-semibold ${theme.muted} dark:text-white/65`}>
              От неё считаются дни вместе и часть достижений.
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-2xl border border-white/40 bg-white/70 p-4 outline-none dark:border-white/10 dark:bg-black/20"
              />
              <button
                onClick={saveStartDate}
                disabled={isSaving}
                className={`rounded-2xl ${theme.button} ${theme.buttonHover} px-6 py-3 font-semibold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {isSaving ? "Сохраняем..." : "Обновить"}
              </button>
            </div>
            {saveMessage && <p className="mt-3 text-sm font-semibold">{saveMessage}</p>}
          </div>
        </section>

        <section
          className={`relative overflow-hidden rounded-[1.75rem] border border-white/45 bg-gradient-to-r ${theme.panel} ${theme.darkPanel} p-3 shadow-[0_22px_70px_rgba(127,29,29,0.14)] backdrop-blur-xl dark:border-white/10`}
        >
          <div className="pointer-events-none absolute -right-10 -top-16 h-28 w-28 rounded-full bg-white/25 blur-3xl" />
          <div className="relative grid gap-3 sm:grid-cols-3">
            <button
              onClick={() => setIsActivityOpen(true)}
              className="group flex items-center gap-3 rounded-2xl border border-white/45 bg-white/35 px-4 py-3 text-left shadow-inner transition hover:-translate-y-0.5 hover:bg-red-50/70 dark:border-white/10 dark:bg-white/5 dark:hover:bg-red-500/12"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/55 text-2xl shadow-inner transition group-hover:scale-105 dark:bg-white/10">
                🕊️
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-black">Последняя активность</span>
                <span className={`block truncate text-xs font-bold ${theme.muted} dark:text-white/55`}>
                  {activity.length > 0 ? `${activity.length} событий` : "Пока пусто"}
                </span>
              </span>
            </button>

            <button
              onClick={() => setIsTimelineOpen(true)}
              className="group flex items-center gap-3 rounded-2xl border border-white/45 bg-white/35 px-4 py-3 text-left shadow-inner transition hover:-translate-y-0.5 hover:bg-red-50/70 dark:border-white/10 dark:bg-white/5 dark:hover:bg-red-500/12"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/55 text-2xl shadow-inner transition group-hover:scale-105 dark:bg-white/10">
                🕰️
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-black">Таймлайн</span>
                <span className={`block truncate text-xs font-bold ${theme.muted} dark:text-white/55`}>
                  {completedTimeline.length} из {timeline.length}
                </span>
              </span>
            </button>

            <button
              onClick={() => {
                setAchievementView(unlockedAchievements > 0 ? "unlocked" : "locked");
                setIsAchievementsOpen(true);
              }}
              className="group flex items-center gap-3 rounded-2xl border border-white/45 bg-white/35 px-4 py-3 text-left shadow-inner transition hover:-translate-y-0.5 hover:bg-red-50/70 dark:border-white/10 dark:bg-white/5 dark:hover:bg-red-500/12"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/55 text-2xl shadow-inner transition group-hover:scale-105 dark:bg-white/10">
                🏆
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-black">Достижения</span>
                <span className={`block truncate text-xs font-bold ${theme.muted} dark:text-white/55`}>
                  {unlockedAchievements} из {achievements.length}
                </span>
              </span>
            </button>
          </div>
        </section>

      </div>

      {isActivityOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-3 backdrop-blur-md sm:p-4"
          onClick={() => setIsActivityOpen(false)}
        >
          <div
            className={`achievement-modal relative max-h-[82vh] w-full max-w-3xl overflow-hidden rounded-[2rem] bg-gradient-to-b ${theme.panel} ${theme.darkPanel} p-6 text-[#dc2626] shadow-[0_40px_120px_rgba(0,0,0,0.42)] dark:text-white`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-white/25 blur-3xl" />
            <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div>
                <h2 className="text-3xl font-black">Последняя активность</h2>
                <p className={`mt-1 text-sm font-semibold ${theme.muted} dark:text-white/65`}>
                  Всё новое в вашей паре.
                </p>
              </div>
              <button
                onClick={() => setIsActivityOpen(false)}
                className="rounded-full bg-white/70 px-5 py-2 text-sm font-black text-[#dc2626] shadow-lg transition hover:bg-red-50 dark:bg-white/10 dark:text-white dark:hover:bg-red-500/15"
              >
                Закрыть
              </button>
            </div>

            <div className="relative mt-6 max-h-[58vh] space-y-3 overflow-y-auto pr-1">
              {activity.length === 0 ? (
                <div className="rounded-3xl bg-white/35 p-8 text-center font-bold shadow-inner dark:bg-white/5">
                  Активности пока нет.
                </div>
              ) : (
                activity.map((item, index) => (
                  <div
                    key={item.id}
                    className="achievement-card rounded-3xl border border-white/35 bg-white/45 p-5 shadow-[0_16px_42px_rgba(127,29,29,0.14)] dark:border-white/10 dark:bg-white/5"
                    style={{ animationDelay: `${index * 45}ms` }}
                  >
                    <div className="flex gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/60 text-xl shadow-inner dark:bg-white/10">
                        {item.icon}
                      </div>
                      <div>
                        <p className="font-black">{item.text}</p>
                        <p className={`mt-1 text-sm font-semibold ${theme.muted} dark:text-white/65`}>
                          {item.time}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {isTimelineOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-3 backdrop-blur-md sm:p-4"
          onClick={() => setIsTimelineOpen(false)}
        >
          <div
            className={`achievement-modal relative max-h-[82vh] w-full max-w-3xl overflow-hidden rounded-[2rem] bg-gradient-to-b ${theme.panel} ${theme.darkPanel} p-6 text-[#dc2626] shadow-[0_40px_120px_rgba(0,0,0,0.42)] dark:text-white`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-white/25 blur-3xl" />
            <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div>
                <h2 className="text-3xl font-black">Таймлайн</h2>
                <p className={`mt-1 text-sm font-semibold ${theme.muted} dark:text-white/65`}>
                  История пары, прогресс и ближайшие цели.
                </p>
              </div>
              <button
                onClick={() => setIsTimelineOpen(false)}
                className="rounded-full bg-white/70 px-5 py-2 text-sm font-black text-[#dc2626] shadow-lg transition hover:bg-red-50 dark:bg-white/10 dark:text-white dark:hover:bg-red-500/15"
              >
                Закрыть
              </button>
            </div>

            <div className="relative mt-6 grid gap-3 sm:grid-cols-3">
              {[
                ["Свершилось", completedTimeline.length],
                ["Следующие цели", upcomingTimeline.length],
                ["Прогресс", `${timelineProgress}%`],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-3xl bg-white/35 p-4 text-center shadow-inner dark:bg-white/5"
                >
                  <p className="text-2xl font-black">{value}</p>
                  <p className={`mt-1 text-xs font-black uppercase tracking-wide ${theme.muted} dark:text-white/60`}>
                    {label}
                  </p>
                </div>
              ))}
            </div>

            <div className="relative mt-5 rounded-full bg-white/30 p-1 shadow-inner dark:bg-white/10">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-[#dc2626] via-[#ff6b81] to-[#f97316] shadow-[0_0_24px_rgba(220,38,38,0.35)] transition-all duration-700"
                style={{ width: `${timelineProgress}%` }}
              />
            </div>

            <div className="relative mt-8 max-h-[52vh] overflow-y-auto pr-1">
              <div className="absolute bottom-0 left-6 top-0 w-px bg-gradient-to-b from-[#dc2626]/10 via-[#dc2626]/45 to-[#dc2626]/10 dark:via-white/30" />
              <div className="space-y-8">
                {[
                  ["Уже случилось", completedTimeline],
                  ["Ближайшие цели", upcomingTimeline],
                ].map(([sectionTitle, sectionItems]) => (
                  <div key={sectionTitle as string}>
                    <h3 className="mb-4 ml-16 text-sm font-black uppercase tracking-wide text-[#dc2626]/70 dark:text-white/60">
                      {sectionTitle as string}
                    </h3>
                    <div className="space-y-5">
                      {(sectionItems as TimelineItem[]).map((item, index) => (
                        <div
                          key={item.id}
                          className="achievement-card relative flex gap-5"
                          style={{ animationDelay: `${index * 65}ms` }}
                        >
                          <div
                            className={`z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl shadow-xl ring-4 ring-white/30 dark:ring-white/10 ${
                              item.status === "done"
                                ? "bg-white/80 dark:bg-white/15"
                                : "bg-white/45 opacity-75 dark:bg-white/5"
                            }`}
                          >
                            {item.icon}
                          </div>
                          <div
                            className={`group flex-1 rounded-3xl border border-white/35 bg-gradient-to-br ${item.gradient} p-5 shadow-[0_16px_42px_rgba(127,29,29,0.14)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_60px_rgba(127,29,29,0.2)] dark:border-white/10`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className={`text-sm font-black ${theme.muted} dark:text-white/65`}>
                                  {item.year} · {item.category}
                                </p>
                                <p className="mt-1 text-xl font-black">{item.title}</p>
                              </div>
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-black shadow-inner ${
                                  item.status === "done"
                                    ? "bg-white/70 text-[#dc2626] dark:bg-white/10 dark:text-white"
                                    : "bg-[#dc2626]/10 text-[#dc2626] dark:bg-white/10 dark:text-white"
                                }`}
                              >
                                {item.status === "done" ? "свершилось" : "цель"}
                              </span>
                            </div>
                            <p className={`mt-3 text-sm font-semibold ${theme.muted} dark:text-white/70`}>
                              {item.text}
                            </p>
                            <p className="mt-4 inline-flex rounded-full bg-white/50 px-3 py-1 text-xs font-black shadow-inner dark:bg-white/10">
                              {item.dateLabel}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {isAchievementsOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-3 backdrop-blur-md sm:p-4"
          onClick={() => setIsAchievementsOpen(false)}
        >
          <div
            className={`achievement-modal relative flex max-h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] bg-gradient-to-b ${theme.panel} ${theme.darkPanel} p-6 text-[#dc2626] shadow-[0_40px_120px_rgba(0,0,0,0.42)] dark:text-white`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-white/25 blur-3xl" />
            <div className="relative flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4">
              <div>
                <h2 className="text-3xl font-black">Достижения</h2>
                <p className={`mt-1 text-sm font-semibold ${theme.muted} dark:text-white/65`}>
                  Открыто {unlockedAchievements} из {achievements.length}
                </p>
              </div>
              <button
                onClick={() => setIsAchievementsOpen(false)}
                className="rounded-full bg-white/70 px-5 py-2 text-sm font-black text-[#dc2626] shadow-lg transition hover:bg-red-50 dark:bg-white/10 dark:text-white dark:hover:bg-red-500/15"
              >
                Закрыть
              </button>
            </div>

            <div className="relative mt-5 rounded-full bg-white/30 p-1 shadow-inner dark:bg-white/10">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-[#dc2626] via-[#ff6b81] to-[#f97316] shadow-[0_0_24px_rgba(220,38,38,0.35)] transition-all duration-700"
                style={{ width: `${achievementProgress}%` }}
              />
            </div>
            <p className="relative mt-2 text-xs font-black uppercase tracking-wide text-[#dc2626]/70 dark:text-white/60">
              Прогресс коллекции: {achievementProgress}%
            </p>

            <div className="relative mt-5 grid grid-cols-2 rounded-3xl bg-white/25 p-1 shadow-inner dark:bg-white/5">
              {[
                ["unlocked", `Полученные (${unlockedAchievementList.length})`],
                ["locked", `Закрытые (${lockedAchievementList.length})`],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setAchievementView(key as "unlocked" | "locked")}
                  className={`rounded-[1.35rem] px-4 py-3 text-sm font-black transition ${
                    achievementView === key
                      ? "bg-white text-[#dc2626] shadow-lg dark:bg-white/15 dark:text-white"
                      : "text-[#dc2626]/65 hover:bg-red-50/70 dark:text-white/60 dark:hover:bg-red-500/12"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="relative mt-5 flex-1 overflow-y-auto pr-1">
              <div className="columns-1 gap-3 sm:columns-2 lg:columns-3">
              {(achievementView === "unlocked"
                ? unlockedAchievementList
                : lockedAchievementList
              ).map((achievement, index) => {
                const isRecent = recentAchievementIds.includes(achievement.id);
                const unlockDate = achievementDates[achievement.id];

                return (
                  <button
                    key={achievement.id}
                    onClick={() => setSelectedAchievement(achievement)}
                    className={`achievement-card group relative mb-3 w-full break-inside-avoid overflow-hidden rounded-2xl border p-4 text-left font-semibold shadow-[0_18px_45px_rgba(127,29,29,0.18),inset_0_1px_0_rgba(255,255,255,0.55)] transition duration-300 hover:-translate-y-1 hover:rotate-[0.6deg] hover:scale-[1.025] ${
                      achievement.unlocked
                        ? `bg-gradient-to-br ${achievement.gradient} ${achievement.border} ${
                            isRecent ? "achievement-recent" : ""
                          }`
                        : "border-white/25 bg-white/20 text-[#dc2626]/55 blur-[0.2px] dark:bg-white/5 dark:text-white/45"
                    }`}
                    style={{ animationDelay: `${Math.min(index * 35, 420)}ms` }}
                    title={
                      achievement.unlocked
                        ? `${achievement.description} Получено: ${
                            unlockDate ? formatDate(unlockDate) : "недавно"
                          }`
                        : "Тайное достижение. Откроется, когда будет выполнено условие."
                    }
                  >
                    <span className="pointer-events-none absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-100">
                      <span className="achievement-shine absolute inset-y-0 -left-1/2 w-1/2 skew-x-[-18deg] bg-white/35" />
                    </span>

                    {achievement.unlocked && isRecent && (
                      <span className="pointer-events-none absolute right-4 top-4 flex gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-white/90 achievement-particle" />
                        <span className="h-1 w-1 rounded-full bg-[#dc2626]/80 achievement-particle achievement-particle-delay" />
                      </span>
                    )}

                    {achievement.unlocked ? (
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-3xl transition duration-300 group-hover:scale-110 group-hover:text-[#dc2626]">
                            {achievement.icon}
                          </span>
                          <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-black text-[#dc2626] shadow-inner dark:bg-white/10 dark:text-white">
                            {achievement.special ? "особое" : achievement.target}
                          </span>
                        </div>
                        <p className="mt-4 text-sm font-black transition-colors duration-300 group-hover:text-[#b91c1c]">
                          {achievement.name}
                        </p>
                        <p className={`mt-1 text-xs font-black uppercase ${theme.muted} dark:text-white/60`}>
                          {achievement.title}
                        </p>
                        <p className={`mt-2 text-xs ${theme.muted} dark:text-white/60`}>
                          Получено: {unlockDate ? formatDate(unlockDate) : "недавно"}
                        </p>

                        <div className="pointer-events-none absolute left-4 top-full z-20 mt-2 w-56 rounded-2xl bg-white/95 p-3 text-xs font-bold text-[#7f1d1d] opacity-0 shadow-2xl ring-1 ring-[#dc2626]/10 backdrop-blur transition group-hover:translate-y-1 group-hover:opacity-100 dark:bg-black/80 dark:text-white">
                          {achievement.description}
                        </div>
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-2">
                            <span className="text-2xl">🔒</span>
                            <span>{achievement.name}</span>
                          </span>
                          <span className="rounded-full bg-white/35 px-3 py-1 text-xs font-black dark:bg-white/10">
                            скрыто
                          </span>
                        </div>
                        <div className="mt-3 h-10 rounded-xl bg-white/25 blur-sm dark:bg-white/10" />

                        <div className="pointer-events-none absolute left-4 top-full z-20 mt-2 w-56 rounded-2xl bg-white/95 p-3 text-xs font-bold text-[#7f1d1d] opacity-0 shadow-2xl ring-1 ring-[#dc2626]/10 backdrop-blur transition group-hover:translate-y-1 group-hover:opacity-100 dark:bg-black/80 dark:text-white">
                          Условие скрыто до открытия.
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
              </div>
              {achievementView === "unlocked" && unlockedAchievementList.length === 0 && (
                <div className="rounded-3xl bg-white/35 p-8 text-center font-bold shadow-inner dark:bg-white/5">
                  Пока нет полученных достижений.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {achievementToast && (
        <div className="achievement-toast fixed right-6 top-24 z-40 max-w-sm rounded-3xl border border-white/50 bg-white/85 p-5 text-[#dc2626] shadow-[0_24px_80px_rgba(127,29,29,0.28)] backdrop-blur-2xl dark:border-white/10 dark:bg-black/70 dark:text-white">
          <p className="text-xs font-black uppercase tracking-wide text-[#dc2626]/65 dark:text-white/60">
            Новое достижение
          </p>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-4xl">{achievementToast.icon}</span>
            <div>
              <p className="font-black">{achievementToast.name}</p>
              <p className="text-sm font-semibold opacity-70">
                {achievementToast.title}
              </p>
            </div>
          </div>
        </div>
      )}

      {selectedAchievement && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-md sm:p-4"
          onClick={() => setSelectedAchievement(null)}
        >
          <div
            className={`achievement-modal relative w-full max-w-lg overflow-hidden rounded-[2rem] border p-8 text-[#7f1d1d] shadow-[0_40px_120px_rgba(0,0,0,0.45)] dark:text-white ${
              selectedAchievement.unlocked
                ? `bg-gradient-to-br ${selectedAchievement.gradient} ${selectedAchievement.border}`
                : "border-white/20 bg-white/85 dark:bg-black/80"
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-white/40 blur-3xl" />
            <div className="relative">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/70 text-5xl shadow-2xl dark:bg-white/10">
                  {selectedAchievement.unlocked ? selectedAchievement.icon : "🔒"}
                </div>
                <button
                  onClick={() => setSelectedAchievement(null)}
                  className="rounded-full bg-white/70 px-4 py-2 text-sm font-black text-[#dc2626] shadow-lg transition hover:bg-red-50 dark:bg-white/10 dark:text-white dark:hover:bg-red-500/15"
                >
                  Закрыть
                </button>
              </div>

              <p className="mt-6 text-sm font-black uppercase tracking-wide opacity-65">
                {selectedAchievement.unlocked
                  ? `Получено: ${
                      achievementDates[selectedAchievement.id]
                        ? formatDate(achievementDates[selectedAchievement.id])
                        : "недавно"
                    }`
                  : "Тайное достижение"}
              </p>
              <h3 className="mt-2 text-4xl font-black">
                {selectedAchievement.unlocked
                  ? selectedAchievement.name
                  : "Скрыто до открытия"}
              </h3>
              {selectedAchievement.unlocked && (
                <p className="mt-2 text-sm font-black uppercase tracking-wide opacity-65">
                  {selectedAchievement.title}
                </p>
              )}
              <p className="mt-4 text-lg font-semibold opacity-80">
                {selectedAchievement.unlocked
                  ? selectedAchievement.description
                  : "Выполните условие, и здесь появятся детали достижения."}
              </p>

              <div className="mt-6 rounded-3xl bg-white/45 p-5 shadow-inner dark:bg-white/10">
                <div className="flex items-center justify-between text-sm font-black uppercase tracking-wide opacity-70">
                  <span>Текущий прогресс</span>
                  <span>
                    {selectedAchievement.value}/{selectedAchievement.target}
                  </span>
                </div>
                <div className="mt-3 rounded-full bg-white/45 p-1 shadow-inner dark:bg-black/20">
                  <div
                    className="h-3 rounded-full bg-gradient-to-r from-[#dc2626] to-[#fb7185] transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          (selectedAchievement.value / selectedAchievement.target) * 100
                        )
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {croppingImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-4 shadow-2xl dark:bg-gray-900">
            <div className="relative h-64 w-full overflow-hidden rounded-2xl">
              <Cropper
                image={croppingImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, croppedPixels) =>
                  setCroppedAreaPixels(croppedPixels)
                }
              />
            </div>

            {croppedAreaPixels && (
              <div className="mt-4 flex flex-col items-center gap-2">
                <p className="text-sm font-semibold text-[#dc2626]">
                  Так будет выглядеть фото
                </p>
                <CroppedPreview
                  imageSrc={croppingImage}
                  croppedArea={croppedAreaPixels}
                  size={100}
                />
              </div>
            )}

            <div className="mt-4 flex justify-between">
              <button
                onClick={() => setCroppingImage(null)}
                className="rounded-full bg-gray-300 px-4 py-2 font-semibold text-gray-800 transition hover:bg-gray-400"
              >
                Отмена
              </button>

              <button
                onClick={saveCroppedAvatar}
                className="rounded-full bg-[#dc2626] px-4 py-2 font-semibold text-white transition hover:bg-[#ff5a6b]"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
