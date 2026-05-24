import { dashboardThemeAccents } from "@/lib/dashboardTheme";

export type PageThemeKey =
  | "home"
  | "today"
  | "dashboard"
  | "profile"
  | "memories"
  | "questions"
  | "quizzes"
  | "watch"
  | "tracker"
  | "chat"
  | "login"
  | "default";

export type PageTheme = {
  key: PageThemeKey;
  accent: string;
  soft: string;
  nav?: {
    background: string;
    borderColor: string;
    boxShadow: string;
  };
};

export const pageThemes: Record<PageThemeKey, PageTheme> = {
  home: {
    key: "home",
    accent: "#ea580c",
    soft: "#ffedd5",
    nav: {
      background: "linear-gradient(135deg, rgba(234, 88, 12, 0.22), rgba(245, 158, 11, 0.16))",
      borderColor: "rgba(234, 88, 12, 0.3)",
      boxShadow: "0 18px 58px rgba(234, 88, 12, 0.2)",
    },
  },
  dashboard: {
    key: "dashboard",
    accent: dashboardThemeAccents.rose,
    soft: "#fee2e2",
  },
  profile: {
    key: "profile",
    accent: "#92400e",
    soft: "#fed7aa",
    nav: {
      background: "linear-gradient(135deg, rgba(146, 64, 14, 0.22), rgba(180, 83, 9, 0.16))",
      borderColor: "rgba(146, 64, 14, 0.3)",
      boxShadow: "0 16px 48px rgba(146, 64, 14, 0.18)",
    },
  },
  memories: {
    key: "memories",
    accent: "#2563eb",
    soft: "#dbeafe",
  },
  today: {
    key: "today",
    accent: "#ea580c",
    soft: "#ffedd5",
  },
  questions: {
    key: "questions",
    accent: "#27ae60",
    soft: "#dcfce7",
  },
  quizzes: {
    key: "quizzes",
    accent: "#7c3aed",
    soft: "#ede9fe",
  },
  watch: {
    key: "watch",
    accent: "#65a30d",
    soft: "#ecfccb",
  },
  tracker: {
    key: "tracker",
    accent: "#ca8a04",
    soft: "#fef3c7",
    nav: {
      background: "linear-gradient(135deg, rgba(202, 138, 4, 0.22), rgba(250, 204, 21, 0.16))",
      borderColor: "rgba(202, 138, 4, 0.3)",
      boxShadow: "0 16px 48px rgba(202, 138, 4, 0.18)",
    },
  },
  chat: {
    key: "chat",
    accent: "#0284c7",
    soft: "#e0f2fe",
  },
  login: {
    key: "login",
    accent: "#be123c",
    soft: "#ffe4e6",
  },
  default: {
    key: "default",
    accent: "#1c8b59",
    soft: "#dcfce7",
  },
};

export function getPageThemeKey(pathname: string): PageThemeKey {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/today")) return "today";
  if (pathname.startsWith("/dashboard")) return "dashboard";
  if (pathname.startsWith("/profile")) return "profile";
  if (pathname.startsWith("/memories")) return "memories";
  if (pathname.startsWith("/questions")) return "questions";
  if (pathname.startsWith("/quizzes")) return "quizzes";
  if (pathname.startsWith("/watch")) return "watch";
  if (pathname.startsWith("/tracker")) return "tracker";
  if (pathname.startsWith("/chat")) return "chat";
  if (pathname.startsWith("/login")) return "login";
  return "default";
}

export function getPageTheme(pathname: string, dashboardAccent?: string) {
  const key = getPageThemeKey(pathname);
  if (key !== "dashboard") return pageThemes[key];

  return {
    ...pageThemes.dashboard,
    accent: dashboardAccent || dashboardThemeAccents.rose,
  };
}
