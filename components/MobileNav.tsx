"use client";

import { notificationsUpdatedEventName } from "@/lib/notifications";
import { getPageTheme } from "@/lib/pageThemes";
import { supabase } from "@/lib/supabaseClient";
import { useDashboardAccent } from "@/lib/useDashboardAccent";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type CoupleNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

const mainLinks = [
  {
    href: "/",
    label: "Главная",
    icon: "⌂",
  },
  {
    href: "/questions",
    label: "Вопросы",
    icon: "✉",
  },
  {
    href: "/quizzes",
    label: "Викторины",
    icon: "✦",
  },
  {
    href: "/chat",
    label: "Чат",
    icon: "◌",
  },
];

const moreLinks = [
  {
    href: "/dashboard",
    label: "Кабинет",
    icon: "♡",
  },
  {
    href: "/memories",
    label: "Воспоминания",
    icon: "▣",
  },
  {
    href: "/tracker",
    label: "Трекер",
    icon: "◫",
  },
  {
    href: "/profile",
    label: "Профиль",
    icon: "◉",
  },
  {
    href: "/settings",
    label: "Настройки",
    icon: "⚙",
  },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getNotificationIcon(type: string) {
  if (type === "achievement_unlocked") return "🏆";
  if (type.includes("question")) return "✉";
  if (type.includes("quiz")) return "✦";
  if (type.includes("chat")) return "◌";
  if (type.includes("memory")) return "▣";
  return "♡";
}

function formatNotificationTime(date: string) {
  const diffMs = Date.now() - new Date(date).getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));

  if (minutes < 60) return `${minutes} мин назад`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;

  const days = Math.floor(hours / 24);
  return `${days} дн назад`;
}

export default function MobileNav() {
  const pathname = usePathname();
  const dashboardAccent = useDashboardAccent();
  const accent = getPageTheme(pathname, dashboardAccent).accent;
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<CoupleNotification[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadNotifications(userId: string) {
      const { data } = await supabase
        .from("couple_notifications")
        .select("id, type, title, body, href, read_at, created_at")
        .eq("recipient_id", userId)
        .order("created_at", { ascending: false })
        .limit(12);

      if (!ignore) {
        setNotifications((data || []) as CoupleNotification[]);
      }
    }

    async function checkUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setCurrentUserId(null);
        setNotifications([]);
        return;
      }

      setCurrentUserId(user.id);
      await loadNotifications(user.id);
    }

    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsNotificationsOpen(false);
      setIsMoreOpen(false);
      window.setTimeout(() => {
        if (session?.user) {
          setCurrentUserId(session.user.id);
          loadNotifications(session.user.id);
        } else {
          setCurrentUserId(null);
          setNotifications([]);
        }
      }, 0);
    });

    window.addEventListener(notificationsUpdatedEventName, checkUser);

    return () => {
      ignore = true;
      window.removeEventListener(notificationsUpdatedEventName, checkUser);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`mobile-couple-notifications:${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "couple_notifications",
          filter: `recipient_id=eq.${currentUserId}`,
        },
        async () => {
          const { data } = await supabase
            .from("couple_notifications")
            .select("id, type, title, body, href, read_at, created_at")
            .eq("recipient_id", currentUserId)
            .order("created_at", { ascending: false })
            .limit(12);

          setNotifications((data || []) as CoupleNotification[]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  if (
    pathname.startsWith("/chat") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/logout")
  ) {
    return null;
  }

  const unreadNotifications = notifications.filter((notification) => !notification.read_at).length;

  async function openNotifications() {
    const nextIsOpen = !isNotificationsOpen;
    setIsNotificationsOpen(nextIsOpen);
    setIsMoreOpen(false);

    if (!nextIsOpen || !currentUserId) return;

    const unreadIds = notifications
      .filter((notification) => !notification.read_at)
      .map((notification) => notification.id);

    if (unreadIds.length === 0) return;

    const readAt = new Date().toISOString();
    setNotifications((current) =>
      current.map((notification) =>
        unreadIds.includes(notification.id)
          ? { ...notification, read_at: readAt }
          : notification
      )
    );

    await supabase
      .from("couple_notifications")
      .update({ read_at: readAt })
      .in("id", unreadIds)
      .eq("recipient_id", currentUserId);
  }

  return (
    <>
      {isNotificationsOpen && (
        <div
          className="fixed bottom-24 left-3 right-3 z-40 overflow-hidden rounded-[1.4rem] border bg-white/92 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl dark:bg-black/84"
          style={{
            borderColor: `${accent}55`,
            color: accent,
          }}
        >
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wide opacity-55">
                Уведомления
              </p>
              <p className="mt-1 text-sm font-bold opacity-70">Новые события пары</p>
            </div>
            {notifications.length > 0 && (
              <span
                className="rounded-full px-3 py-1 text-xs font-black text-white shadow-lg"
                style={{ backgroundColor: accent }}
              >
                {notifications.length}
              </span>
            )}
          </div>

          <div className="max-h-[48vh] overflow-y-auto px-2 pb-2">
            {notifications.length === 0 ? (
              <div className="rounded-2xl bg-white/70 px-4 py-5 text-sm font-bold opacity-70 shadow-inner dark:bg-white/10">
                Пока уведомлений нет.
              </div>
            ) : (
              notifications.map((notification) => (
                <Link
                  key={notification.id}
                  href={notification.href || "/dashboard"}
                  onClick={() => setIsNotificationsOpen(false)}
                  className="mb-2 block rounded-2xl bg-white/72 px-4 py-3 shadow-inner transition hover:bg-black/5 dark:bg-white/10 dark:hover:bg-white/15"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg"
                      style={{ backgroundColor: `${accent}18` }}
                    >
                      {getNotificationIcon(notification.type)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {!notification.read_at && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-[#ef4444] shadow-[0_0_14px_rgba(239,68,68,0.75)]" />
                        )}
                        <p className="truncate font-black">{notification.title}</p>
                      </div>
                      {notification.body && (
                        <p className="mt-1 line-clamp-2 text-sm font-semibold opacity-68">
                          {notification.body}
                        </p>
                      )}
                      <p className="mt-2 text-xs font-black opacity-45">
                        {formatNotificationTime(notification.created_at)}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}

      {isMoreOpen && (
        <div
          className="fixed bottom-20 left-3 right-3 z-40 rounded-[1.4rem] border bg-white/94 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl dark:bg-black/86"
          style={{
            borderColor: `${accent}55`,
            color: accent,
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={openNotifications}
              className="relative flex items-center gap-3 rounded-2xl bg-white/72 px-3 py-3 text-left font-black shadow-inner dark:bg-white/10"
            >
              <span className="text-xl">🔔</span>
              <span>Уведомления</span>
              {unreadNotifications > 0 && (
                <span className="ml-auto rounded-full bg-[#ef4444] px-2 py-0.5 text-xs text-white">
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              )}
            </button>
            {moreLinks.map((link) => {
              const isActive = isActivePath(pathname, link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMoreOpen(false)}
                  style={isActive ? { backgroundColor: accent } : undefined}
                  className={
                    isActive
                      ? "flex min-w-0 items-center gap-3 rounded-2xl px-3 py-3 font-black text-white shadow-lg"
                      : "flex min-w-0 items-center gap-3 rounded-2xl bg-white/72 px-3 py-3 font-black shadow-inner dark:bg-white/10"
                  }
                >
                  <span className="text-xl">{link.icon}</span>
                  <span className="truncate">{link.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <nav
        style={{
          background: `linear-gradient(135deg, ${accent}48, ${accent}36 52%, ${accent}2b)`,
          borderColor: `${accent}85`,
          boxShadow: `0 18px 48px ${accent}3f`,
        }}
        className="fixed bottom-2 left-2 right-2 z-40 rounded-[1.1rem] border px-1 py-1 shadow-2xl backdrop-blur-2xl md:hidden"
      >
        <div className="grid grid-cols-5 items-stretch gap-1 text-center text-[10px] font-black leading-tight min-[380px]:text-[11px]">
          {mainLinks.map((link) => {
            const isActive = isActivePath(pathname, link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                style={
                  isActive
                    ? { color: "#ffffff", backgroundColor: accent }
                    : { color: accent }
                }
                className={
                  isActive
                    ? "flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1 shadow-lg"
                    : "flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl bg-white/72 px-0.5 py-1 opacity-100 shadow-inner dark:bg-black/30"
                }
              >
                <span className="text-base leading-none min-[380px]:text-lg">{link.icon}</span>
                <span className="max-w-full truncate whitespace-nowrap">{link.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setIsMoreOpen((current) => !current);
              setIsNotificationsOpen(false);
            }}
            style={
              isMoreOpen
                ? { color: "#ffffff", backgroundColor: accent }
                : { color: accent }
            }
            className={
              isMoreOpen
                ? "relative flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1 shadow-lg"
                : "relative flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl bg-white/72 px-0.5 py-1 opacity-100 shadow-inner dark:bg-black/30"
            }
            aria-label="Открыть дополнительные разделы"
          >
            <span className="text-base leading-none min-[380px]:text-lg">☰</span>
            <span className="max-w-full truncate whitespace-nowrap">Ещё</span>
            {unreadNotifications > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-[#ef4444] px-1 text-[9px] font-black leading-none text-white shadow-[0_0_14px_rgba(239,68,68,0.8)] ring-2 ring-white">
                {unreadNotifications > 9 ? "9+" : unreadNotifications}
              </span>
            )}
          </button>
        </div>
      </nav>
    </>
  );
}
