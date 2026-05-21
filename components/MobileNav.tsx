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
      className="fixed bottom-4 left-4 right-4 z-20 rounded-full border border-transparent bg-white/90 px-4 py-3 shadow-2xl backdrop-blur md:hidden"
    >
      <div className="flex items-center justify-around text-xs font-semibold">
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
                  ? "flex flex-col items-center gap-1 text-rose-500"
                  : "flex flex-col items-center gap-1 text-gray-500"
              }
            >
              <span className="text-xl">{link.icon}</span>
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
