"use client";

import { useDashboardAccent } from "@/lib/useDashboardAccent";
import { getPageTheme } from "@/lib/pageThemes";
import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";

export default function ThemeToggle() {
  const pathname = usePathname();
  const dashboardAccent = useDashboardAccent();
  const accent = getPageTheme(pathname, dashboardAccent).accent;

  useLayoutEffect(() => {
    const root = document.documentElement;
    const isDark = localStorage.getItem("theme") === "dark";

    root.classList.toggle("dark", isDark);
    root.classList.remove("app-compact");
    root.style.colorScheme = isDark ? "dark" : "light";
    root.style.setProperty("--scroll-accent", accent);
    document.body.classList.remove("app-compact");
    localStorage.removeItem("couple-space:density");
  }, [accent]);

  return null;
}
