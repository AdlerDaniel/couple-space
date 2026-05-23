import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Вопросы",
  description: "Вопрос дня, ответы партнёров, реакции и архив прошлых обсуждений.",
};

export default function QuestionsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
