import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Профиль",
  description: "Профиль пользователя, данные пары, аватары и дата начала отношений.",
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
