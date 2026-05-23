import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Кабинет",
  description: "Статус пары, достижения, активность и настройки общего пространства.",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
