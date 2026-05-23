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

type Couple = {
  id: string;
};

type NotificationSettings = Record<string, boolean>;

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

const notificationOptions = [
  ["chat", "Чат"],
  ["questions", "Вопросы"],
  ["quizzes", "Викторины"],
  ["goals", "Цели"],
  ["reactions", "Реакции"],
] as const;

const defaultNotificationSettings = Object.fromEntries(
  notificationOptions.map(([key]) => [key, true]),
) as NotificationSettings;

const timeZoneOptions = [
  "Europe/Moscow",
  "Europe/Kyiv",
  "Europe/Berlin",
  "Asia/Tbilisi",
  "Asia/Almaty",
  "America/New_York",
  "America/Los_Angeles",
];

function normalizeSettings(value: unknown): NotificationSettings {
  if (!value || typeof value !== "object") return defaultNotificationSettings;
  return { ...defaultNotificationSettings, ...(value as NotificationSettings) };
}

export default function SettingsPage() {
  const theme = getPageTheme("/profile");
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [notificationSettings, setNotificationSettings] =
    useState<NotificationSettings>(defaultNotificationSettings);
  const [timeZone, setTimeZone] = useState("Europe/Moscow");
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    async function loadSettings() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setIsSignedIn(Boolean(user));
      if (!user) return;

      setUserId(user.id);

      const { data: couple } = await supabase
        .from("couples")
        .select("id")
        .or(`partner_one_id.eq.${user.id},partner_two_id.eq.${user.id}`)
        .limit(1)
        .maybeSingle<Couple>();

      if (!couple) return;
      setCoupleId(couple.id);

      const [{ data: profileData }, { data: settingsData }] = await Promise.all([
        supabase
          .from("couple_profiles")
          .select("time_zone")
          .eq("couple_id", couple.id)
          .limit(1)
          .maybeSingle<{ time_zone: string | null }>(),
        supabase
          .from("user_notification_settings")
          .select("settings")
          .eq("couple_id", couple.id)
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle<{ settings: NotificationSettings | null }>(),
      ]);

      setTimeZone(profileData?.time_zone || "Europe/Moscow");
      setNotificationSettings(normalizeSettings(settingsData?.settings));
    }

    loadSettings();
  }, []);

  async function saveNotificationSettings(next: NotificationSettings) {
    if (!userId || !coupleId) return;

    const { error } = await supabase.from("user_notification_settings").upsert(
      {
        user_id: userId,
        couple_id: coupleId,
        settings: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "couple_id,user_id" },
    );

    setSaveMessage(error ? "Не удалось сохранить уведомления." : "Настройки сохранены.");
  }

  function toggleNotification(key: string) {
    setNotificationSettings((current) => {
      const next = { ...current, [key]: !current[key] };
      void saveNotificationSettings(next);
      return next;
    });
  }

  async function updateTimeZone(value: string) {
    setTimeZone(value);
    if (!coupleId) return;

    const { error } = await supabase
      .from("couple_profiles")
      .update({ time_zone: value })
      .eq("couple_id", coupleId);

    setSaveMessage(error ? "Не удалось сохранить таймзону." : "Таймзона пары сохранена.");
  }

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
          <>
            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
              <section className="rounded-[1.5rem] border border-white/55 bg-white/62 p-5 shadow-inner backdrop-blur-xl dark:border-white/10 dark:bg-white/8">
                <p className="text-xl font-black">Настройки уведомлений</p>
                <p className="mt-2 text-sm font-bold opacity-65">
                  Эти переключатели сохраняются в профиле пары и будут работать после входа с другого устройства.
                </p>
                <div className="mt-4 grid gap-2">
                  {notificationOptions.map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleNotification(key)}
                      className="flex items-center justify-between rounded-2xl bg-white/65 px-4 py-3 font-black shadow-inner dark:bg-white/10"
                    >
                      <span>{label}</span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs text-white ${
                          notificationSettings[key] ? "bg-emerald-600" : "bg-slate-400"
                        }`}
                      >
                        {notificationSettings[key] ? "вкл" : "выкл"}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-[1.5rem] border border-white/55 bg-white/62 p-5 shadow-inner backdrop-blur-xl dark:border-white/10 dark:bg-white/8">
                <p className="text-xl font-black">Таймзона пары</p>
                <p className="mt-2 text-sm font-bold opacity-65">
                  Вопрос дня и отметка “сегодня” будут считаться в выбранной таймзоне.
                </p>
                <select
                  value={timeZone}
                  onChange={(event) => updateTimeZone(event.target.value)}
                  className="mt-4 h-12 w-full rounded-2xl border border-white/55 bg-white/75 px-4 font-black outline-none dark:border-white/10 dark:bg-black/20"
                >
                  {timeZoneOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <p className="mt-3 text-sm font-black opacity-60">Сейчас выбрано: {timeZone}</p>
                {saveMessage && <p className="mt-3 text-sm font-black opacity-70">{saveMessage}</p>}
              </section>
            </div>

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
          </>
        )}
      </section>
    </main>
  );
}
