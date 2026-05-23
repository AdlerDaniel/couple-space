"use client";

import { useDashboardAccent } from "@/lib/useDashboardAccent";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

function getRouteAccent(pathname: string, dashboardAccent: string) {
  if (pathname === "/") return "#9f1239";
  if (pathname.startsWith("/dashboard")) return dashboardAccent;
  if (pathname.startsWith("/profile")) return "#92400e";
  if (pathname.startsWith("/memories")) return "#1a73e8";
  if (pathname.startsWith("/questions")) return "#27ae60";
  if (pathname.startsWith("/quizzes")) return "#7c3aed";
  if (pathname.startsWith("/tracker")) return "#d97706";
  if (pathname.startsWith("/chat")) return "#be123c";
  if (pathname.startsWith("/login")) return "#be123c";
  return "#1c8b59";
}

export default function ThemeToggle() {
  const pathname = usePathname();
  const dashboardAccent = useDashboardAccent();
  const [hasMounted, setHasMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const accent = getRouteAccent(pathname, dashboardAccent);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    queueMicrotask(() => {
      setHasMounted(true);
      setIsDark(savedTheme === "dark");
    });
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--scroll-accent", accent);
  }, [accent]);

  function toggleTheme() {
    const newTheme = !isDark;

    setIsDark(newTheme);

    if (newTheme) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }

  if (!hasMounted) return null;

  return (
    <button
      onClick={toggleTheme}
      style={{
        background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
        boxShadow: `0 16px 42px ${accent}45`,
      }}
      className="fixed right-4 top-4 z-50 rounded-full px-4 py-2 text-white shadow-lg transition hover:-translate-y-0.5 hover:brightness-110"
      aria-label="Переключить тему"
    >
      {isDark ? "☀️" : "🌙"}
    </button>
  );
}
