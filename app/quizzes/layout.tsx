import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Викторины",
  description: "Совместные тесты с отдельными ответами, прогрессом и сравнением результатов.",
};

export default function QuizzesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
