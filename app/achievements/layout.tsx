import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Достижения | Couple Space",
  description: "Прогресс достижений пары.",
};

export default function AchievementsLayout({ children }: { children: ReactNode }) {
  return children;
}
