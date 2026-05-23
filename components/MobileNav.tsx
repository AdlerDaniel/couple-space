"use client";

import { useDashboardAccent } from "@/lib/useDashboardAccent";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  {
    href: "/",
    label: "Главная",
    icon: "⌂",
  },
  {
    href: "/dashboard",
    label: "Кабинет",
    icon: "♡",
  },
  {
    href: "/memories",
    label: "Воспоминания",
    icon: "▣",
  },
  {
    href: "/questions",
    label: "Вопросы",
    icon: "✉",
  },
  {
    href: "/quizzes",
    label: "Викторины",
    icon: "✦",
  },
  {
    href: "/chat",
    label: "Чат",
    icon: "◌",
  },
];

function getRouteAccent(pathname: string, dashboardAccent: string) {
  if (pathname === "/") return "#9f1239";
  if (pathname.startsWith("/dashboard")) return dashboardAccent;
  if (pathname.startsWith("/profile")) return "#92400e";
  if (pathname.startsWith("/memories")) return "#1a73e8";
  if (pathname.startsWith("/questions")) return "#27ae60";
  if (pathname.startsWith("/quizzes")) return "#7c3aed";
  if (pathname.startsWith("/chat")) return "#be123c";
  if (pathname.startsWith("/login")) return "#be123c";
  return "#1c8b59";
}

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function MobileNav() {
  const pathname = usePathname();
  const dashboardAccent = useDashboardAccent();
  const accent = getRouteAccent(pathname, dashboardAccent);

  if (pathname.startsWith("/chat")) return null;

  return (
    <nav
      style={{
        background: `linear-gradient(135deg, ${accent}30, ${accent}1f 52%, ${accent}14)`,
        borderColor: `${accent}66`,
        boxShadow: `0 18px 48px ${accent}2e`,
      }}
      className="fixed bottom-3 left-3 right-3 z-40 rounded-[1.35rem] border px-1.5 py-1.5 shadow-2xl backdrop-blur-2xl md:hidden"
    >
      <div className="grid grid-cols-6 items-start text-center text-[7px] font-bold leading-tight">
        {links.map((link) => {
          const isActive = isActivePath(pathname, link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              style={
                isActive
                  ? { color: accent, backgroundColor: `${accent}18` }
                  : { color: `${accent}cc` }
              }
              className={
                isActive
                  ? "flex min-w-0 flex-col items-center gap-0.5 rounded-2xl px-0.5 py-1 shadow-inner"
                  : "flex min-w-0 flex-col items-center gap-0.5 rounded-2xl px-0.5 py-1 opacity-80"
              }
            >
              <span className="text-base leading-none">{link.icon}</span>
              <span className="max-w-full whitespace-nowrap">{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
