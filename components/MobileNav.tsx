"use client";

import { useDashboardAccent } from "@/lib/useDashboardAccent";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  {
    href: "/",
    label: "Главная",
    icon: "🏠",
  },
  {
    href: "/dashboard",
    label: "Кабинет",
    icon: "❤️",
  },
  {
    href: "/memories",
    label: "Фото",
    icon: "📸",
  },
  {
    href: "/questions",
    label: "Вопросы",
    icon: "💌",
  },
  {
    href: "/quizzes",
    label: "Викторины",
    icon: "✦",
  },
];

export default function MobileNav() {
  const pathname = usePathname();
  const dashboardAccent = useDashboardAccent();
  const homeAccent = "#9f1239";
  const isHome = pathname === "/";
  const isDashboard = pathname.startsWith("/dashboard");
  const navStyle = isHome
    ? {
        background:
          "linear-gradient(135deg, rgba(159, 18, 57, 0.2), rgba(192, 38, 211, 0.16))",
        borderColor: "rgba(159, 18, 57, 0.24)",
        boxShadow: "0 18px 46px rgba(159, 18, 57, 0.2)",
      }
    : isDashboard
    ? {
        backgroundColor: `${dashboardAccent}24`,
        borderColor: `${dashboardAccent}55`,
        boxShadow: `0 18px 46px ${dashboardAccent}35`,
      }
    : undefined;

  return (
    <nav
      style={navStyle}
      className="fixed bottom-3 left-3 right-3 z-40 rounded-[1.4rem] border border-transparent bg-white/90 px-2 py-2 shadow-2xl backdrop-blur md:hidden"
    >
      <div className="grid grid-cols-5 items-center text-[10px] font-semibold leading-tight">
        {links.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);

          return (
            <Link
              key={link.href}
              href={link.href}
              style={
                isActive && isHome
                  ? { color: homeAccent }
                  : isActive && isDashboard
                    ? { color: dashboardAccent }
                    : undefined
              }
              className={
                isActive
                  ? "flex min-w-0 flex-col items-center gap-1 rounded-2xl px-1 py-1 text-rose-500"
                  : "flex min-w-0 flex-col items-center gap-1 rounded-2xl px-1 py-1 text-gray-500"
              }
            >
              <span className="text-lg">{link.icon}</span>
              <span className="max-w-full truncate">{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
