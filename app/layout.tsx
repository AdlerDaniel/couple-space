import type { Metadata, Viewport } from "next";
import { Geist_Mono, Manrope } from "next/font/google";
import "./globals.css";
import "./mobile-redesign.css";

import AppShell from "@/components/AppShell";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["cyrillic", "latin"],
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
    "Личное пространство для пары: вопросы дня, воспоминания, фильмы и трекер совместных событий.",
  applicationName: "Couple Space",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f8f4" },
    { media: "(prefers-color-scheme: dark)", color: "#111827" },
  ],
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
      className={`${manrope.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-white text-gray-800 dark:bg-gray-900 dark:text-gray-100"
      >
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
