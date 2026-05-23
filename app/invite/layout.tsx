import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Приглашение | Couple Space",
  description: "Присоединение к паре по invite-коду.",
};

export default function InviteLayout({ children }: { children: ReactNode }) {
  return children;
}
