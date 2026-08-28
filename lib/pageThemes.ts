import { dashboardThemeAccents } from "@/lib/dashboardTheme";

export type PageThemeKey =
  | "home"
  | "today"
  | "dashboard"
  | "profile"
  | "settings"
  | "memories"
  | "questions"
  | "watch"
  | "tracker"
  | "countdown"
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
  settings: {
    key: "settings",
    accent: "#78350f",
    soft: "#ead8c8",
    nav: {
      background: "linear-gradient(135deg, rgba(120, 53, 15, 0.24), rgba(146, 64, 14, 0.16))",
      borderColor: "rgba(120, 53, 15, 0.34)",
      boxShadow: "0 16px 48px rgba(120, 53, 15, 0.2)",
    },
  },
  memories: {
    key: "memories",
    accent: "#2563eb",
    soft: "#dbeafe",
    nav: {
      background: "linear-gradient(135deg, rgba(37, 99, 235, 0.24), rgba(14, 165, 233, 0.14))",
      borderColor: "rgba(37, 99, 235, 0.34)",
      boxShadow: "0 16px 50px rgba(37, 99, 235, 0.2)",
    },
  },
  today: {
    key: "today",
    accent: "#ea580c",
    soft: "#ffedd5",
    nav: {
      background: "linear-gradient(135deg, rgba(234, 88, 12, 0.24), rgba(251, 146, 60, 0.16))",
      borderColor: "rgba(234, 88, 12, 0.34)",
      boxShadow: "0 16px 50px rgba(234, 88, 12, 0.2)",
    },
  },
  questions: {
    key: "questions",
    accent: "#27ae60",
    soft: "#dcfce7",
    nav: {
      background: "linear-gradient(135deg, rgba(39, 174, 96, 0.24), rgba(20, 184, 166, 0.14))",
      borderColor: "rgba(39, 174, 96, 0.34)",
      boxShadow: "0 16px 50px rgba(39, 174, 96, 0.2)",
    },
  },
  watch: {
    key: "watch",
    accent: "#3f6212",
    soft: "#ecfccb",
    nav: {
      background: "linear-gradient(135deg, rgba(63, 98, 18, 0.25), rgba(101, 163, 13, 0.16))",
      borderColor: "rgba(63, 98, 18, 0.36)",
      boxShadow: "0 16px 50px rgba(63, 98, 18, 0.2)",
    },
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
  countdown: {
    key: "countdown",
    accent: "#db2777",
    soft: "#fce7f3",
    nav: {
      background: "linear-gradient(135deg, rgba(219, 39, 119, 0.24), rgba(244, 63, 94, 0.14))",
      borderColor: "rgba(219, 39, 119, 0.34)",
      boxShadow: "0 16px 50px rgba(219, 39, 119, 0.2)",
    },
  },
  chat: {
    key: "chat",
    accent: "#0284c7",
    soft: "#e0f2fe",
    nav: {
      background: "linear-gradient(135deg, rgba(2, 132, 199, 0.24), rgba(14, 165, 233, 0.14))",
      borderColor: "rgba(2, 132, 199, 0.34)",
      boxShadow: "0 16px 50px rgba(2, 132, 199, 0.2)",
    },
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
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/memories")) return "memories";
  if (pathname.startsWith("/questions")) return "questions";
  if (pathname.startsWith("/watch")) return "watch";
  if (pathname.startsWith("/tracker")) return "tracker";
  if (pathname.startsWith("/countdown")) return "countdown";
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
