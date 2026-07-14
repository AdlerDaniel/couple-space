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
      lang="ru"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-white text-gray-800 dark:bg-gray-900 dark:text-gray-100"
      >
        <ThemeToggle />
        <Navbar />
        <AppBreadcrumbs />
        <div className="app-desktop-content min-w-0 flex-1">{children}</div>
        <MobileNav />
        <AppToast />
        <AnimeRuntime />
        <ClientRouteRecovery />
      </body>
    </html>
  );
}
