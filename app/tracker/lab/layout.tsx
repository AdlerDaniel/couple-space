import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Лаборатория трекера",
  description: "Экспериментальный совместный календарь и трекер Couple Space.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

export default function TrackerLabLayout({ children }: { children: React.ReactNode }) {
  return children;
}
