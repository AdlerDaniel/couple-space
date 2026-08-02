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
  | "countdown"
  | "profile"
  | "settings"
  | "notifications"
  | "more"
  | "close"
  | "chevronRight"
  | "logout";

export type NavLinkItem = {
  label: string;
  href: string;
  icon: NavIconName;
  description?: string;
};

export const primaryNavLinks: NavLinkItem[] = [
  { label: "Сегодня", href: "/today", icon: "today", description: "Лучший следующий шаг" },
  { label: "Вопрос дня", href: "/questions", icon: "questions", description: "Ответы и архив" },
  { label: "Викторины", href: "/quizzes", icon: "quizzes", description: "Тесты для пары" },
  { label: "Фильмы", href: "/watch", icon: "watch", description: "Список и рулетка" },
  { label: "Воспоминания", href: "/memories", icon: "memories", description: "Фото и моменты" },
  { label: "Отсчёт", href: "/countdown", icon: "countdown", description: "Таймеры до важных событий" },
];

export const mobileMainLinks: NavLinkItem[] = [
  { label: "Моменты", href: "/memories", icon: "memories" },
  { label: "Вопрос", href: "/questions", icon: "questions" },
  { label: "Трекер", href: "/tracker", icon: "tracker" },
  { label: "Фильмы", href: "/watch", icon: "watch" },
];

export const mobileMoreLinks: NavLinkItem[] = [
  { label: "Сегодня", href: "/today", icon: "today", description: "Лучший следующий шаг" },
  { label: "Кабинет", href: "/dashboard", icon: "dashboard", description: "Аналитика пары" },
  { label: "Викторины", href: "/quizzes", icon: "quizzes", description: "Тесты для пары" },
  { label: "Чат", href: "/chat", icon: "chat", description: "Сообщения" },
  { label: "Отсчёт", href: "/countdown", icon: "countdown", description: "Таймеры до важных событий" },
];

export const secondaryNavLinks: NavLinkItem[] = [
  { label: "Кабинет", href: "/dashboard", icon: "dashboard", description: "Аналитика пары" },
  { label: "Чат", href: "/chat", icon: "chat", description: "Сообщения" },
  { label: "Трекер", href: "/tracker", icon: "tracker", description: "Цели и привычки" },
];

export const desktopNavLinks: NavLinkItem[] = [...primaryNavLinks, ...secondaryNavLinks];

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
    label: "Сегодня",
    description: "Лучший следующий шаг на день",
    icon: "today",
  },
  "/today": {
    label: "Сегодня",
    description: "Лучший следующий шаг на день",
    icon: "today",
  },
  "/questions": {
    label: "Вопрос дня",
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
    label: "Фильмы",
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
    description: "Профиль и активность пары",
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
  "/countdown": {
    label: "Отсчёт",
    description: "Таймеры до важных событий пары",
    icon: "countdown",
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
  "/diagnostics": {
    label: "Диагностика",
    description: "Проверка загрузки сайта и Supabase",
    icon: "settings",
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
