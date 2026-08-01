import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Отсчёт",
  description: "Общие таймеры пары до путешествий, встреч, праздников и других важных событий.",
};

export default function CountdownLayout({ children }: { children: React.ReactNode }) {
  return children;
}
