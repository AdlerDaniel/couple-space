export type NavIconName =
  | "home"
  | "today"
  | "questions"
  | "quizzes"
  | "watch"
  | "chat"
  | "dashboard"
  | "memories"
  | "tracker"
  | "calendar"
  | "achievements"
  | "profile"
  | "settings"
  | "notifications"
  | "plus"
  | "logout";

export type NavLinkItem = {
  label: string;
  href: string;
  icon: NavIconName;
  description?: string;
};

export const primaryNavLinks: NavLinkItem[] = [
  { label: "Сегодня", href: "/today", icon: "today", description: "Лучший следующий шаг" },
  { label: "Вопросы", href: "/questions", icon: "questions", description: "Ответы и архив" },
  { label: "Викторины", href: "/quizzes", icon: "quizzes", description: "Тесты для пары" },
  { label: "Смотреть", href: "/watch", icon: "watch", description: "Что посмотрим?" },
  { label: "Чат", href: "/chat", icon: "chat", description: "Сообщения" },
];

export const mobileMainLinks: NavLinkItem[] = [
  { label: "Сегодня", href: "/today", icon: "today" },
  { label: "Вопросы", href: "/questions", icon: "questions" },
  { label: "Викторины", href: "/quizzes", icon: "quizzes" },
  { label: "Смотреть", href: "/watch", icon: "watch" },
];

export const secondaryNavLinks: NavLinkItem[] = [
  { label: "Главная", href: "/", icon: "home", description: "Общий обзор" },
  { label: "Кабинет", href: "/dashboard", icon: "dashboard", description: "Аналитика пары" },
  { label: "Воспоминания", href: "/memories", icon: "memories", description: "Фото и моменты" },
  { label: "Трекер", href: "/tracker", icon: "tracker", description: "Цели и привычки" },
  { label: "Календарь", href: "/calendar", icon: "calendar", description: "События пары по дням" },
  { label: "Чат", href: "/chat", icon: "chat", description: "Сообщения" },
];

export const quickNavActions: NavLinkItem[] = [
  { label: "Момент", href: "/memories", icon: "plus", description: "Добавить воспоминание" },
  { label: "Фильм", href: "/watch", icon: "watch", description: "Добавить в список" },
  { label: "Цель", href: "/tracker", icon: "tracker", description: "Внести прогресс" },
  { label: "Чат", href: "/chat", icon: "chat", description: "Написать партнёру" },
];

export const accountNavLinks: NavLinkItem[] = [
  { label: "Профиль", href: "/profile", icon: "profile" },
  { label: "Настройки", href: "/settings", icon: "settings" },
  { label: "Выйти", href: "/logout", icon: "logout" },
];

export const routeMeta: Record<
  string,
  {
    label: string;
    description: string;
    icon: NavIconName;
  }
> = {
  "/": {
    label: "Главная",
    description: "Обзор пары и быстрый вход в разделы",
    icon: "home",
  },
  "/today": {
    label: "Сегодня",
    description: "Лучший следующий шаг на день",
    icon: "today",
  },
  "/questions": {
    label: "Вопросы",
    description: "Ежедневные вопросы, ответы и архив",
    icon: "questions",
  },
  "/questions/today": {
    label: "Вопрос дня",
    description: "Ответьте и сравните ответы",
    icon: "questions",
  },
  "/questions/archive": {
    label: "Архив",
    description: "История ответов пары",
    icon: "questions",
  },
  "/quizzes": {
    label: "Викторины",
    description: "Совместные тесты и результаты",
    icon: "quizzes",
  },
  "/watch": {
    label: "Что посмотрим",
    description: "Список фильмов и рулетка вечера",
    icon: "watch",
  },
  "/chat": {
    label: "Чат",
    description: "Сообщения и реакции",
    icon: "chat",
  },
  "/dashboard": {
    label: "Кабинет",
    description: "Аналитика, история и достижения",
    icon: "dashboard",
  },
  "/memories": {
    label: "Воспоминания",
    description: "Фото, моменты и реакции",
    icon: "memories",
  },
  "/tracker": {
    label: "Трекер",
    description: "Цели, привычки и прогресс",
    icon: "tracker",
  },
  "/calendar": {
    label: "Календарь",
    description: "Вопросы, фильмы, цели и воспоминания по дням",
    icon: "calendar",
  },
  "/profile": {
    label: "Профиль",
    description: "Пара, фото и личные настройки",
    icon: "profile",
  },
  "/settings": {
    label: "Настройки",
    description: "Внешний вид и поведение сайта",
    icon: "settings",
  },
  "/notifications": {
    label: "Уведомления",
    description: "Новые события пары",
    icon: "notifications",
  },
};

export function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getRouteMeta(pathname: string) {
  const exact = routeMeta[pathname];
  if (exact) return exact;

  const matchedRoute = Object.keys(routeMeta)
    .filter((route) => route !== "/" && pathname.startsWith(`${route}/`))
    .sort((first, second) => second.length - first.length)[0];

  return matchedRoute ? routeMeta[matchedRoute] : routeMeta["/"];
}

export function getBreadcrumbs(pathname: string) {
  if (pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/logout")) {
    return [];
  }

  const parts = pathname.split("/").filter(Boolean);

  return parts.map((_, index) => {
    const href = `/${parts.slice(0, index + 1).join("/")}`;
    const meta = getRouteMeta(href);
    const isUnknownDynamic = !routeMeta[href];

    return {
      href,
      label: isUnknownDynamic ? "Детали" : meta.label,
      current: index === parts.length - 1,
    };
  });
}
