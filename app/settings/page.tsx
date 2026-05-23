"use client";

import EmptyState from "@/components/EmptyState";
import { getPageTheme } from "@/lib/pageThemes";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useEffect, useState } from "react";

type SettingsSection = {
  id: string;
  title: string;
  text: string;
  href?: string;
};

const sections: SettingsSection[] = [
  {
    id: "account",
    title: "Аккаунт",
    text: "Имя, фотография и данные профиля.",
    href: "/profile",
  },
  {
    id: "couple",
    title: "Пара",
    text: "Создание пары, invite-код и управление связью.",
    href: "/profile",
  },
  {
    id: "privacy",
    title: "Приватность",
    text: "Подтверждение удаления, выход из пары и контроль общих данных.",
  },
  {
    id: "notifications",
    title: "Уведомления",
    text: "История событий, достижения и действия партнёра.",
    href: "/notifications",
  },
  {
    id: "media",
    title: "Медиа и хранилище",
    text: "Сжатие фото, голосовые ответы и вложения.",
  },
  {
    id: "session",
    title: "Сессия",
    text: "Выход из аккаунта на этом устройстве.",
    href: "/logout",
  },
];

export default function SettingsPage() {
  const theme = getPageTheme("/profile");
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setIsSignedIn(Boolean(user));
    }

    loadUser();
  }, []);

  return (
    <main className="min-h-screen bg-[#fff7ed] px-4 pb-28 pt-24 text-[#7c2d12] dark:bg-[#120907] dark:text-white md:px-6 md:pt-28">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_10%,rgba(146,64,14,0.20),transparent_30%),radial-gradient(circle_at_88%_18%,rgba(180,83,9,0.14),transparent_28%),linear-gradient(135deg,#fff7ed_0%,#ffedd5_46%,#fef3c7_100%)] dark:bg-[radial-gradient(circle_at_18%_10%,rgba(146,64,14,0.15),transparent_30%),linear-gradient(135deg,#170b05_0%,#211007_48%,#0d0603_100%)]" />

      <section className="mx-auto max-w-5xl">
        <div className="rounded-[2rem] border border-white/55 bg-white/58 p-5 shadow-[0_24px_90px_rgba(146,64,14,0.14)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/8 md:p-7">
          <p className="text-sm font-black uppercase tracking-[0.2em] opacity-60">Настройки</p>
          <h1 className="mt-2 text-4xl font-black md:text-5xl">Управление сайтом</h1>
          <p className="mt-3 max-w-2xl font-bold opacity-65">
            Основные настройки аккаунта, пары, уведомлений и выхода собраны в одном месте.
          </p>
        </div>

        {isSignedIn === false ? (
          <div className="mt-5">
            <EmptyState
              icon="●"
              title="Нужно войти"
              text="Настройки доступны только авторизованному пользователю."
              actionHref="/login"
              actionLabel="Войти"
              accent={theme.accent}
            />
          </div>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {sections.map((section) => {
              const content = (
                <div className="h-full rounded-[1.5rem] border border-white/55 bg-white/62 p-5 shadow-inner backdrop-blur-xl transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-white/8">
                  <p className="text-xl font-black">{section.title}</p>
                  <p className="mt-2 text-sm font-bold opacity-65">{section.text}</p>
                  <p className="mt-4 text-sm font-black" style={{ color: theme.accent }}>
                    {section.href ? "Открыть" : "Скоро будет доступно"}
                  </p>
                </div>
              );

              return section.href ? (
                <Link key={section.id} href={section.href}>
                  {content}
                </Link>
              ) : (
                <div key={section.id}>{content}</div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
