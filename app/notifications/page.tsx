"use client";

import EmptyState from "@/components/EmptyState";
import NavIcon from "@/components/NavIcon";
import { FluentEmojiText } from "@/components/FluentEmoji";
import type { NavIconName } from "@/lib/navigation";
import { getPageTheme } from "@/lib/pageThemes";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type CoupleNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

type Couple = {
  id: string;
};

const filters = [
  { key: "all", label: "Все" },
  { key: "unread", label: "Новые" },
  { key: "questions", label: "Вопросы" },
  { key: "chat", label: "Чат" },
  { key: "reactions", label: "Реакции" },
] as const;

const defaultNotificationSettings = {
  chat: true,
  questions: true,
  goals: true,
  reactions: true,
};

function formatTime(date: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function getIcon(type: string): NavIconName {
  if (type.includes("question")) return "questions";
  if (type.includes("chat")) return "chat";
  if (type.includes("memory")) return "memories";
  if (type.includes("tracker")) return "tracker";
  return "notifications";
}

function getTypeLabel(type: string) {
  if (type.includes("reaction")) return "Реакция";
  if (type.includes("comment")) return "Комментарий";
  if (type.includes("question")) return "Вопрос";
  if (type.includes("chat")) return "Чат";
  if (type.includes("memory")) return "Воспоминание";
  if (type.includes("tracker")) return "Трекер";
  return "Событие";
}

export default function NotificationsPage() {
  const theme = getPageTheme("/dashboard");
  const [items, setItems] = useState<CoupleNotification[]>([]);
  const [filter, setFilter] = useState<(typeof filters)[number]["key"]>("all");
  const [enabledCategories, setEnabledCategories] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    async function loadNotifications() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data: couple } = await supabase
        .from("couples")
        .select("id")
        .or(`partner_one_id.eq.${user.id},partner_two_id.eq.${user.id}`)
        .limit(1)
        .maybeSingle<Couple>();

      if (couple) {
        const { data: settingsData } = await supabase
          .from("user_notification_settings")
          .select("settings")
          .eq("couple_id", couple.id)
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle<{ settings: Record<string, boolean> | null }>();

        setEnabledCategories({
          ...defaultNotificationSettings,
          ...(settingsData?.settings || {}),
        });
      } else {
        setEnabledCategories(defaultNotificationSettings);
      }

      const { data } = await supabase
        .from("couple_notifications")
        .select("id, type, title, body, href, read_at, created_at")
        .eq("recipient_id", user.id)
        .neq("type", "achievement_unlocked")
        .order("created_at", { ascending: false })
        .limit(80);

      setItems((data || []) as CoupleNotification[]);
      setIsLoading(false);
    }

    loadNotifications();
  }, []);

  const visibleItems = useMemo(() => {
    const categoryFiltered = items.filter((item) => {
      if (item.type.includes("chat")) return enabledCategories.chat !== false;
      if (item.type.includes("question")) return enabledCategories.questions !== false;
      if (item.type.includes("tracker")) return enabledCategories.goals !== false;
      if (item.type.includes("reaction") || item.type.includes("comment")) {
        return enabledCategories.reactions !== false;
      }
      return true;
    });

    if (filter === "unread") return categoryFiltered.filter((item) => !item.read_at);
    if (filter === "questions") return categoryFiltered.filter((item) => item.type.includes("question"));
    if (filter === "chat") return categoryFiltered.filter((item) => item.type.includes("chat"));
    if (filter === "reactions") {
      return categoryFiltered.filter((item) => item.type.includes("reaction") || item.type.includes("comment"));
    }
    return categoryFiltered;
  }, [enabledCategories, filter, items]);

  const groupedItems = useMemo(() => {
    return visibleItems.reduce<Array<{ label: string; rows: CoupleNotification[] }>>((groups, item) => {
      const label = new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(item.created_at));
      const current = groups.find((group) => group.label === label);
      if (current) {
        current.rows.push(item);
      } else {
        groups.push({ label, rows: [item] });
      }
      return groups;
    }, []);
  }, [visibleItems]);

  async function markAllRead() {
    const unreadIds = items.filter((item) => !item.read_at).map((item) => item.id);
    if (unreadIds.length === 0) return;

    const readAt = new Date().toISOString();
    setItems((current) =>
      current.map((item) => (unreadIds.includes(item.id) ? { ...item, read_at: readAt } : item))
    );

    await supabase.from("couple_notifications").update({ read_at: readAt }).in("id", unreadIds);
  }

  async function clearRead() {
    const readIds = items.filter((item) => item.read_at).map((item) => item.id);
    if (readIds.length === 0) return;

    setIsClearing(true);
    const previous = items;
    setItems((current) => current.filter((item) => !readIds.includes(item.id)));

    const { error } = await supabase.from("couple_notifications").delete().in("id", readIds);
    if (error) {
      setItems(previous);
    }
    setIsClearing(false);
  }

  return (
    <main className="min-h-screen bg-[#fff7fb] px-4 pb-28 pt-24 text-[#7f1d1d] dark:bg-[#130711] dark:text-white md:px-6 md:pt-28">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_10%,rgba(244,63,94,0.18),transparent_30%),radial-gradient(circle_at_88%_18%,rgba(251,113,133,0.14),transparent_28%),linear-gradient(135deg,#fff7fb_0%,#fff1f2_48%,#fff7ed_100%)] dark:bg-[radial-gradient(circle_at_18%_10%,rgba(244,63,94,0.15),transparent_30%),linear-gradient(135deg,#170711_0%,#230a18_48%,#120b08_100%)]" />

      <section className="mx-auto max-w-5xl">
        <div className="rounded-[2rem] border border-white/55 bg-white/58 p-5 shadow-[0_24px_90px_rgba(159,18,57,0.14)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/8 md:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] opacity-60">Центр событий</p>
              <h1 className="mt-2 text-4xl font-black md:text-5xl">Уведомления</h1>
            </div>
            <button
              onClick={markAllRead}
              className="rounded-full px-5 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5"
              style={{ backgroundColor: theme.accent }}
            >
              Отметить прочитанными
            </button>
            <button
              onClick={clearRead}
              disabled={isClearing || items.every((item) => !item.read_at)}
              className="rounded-full px-5 py-3 text-sm font-black shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
              style={{ backgroundColor: `${theme.accent}18`, color: theme.accent }}
            >
              Очистить прочитанные
            </button>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {filters.map((item) => (
              <button
                key={item.key}
                onClick={() => setFilter(item.key)}
                className="rounded-full px-4 py-2 text-sm font-black transition hover:-translate-y-0.5"
                style={{
                  backgroundColor: filter === item.key ? theme.accent : `${theme.accent}18`,
                  color: filter === item.key ? "#fff" : theme.accent,
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {isLoading ? (
            <div className="rounded-3xl bg-white/58 p-5 font-black shadow-inner backdrop-blur-xl dark:bg-white/8">
              Загружаем уведомления...
            </div>
          ) : visibleItems.length === 0 ? (
            <EmptyState
              icon="🔔"
              title="Уведомлений пока нет"
              text="Здесь появятся действия партнёра, новые достижения и важные события пары."
              actionHref="/dashboard"
              actionLabel="В кабинет"
              accent={theme.accent}
            />
          ) : (
            groupedItems.map((group) => (
              <section key={group.label}>
                <p className="mb-2 px-2 text-xs font-black uppercase tracking-[0.18em] opacity-45">
                  {group.label}
                </p>
                <div className="space-y-3">
                  {group.rows.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href || "/dashboard"}
                      className="block rounded-3xl border border-white/55 bg-white/62 p-4 shadow-inner backdrop-blur-xl transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-white/8"
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-xl text-white shadow-lg"
                          style={{ backgroundColor: theme.accent }}
                        >
                          <NavIcon name={getIcon(item.type)} className="h-8 w-8 bg-transparent shadow-none" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {!item.read_at && <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" />}
                            <p className="truncate font-black">{item.title}</p>
                            <span
                              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white"
                              style={{ backgroundColor: theme.accent }}
                            >
                              {getTypeLabel(item.type)}
                            </span>
                          </div>
                          {item.body && <p className="mt-1 line-clamp-2 text-sm font-bold opacity-65"><FluentEmojiText>{item.body}</FluentEmojiText></p>}
                          <p className="mt-2 text-xs font-black uppercase tracking-wide opacity-45">
                            {formatTime(item.created_at)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
