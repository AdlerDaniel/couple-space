import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Сегодня",
  description: "Рабочий экран пары на сегодня.",
};

export default function TodayLayout({ children }: { children: ReactNode }) {
  return children;
}
