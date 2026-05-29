import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import Navbar from "@/components/Navbar";
import MobileNav from "@/components/MobileNav";
import ThemeToggle from "@/components/ThemeToggle";
import AppBreadcrumbs from "@/components/AppBreadcrumbs";
import AppToast from "@/components/AppToast";
import AnimeRuntime from "@/components/AnimeRuntime";
import ClientRouteRecovery from "@/components/ClientRouteRecovery";

const initialAppearanceScript = `
  (function () {
    try {
      var root = document.documentElement;
      var theme = localStorage.getItem("theme");
      if (theme === "dark") {
        root.classList.add("dark");
        root.style.colorScheme = "dark";
      } else {
        root.classList.remove("dark");
        root.style.colorScheme = "light";
      }

      var density = localStorage.getItem("couple-space:density");
      root.classList.toggle("app-compact", density === "compact");

      var path = window.location.pathname;
      var accent = "#1c8b59";
      if (path === "/" || path.indexOf("/today") === 0) accent = "#ea580c";
      else if (path.indexOf("/dashboard") === 0) accent = localStorage.getItem("couple-space:dashboard:active-accent") || "#dc2626";
      else if (path.indexOf("/profile") === 0) accent = "#92400e";
      else if (path.indexOf("/memories") === 0) accent = "#2563eb";
      else if (path.indexOf("/questions") === 0) accent = "#27ae60";
      else if (path.indexOf("/quizzes") === 0) accent = "#7c3aed";
      else if (path.indexOf("/watch") === 0) accent = "#65a30d";
      else if (path.indexOf("/tracker") === 0) accent = "#ca8a04";
      else if (path.indexOf("/calendar") === 0) accent = "#0891b2";
      else if (path.indexOf("/chat") === 0) accent = "#0284c7";
      else if (path.indexOf("/login") === 0) accent = "#be123c";
      root.style.setProperty("--scroll-accent", accent);
    } catch (e) {}
  })();
`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Couple Space",
    template: "%s | Couple Space",
  },
  description:
    "Личное пространство для пары: вопросы дня, воспоминания, викторины, чат и трекер совместных событий.",
  applicationName: "Couple Space",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: initialAppearanceScript }} />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-white text-gray-800 dark:bg-gray-900 dark:text-gray-100"
      >
        <ThemeToggle />
        <Navbar />
        <AppBreadcrumbs />
        {children}
        <MobileNav />
        <AppToast />
        <AnimeRuntime />
        <ClientRouteRecovery />
      </body>
    </html>
  );
}
