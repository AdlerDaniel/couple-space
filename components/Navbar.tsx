"use client";

import { supabase } from "@/lib/supabaseClient";
import { useDashboardAccent } from "@/lib/useDashboardAccent";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null); // null = ещё проверка

  const dashboardAccent = useDashboardAccent();

  useEffect(() => {
    async function checkUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setIsLoggedIn(!!user);
    }
    checkUser();
  }, []);

  const isLogin = pathname.startsWith("/login");
  const isHome = pathname === "/";
  const isMemories = pathname.startsWith("/memories");
  const isQuestions = pathname.startsWith("/questions");
  const isQuizzes = pathname.startsWith("/quizzes");
  const isDashboard = pathname.startsWith("/dashboard");
  const homeAccent = "#9f1239";

  const accent = isLogin
    ? "#f3f4f6"
    : isHome
      ? homeAccent
      : isMemories
        ? "#1a73e8"
        : isQuestions
          ? "#27ae60"
          : isQuizzes
            ? "#7c3aed"
            : isDashboard
              ? dashboardAccent
              : "#1c8b59";
  const navStyle =
    isHome
      ? {
          background:
            "linear-gradient(135deg, rgba(159, 18, 57, 0.2), rgba(192, 38, 211, 0.16))",
          borderColor: "rgba(159, 18, 57, 0.24)",
          boxShadow: "0 18px 58px rgba(159, 18, 57, 0.2)",
        }
      : isDashboard && !isLogin
      ? {
          backgroundColor: `${dashboardAccent}24`,
          borderColor: `${dashboardAccent}55`,
          boxShadow: `0 12px 40px ${dashboardAccent}33`,
        }
      : undefined;

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <header className="fixed left-0 top-0 z-10 w-full px-6 py-4">
      <nav
        style={navStyle}
        className="mx-auto flex max-w-6xl items-center justify-between rounded-full border border-white/30 bg-white/35 px-6 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-colors dark:border-white/10 dark:bg-black/25 dark:shadow-black/40"
      >
        <Link
          href="/"
          style={!isLogin ? { color: accent } : undefined}
          className={`text-xl font-bold transition opacity-90 hover:opacity-100 ${
            isLogin ? "text-gray-800 dark:text-gray-100" : ""
          }`}
        >
          ❤️ Couple Space
        </Link>

        <div className="hidden gap-6 md:flex">
          {[
            ["Главная", "/"],
            ["Кабинет", "/dashboard"],
            ["Воспоминания", "/memories"],
            ["Вопросы", "/questions"],
            ["Викторины", "/quizzes"],
          ].map(([label, href]) => (
            <Link
              key={href}
              href={href}
              style={!isLogin ? { color: accent } : undefined}
              className={`transition opacity-80 hover:opacity-100 ${
                isLogin ? "text-gray-700 dark:text-gray-200" : ""
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Кнопка логина/выхода или skeleton */}
        {isLoggedIn === null ? (
          <div
  className="h-10 w-28 rounded-full animate-pulse"
  style={{
    backgroundColor: isLogin
      ? "#f3f4f6"
      : isHome
        ? "#dc2626"
        : isMemories
          ? "#1a73e8"
        : isQuestions
          ? "#27ae60"
          : isQuizzes
            ? "#7c3aed"
            : isDashboard
              ? dashboardAccent
              : "#1c8b59",
  }}
/>
        ) : isLoggedIn ? (
          <button
            onClick={logout}
            style={!isLogin ? { backgroundColor: accent } : undefined}
            className={`rounded-full px-5 py-2 font-semibold shadow-lg transition hover:opacity-90 ${
              isLogin
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "text-white"
            }`}
          >
            Выйти
          </button>
        ) : (
          <Link
            href="/login"
            style={!isLogin ? { backgroundColor: accent } : undefined}
            className={`rounded-full px-5 py-2 font-semibold shadow-lg transition hover:opacity-90 ${
              isLogin
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "text-white"
            }`}
          >
            Войти
          </Link>
        )}
      </nav>
    </header>
  );
}
