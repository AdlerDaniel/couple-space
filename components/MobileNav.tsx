"use client";

import { notificationsUpdatedEventName } from "@/lib/notifications";
import {
  accountNavLinks,
  isActivePath,
  mobileMainLinks,
  mobileMoreLinks,
  type NavIconName,
} from "@/lib/navigation";
import { getPageTheme } from "@/lib/pageThemes";
import { supabase } from "@/lib/supabaseClient";
import { useDashboardAccent } from "@/lib/useDashboardAccent";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import NavIcon from "./NavIcon";

type CoupleNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

function getNotificationIcon(type: string): NavIconName {
  if (type.includes("question")) return "questions";
  if (type.includes("chat")) return "chat";
  if (type.includes("memory")) return "memories";
  if (type.includes("countdown")) return "countdown";
  return "notifications";
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

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  if (value.length !== 6) return "234, 88, 12";
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `${red}, ${green}, ${blue}`;
}

export default function MobileNav() {
  const pathname = usePathname();
  const dashboardAccent = useDashboardAccent();
  const accent = getPageTheme(pathname, dashboardAccent).accent;
  const accentRgb = hexToRgb(accent);
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
        .neq("type", "achievement_unlocked")
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
            .neq("type", "achievement_unlocked")
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
  const mobileNavStyle = {
    "--mobile-nav-accent": accent,
    "--mobile-nav-accent-rgb": accentRgb,
  } as CSSProperties & Record<"--mobile-nav-accent" | "--mobile-nav-accent-rgb", string>;
  const isMoreActive =
    isMoreOpen || !mobileMainLinks.some((link) => isActivePath(pathname, link.href));

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
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px] lg:hidden"
          aria-label="Закрыть уведомления"
          onClick={() => setIsNotificationsOpen(false)}
        />
      )}

      {isNotificationsOpen && (
        <section
          role="dialog"
          aria-modal="true"
          aria-label="Уведомления"
          style={mobileNavStyle}
          className="mobile-matte-sheet app-bottom-sheet fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-2 right-2 z-50 max-h-[72dvh] overflow-hidden rounded-[1.75rem] p-3 lg:hidden"
        >
          <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
          <div className="flex items-center justify-between px-2 py-3">
            <div>
              <h2 className="text-xl font-black text-slate-950 dark:text-white">Уведомления</h2>
              <p className="mt-0.5 text-sm font-semibold text-slate-500 dark:text-slate-400">Новые события пары</p>
            </div>
            <button type="button" onClick={() => setIsNotificationsOpen(false)} className="mobile-sheet-close" aria-label="Закрыть уведомления">
              <NavIcon name="close" className="h-8 w-8" />
            </button>
          </div>

          <div className="max-h-[55dvh] overflow-y-auto px-1 pb-1">
            {notifications.length === 0 ? (
              <div className="rounded-2xl bg-slate-100 px-4 py-5 text-sm font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                Пока уведомлений нет.
              </div>
            ) : (
              notifications.map((notification) => (
                <Link
                  key={notification.id}
                  href={notification.href || "/dashboard"}
                  onClick={() => setIsNotificationsOpen(false)}
                  className="mb-2 block rounded-2xl border border-slate-200 bg-white px-4 py-3 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full"
                      style={{ backgroundColor: `${accent}18` }}
                    >
                      <NavIcon name={getNotificationIcon(notification.type)} className="h-7 w-7" />
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
        </section>
      )}

      {isMoreOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[2px] lg:hidden"
          aria-label="Закрыть меню"
          onClick={() => setIsMoreOpen(false)}
        />
      )}

      {isMoreOpen && (
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-more-title"
          style={mobileNavStyle}
          className="mobile-matte-sheet app-bottom-sheet fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-2 right-2 z-50 max-h-[72dvh] overflow-y-auto rounded-[1.75rem] p-3 lg:hidden"
        >
          <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
          <div className="flex items-center justify-between px-2 py-3">
            <div>
              <h2 id="mobile-more-title" className="text-xl font-black text-slate-950 dark:text-white">Ещё</h2>
              <p className="mt-0.5 text-sm font-semibold text-slate-500 dark:text-slate-400">Все остальные разделы</p>
            </div>
            <button type="button" onClick={() => setIsMoreOpen(false)} className="mobile-sheet-close" aria-label="Закрыть меню">
              <NavIcon name="close" className="h-8 w-8" />
            </button>
          </div>

          <p className="mb-2 mt-1 px-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
            Разделы
          </p>
          <div className="space-y-1">
            {mobileMoreLinks.map((link) => {
              const isActive = isActivePath(pathname, link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMoreOpen(false)}
                  aria-current={isActive ? "page" : undefined}
                  className={`mobile-more-row ${isActive ? "mobile-more-row-active" : ""}`}
                >
                  <NavIcon name={link.icon} className="h-9 w-9" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black">{link.label}</span>
                    {link.description && <span className="mt-0.5 block truncate text-xs font-semibold opacity-55">{link.description}</span>}
                  </span>
                  <NavIcon name="chevronRight" className="h-7 w-7 opacity-35" />
                </Link>
              );
            })}
            <button type="button" onClick={openNotifications} className="mobile-more-row w-full text-left">
              <NavIcon name="notifications" className="h-9 w-9" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black">Уведомления</span>
                <span className="mt-0.5 block truncate text-xs font-semibold opacity-55">События и обновления пары</span>
              </span>
              {unreadNotifications > 0 ? (
                <span className="rounded-full bg-rose-500 px-2.5 py-1 text-xs font-black text-white">{unreadNotifications > 9 ? "9+" : unreadNotifications}</span>
              ) : (
                <NavIcon name="chevronRight" className="h-7 w-7 opacity-35" />
              )}
            </button>
          </div>

          <p className="mb-2 mt-4 px-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
            Аккаунт
          </p>
          <div className="space-y-1">
            {accountNavLinks.map((link) => {
              const isActive = isActivePath(pathname, link.href);
              const isLogout = link.href === "/logout";

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMoreOpen(false)}
                  aria-current={isActive ? "page" : undefined}
                  className={`mobile-more-row ${isActive ? "mobile-more-row-active" : ""} ${isLogout ? "mobile-more-row-danger" : ""}`}
                >
                  <NavIcon name={link.icon} className="h-9 w-9" />
                  <span className="min-w-0 flex-1 truncate text-sm font-black">{link.label}</span>
                  <NavIcon name="chevronRight" className="h-7 w-7 opacity-35" />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <nav
        aria-label="Основная мобильная навигация"
        style={mobileNavStyle}
        className="mobile-matte-dock fixed bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-2 right-2 z-40 p-1.5 lg:hidden"
      >
        <div className="grid grid-cols-5 items-stretch gap-0.5 text-center">
          {mobileMainLinks.map((link) => {
            const isActive = isActivePath(pathname, link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={`mobile-matte-tab relative flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl px-0.5 py-1.5 ${
                  isActive ? "mobile-matte-tab-active" : ""
                }`}
              >
                <NavIcon name={link.icon} className="h-7 w-7" />
                <span className="mobile-matte-label max-w-full truncate whitespace-nowrap">
                  {link.label}
                </span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setIsMoreOpen((current) => !current);
              setIsNotificationsOpen(false);
            }}
            className={`mobile-matte-tab relative flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl px-0.5 py-1.5 ${
              isMoreActive ? "mobile-matte-tab-active" : ""
            }`}
            aria-label="Открыть дополнительные разделы"
            aria-expanded={isMoreOpen}
          >
            <NavIcon name="more" className="h-7 w-7" />
            <span className="mobile-matte-label max-w-full truncate whitespace-nowrap">Ещё</span>
            {unreadNotifications > 0 && (
              <span className="absolute right-1 top-0.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-[#ef4444] px-1 text-[9px] font-black leading-none text-white shadow-md ring-2 ring-white dark:ring-slate-950">
                {unreadNotifications > 9 ? "9+" : unreadNotifications}
              </span>
            )}
          </button>
        </div>
      </nav>
    </>
  );
}
