import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Трекер",
  description: "Совместные события, цели пары, статистика и история активности.",
};

export default function TrackerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
