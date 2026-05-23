import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Настройки",
  description: "Управление аккаунтом, парой, уведомлениями и выходом.",
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
