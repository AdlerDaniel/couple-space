import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Воспоминания",
  description: "Фото, даты, подписи, реакции и комментарии к общим моментам пары.",
};

export default function MemoriesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
