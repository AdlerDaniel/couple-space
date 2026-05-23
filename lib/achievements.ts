export type AchievementStats = {
  memories: number;
  answers: number;
  quizzes: number;
  tracker: number;
};

export type AchievementCard = {
  id: string;
  icon: string;
  title: string;
  text: string;
  value: number;
  target: number;
  href: string;
};

export function buildCoupleAchievements(stats: AchievementStats): AchievementCard[] {
  const total = stats.memories + stats.answers + stats.quizzes + stats.tracker;

  return [
    {
      id: "first-memory",
      icon: "▣",
      title: "Первое воспоминание",
      text: "Добавьте первый общий момент.",
      value: stats.memories,
      target: 1,
      href: "/memories",
    },
    {
      id: "five-answers",
      icon: "✉",
      title: "Пять ответов",
      text: "Ответьте на вопросы дня несколько раз.",
      value: stats.answers,
      target: 5,
      href: "/questions",
    },
    {
      id: "three-quizzes",
      icon: "✦",
      title: "Три викторины",
      text: "Пройдите викторины и сравните результаты.",
      value: stats.quizzes,
      target: 3,
      href: "/quizzes",
    },
    {
      id: "tracker-start",
      icon: "◫",
      title: "Цель в движении",
      text: "Сделайте первые отметки в трекере.",
      value: stats.tracker,
      target: 5,
      href: "/tracker",
    },
    {
      id: "active-couple",
      icon: "⚡",
      title: "Активная пара",
      text: "Наберите 25 действий во всех разделах.",
      value: total,
      target: 25,
      href: "/today",
    },
    {
      id: "balanced",
      icon: "🎯",
      title: "Баланс",
      text: "Сделайте хотя бы по одному действию в трёх разделах.",
      value: [stats.memories, stats.answers, stats.quizzes, stats.tracker].filter(
        (value) => value > 0,
      ).length,
      target: 3,
      href: "/",
    },
  ];
}
