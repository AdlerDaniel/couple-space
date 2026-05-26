import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Календарь",
  description: "События пары по дням: вопросы, цели, фильмы и воспоминания.",
};

export default function CalendarLayout({ children }: { children: ReactNode }) {
  return children;
}
