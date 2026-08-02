import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Обсуждение вопроса | Couple Space",
  description: "Личный разговор пары о вопросе дня.",
};

export default function QuestionDiscussionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
