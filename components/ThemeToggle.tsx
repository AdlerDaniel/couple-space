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
    document.documentElement.style.setProperty("--scroll-accent", accent);
  }, [accent]);

  return null;
}
