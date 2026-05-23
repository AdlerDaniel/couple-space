import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Уведомления",
  description: "Центр событий пары: ответы, реакции, достижения и активность.",
};

export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
