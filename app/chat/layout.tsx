import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Чат",
  description: "Личный чат пары с сообщениями, медиа, реакциями и закреплёнными моментами.",
};

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return children;
}
