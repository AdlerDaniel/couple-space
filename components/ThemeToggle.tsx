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
    const isCompact = localStorage.getItem("couple-space:density") === "compact";

    root.classList.toggle("dark", isDark);
    root.classList.toggle("app-compact", isCompact);
    root.style.colorScheme = isDark ? "dark" : "light";
    root.style.setProperty("--scroll-accent", accent);
    document.body.classList.toggle("app-compact", isCompact);
  }, [accent]);

  return null;
}
