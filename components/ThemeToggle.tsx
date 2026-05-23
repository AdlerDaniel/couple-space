"use client";

import { useDashboardAccent } from "@/lib/useDashboardAccent";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

function getRouteAccent(pathname: string, dashboardAccent: string) {
  if (pathname === "/") return "#ea580c";
  if (pathname.startsWith("/dashboard")) return dashboardAccent;
  if (pathname.startsWith("/profile")) return "#92400e";
  if (pathname.startsWith("/memories")) return "#2563eb";
  if (pathname.startsWith("/questions")) return "#27ae60";
  if (pathname.startsWith("/quizzes")) return "#7c3aed";
  if (pathname.startsWith("/tracker")) return "#ca8a04";
  if (pathname.startsWith("/chat")) return "#0284c7";
  if (pathname.startsWith("/login")) return "#be123c";
  return "#1c8b59";
}

export default function ThemeToggle() {
  const pathname = usePathname();
  const dashboardAccent = useDashboardAccent();
  const accent = getRouteAccent(pathname, dashboardAccent);

  useEffect(() => {
    document.documentElement.style.setProperty("--scroll-accent", accent);
  }, [accent]);

  return null;
}
