import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Вход",
  description: "Вход и регистрация в Couple Space.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
