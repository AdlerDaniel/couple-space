import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

import Navbar from "@/components/Navbar";
import MobileNav from "@/components/MobileNav";
import ThemeToggle from "@/components/ThemeToggle";

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
      <body className="min-h-full flex flex-col bg-white text-gray-800 transition-colors dark:bg-gray-900 dark:text-gray-100">
        <Script id="theme-init" strategy="beforeInteractive">
          {`
            try {
              const theme = localStorage.getItem("theme");
              if (theme === "dark") {
                document.documentElement.classList.add("dark");
              }
            } catch (e) {}
          `}
        </Script>
        <ThemeToggle />
        <Navbar />
        {children}
        <MobileNav />
      </body>
    </html>
  );
}
