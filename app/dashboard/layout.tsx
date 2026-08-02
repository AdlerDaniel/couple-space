import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Кабинет",
  description: "Статус пары, активность и настройки общего пространства.",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
