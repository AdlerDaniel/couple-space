"use client";

import { notificationsUpdatedEventName } from "@/lib/notifications";
import {
  accountNavLinks,
  isActivePath,
  mobileMainLinks,
  type NavIconName,
  quickNavActions,
  secondaryNavLinks,
} from "@/lib/navigation";
import { getPageTheme } from "@/lib/pageThemes";
import { supabase } from "@/lib/supabaseClient";
import { useDashboardAccent } from "@/lib/useDashboardAccent";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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

type Couple = {
  id: string;
  partner_one_id: string;
  partner_two_id: string | null;
};

type CoupleProfile = {
  partner_one: string | null;
  partner_two: string | null;
};

type TrackerGoal = {
  title: string;
};

type QuickState = {
  couple: Couple | null;
  profile: CoupleProfile | null;
  answerStreak: number;
  latestGoal: TrackerGoal | null;
};

function getNotificationIcon(type: string): NavIconName {
  if (type === "achievement_unlocked") return "achievements";
  if (type.includes("question")) return "questions";
  if (type.includes("quiz")) return "quizzes";
  if (type.includes("chat")) return "chat";
  if (type.includes("memory")) return "memories";
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

function getReadableName(value?: string | null, fallback = "Партнёр") {
  const name = value?.trim();
  if (!name) return fallback;
  if (/^\d{5,}$/.test(name)) return fallback;
  return name;
}

export default function MobileNav() {
  const pathname = usePathname();
  const dashboardAccent = useDashboardAccent();
  const accent = getPageTheme(pathname, dashboardAccent).accent;
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<CoupleNotification[]>([]);
  const [quickState, setQuickState] = useState<QuickState>({
    couple: null,
    profile: null,
    answerStreak: 0,
    latestGoal: null,
  });
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isQuickOpen, setIsQuickOpen] = useState(false);
  const [isHiddenByScroll, setIsHiddenByScroll] = useState(false);

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

    async function loadQuickState(userId: string) {
      const { data: couple } = await supabase
        .from("couples")
        .select("id, partner_one_id, partner_two_id")
        .or(`partner_one_id.eq.${userId},partner_two_id.eq.${userId}`)
        .limit(1)
        .maybeSingle<Couple>();

      if (!couple) {
        if (!ignore) {
          setQuickState({ couple: null, profile: null, answerStreak: 0, latestGoal: null });
        }
        return;
      }

      const [profileResult, answersResult, goalResult] = await Promise.all([
        supabase
          .from("couple_profiles")
          .select("partner_one, partner_two")
          .eq("couple_id", couple.id)
          .limit(1)
          .maybeSingle<CoupleProfile>(),
        supabase
          .from("question_answers")
          .select("id", { count: "exact", head: true })
          .eq("couple_id", couple.id)
          .or(`answer_one.not.is.null,answer_two.not.is.null`),
        supabase
          .from("tracker_goals")
          .select("title")
          .eq("couple_id", couple.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle<TrackerGoal>(),
      ]);

      if (!ignore) {
        setQuickState({
          couple,
          profile: profileResult.data || null,
          answerStreak: answersResult.count || 0,
          latestGoal: goalResult.data || null,
        });
      }
    }

    async function checkUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setCurrentUserId(null);
        setNotifications([]);
        setQuickState({ couple: null, profile: null, answerStreak: 0, latestGoal: null });
        return;
      }

      setCurrentUserId(user.id);
      await Promise.all([loadNotifications(user.id), loadQuickState(user.id)]);
    }

    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsNotificationsOpen(false);
      setIsMoreOpen(false);
      setIsQuickOpen(false);
      window.setTimeout(() => {
        if (session?.user) {
          setCurrentUserId(session.user.id);
          loadNotifications(session.user.id);
          loadQuickState(session.user.id);
        } else {
          setCurrentUserId(null);
          setNotifications([]);
          setQuickState({ couple: null, profile: null, answerStreak: 0, latestGoal: null });
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

  useEffect(() => {
    let lastScrollY = window.scrollY;

    function handleScroll() {
      const currentScrollY = window.scrollY;
      const isGoingDown = currentScrollY > lastScrollY && currentScrollY > 120;
      setIsHiddenByScroll(isGoingDown && !isMoreOpen && !isQuickOpen && !isNotificationsOpen);
      lastScrollY = currentScrollY;
    }

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, [isMoreOpen, isQuickOpen, isNotificationsOpen]);

  if (
    pathname.startsWith("/chat") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/logout")
  ) {
    return null;
  }

  const unreadNotifications = notifications.filter((notification) => !notification.read_at).length;
  const coupleTitle = quickState.profile
    ? `${getReadableName(quickState.profile.partner_one, "Партнёр 1")} + ${getReadableName(quickState.profile.partner_two, "Партнёр 2")}`
    : quickState.couple
      ? "Ваша пара"
      : "Пара не создана";
  const coupleSubtitle = quickState.couple?.partner_two_id
    ? "Общее пространство активно"
    : quickState.couple
      ? "Пригласите партнёра"
      : "Создайте пару в профиле";

  async function openNotifications() {
    const nextIsOpen = !isNotificationsOpen;
    setIsNotificationsOpen(nextIsOpen);
    setIsMoreOpen(false);
    setIsQuickOpen(false);

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
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[1px] md:hidden"
          aria-label="Закрыть уведомления"
          onClick={() => setIsNotificationsOpen(false)}
        />
      )}

      {isNotificationsOpen && (
        <div
          className="app-bottom-sheet app-glass fixed inset-x-0 bottom-0 z-40 max-h-[82dvh] overflow-hidden rounded-t-[1.75rem] p-3 pb-24"
          style={{
            borderColor: `${accent}55`,
            color: accent,
          }}
        >
          <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-current opacity-25" />
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
        </div>
      )}

      {(isMoreOpen || isQuickOpen) && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[1px] md:hidden"
          aria-label="Закрыть меню"
          onClick={() => {
            setIsMoreOpen(false);
            setIsQuickOpen(false);
          }}
        />
      )}

      {(isMoreOpen || isQuickOpen) && (
        <div
          className="app-bottom-sheet app-glass fixed inset-x-0 bottom-0 z-40 max-h-[86dvh] overflow-y-auto rounded-t-[1.75rem] p-4 pb-24"
          style={{
            borderColor: `${accent}55`,
            color: accent,
          }}
        >
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-current opacity-25" />
          <div className="mb-3 rounded-2xl bg-white/72 p-3 shadow-inner dark:bg-white/10">
            <div className="flex items-center gap-3">
              <div
                className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-xl font-black text-white shadow-lg"
                style={{ backgroundColor: accent }}
              >
                <NavIcon name="dashboard" className="h-7 w-7 text-white" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-black">{coupleTitle}</p>
                <p className="mt-1 text-xs font-bold opacity-58">{coupleSubtitle}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-white/72 px-2 py-2 shadow-inner dark:bg-black/18">
                <p className="text-lg font-black">{unreadNotifications}</p>
                <p className="truncate text-[10px] font-black uppercase opacity-50">Новых</p>
              </div>
              <div className="rounded-xl bg-white/72 px-2 py-2 shadow-inner dark:bg-black/18">
                <p className="text-lg font-black">{quickState.answerStreak}</p>
                <p className="truncate text-[10px] font-black uppercase opacity-50">Ответов</p>
              </div>
              <div className="rounded-xl bg-white/72 px-2 py-2 shadow-inner dark:bg-black/18">
                <p className="truncate text-xs font-black">
                  {quickState.latestGoal?.title || "Нет цели"}
                </p>
                <p className="truncate text-[10px] font-black uppercase opacity-50">Цель</p>
              </div>
            </div>
          </div>

          <p className="mb-2 px-2 text-[10px] font-black uppercase tracking-wide opacity-45">
            Быстро
          </p>
          <div className="mb-3 grid grid-cols-4 gap-2">
            {quickNavActions.map((action) => (
              <Link
                key={action.href + action.label}
                href={action.href}
                onClick={() => setIsMoreOpen(false)}
                className="ui-pressable flex min-w-0 flex-col items-center gap-1 rounded-2xl bg-white/72 px-2 py-3 text-center text-xs font-black shadow-inner dark:bg-white/10"
              >
                <NavIcon name={action.icon} className="h-9 w-9 text-white shadow" />
                <span className="max-w-full truncate">{action.label}</span>
              </Link>
            ))}
          </div>

          <p className="mb-2 px-2 text-[10px] font-black uppercase tracking-wide opacity-45">
            Основные разделы
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={openNotifications}
              className="ui-pressable relative flex items-center gap-3 rounded-2xl bg-white/72 px-3 py-3 text-left font-black shadow-inner dark:bg-white/10"
            >
              <NavIcon name="notifications" className="h-8 w-8" />
              <span>Уведомления</span>
              {unreadNotifications > 0 && (
                <span className="ml-auto rounded-full bg-[#ef4444] px-2 py-0.5 text-xs text-white">
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              )}
            </button>
            {secondaryNavLinks.map((link) => {
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
                      : "ui-pressable flex min-w-0 items-center gap-3 rounded-2xl bg-white/72 px-3 py-3 font-black shadow-inner dark:bg-white/10"
                  }
                >
                  <NavIcon name={link.icon} className="h-8 w-8" />
                  <span className="truncate">{link.label}</span>
                </Link>
              );
            })}
          </div>

          <p className="mb-2 mt-3 px-2 text-[10px] font-black uppercase tracking-wide opacity-45">
            Аккаунт
          </p>
          <div className="grid grid-cols-3 gap-2">
            {accountNavLinks.map((link) => {
              const isActive = isActivePath(pathname, link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMoreOpen(false)}
                  style={isActive ? { backgroundColor: accent } : undefined}
                  className={
                    isActive
                      ? "flex min-w-0 items-center justify-center gap-2 rounded-2xl px-2 py-3 text-sm font-black text-white shadow-lg"
                      : "ui-pressable flex min-w-0 items-center justify-center gap-2 rounded-2xl bg-white/72 px-2 py-3 text-sm font-black shadow-inner dark:bg-white/10"
                  }
                >
                  <NavIcon name={link.icon} className="h-7 w-7" />
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
        className={`app-glass fixed bottom-2 left-2 right-2 z-40 rounded-[1.1rem] px-1 py-1 transition-transform duration-300 md:hidden ${
          isHiddenByScroll ? "translate-y-24" : "translate-y-0"
        }`}
      >
        <div className="grid grid-cols-6 items-stretch gap-1 text-center text-[9px] font-black leading-tight min-[380px]:text-[10px]">
          {mobileMainLinks.map((link) => {
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
                    : "ui-pressable flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl bg-white/72 px-0.5 py-1 opacity-100 shadow-inner dark:bg-black/30"
                }
              >
                <NavIcon name={link.icon} className="h-7 w-7" />
                <span className="max-w-full truncate whitespace-nowrap">{link.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setIsQuickOpen((current) => !current);
              setIsMoreOpen(false);
              setIsNotificationsOpen(false);
            }}
            style={
              isQuickOpen
                ? { color: "#ffffff", backgroundColor: accent }
                : { color: "#ffffff", backgroundColor: accent }
            }
            className="ui-pressable relative flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1 shadow-lg"
            aria-label="Открыть быстрые действия"
          >
            <NavIcon name="plus" className="h-8 w-8" />
            <span className="max-w-full truncate whitespace-nowrap">Добавить</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setIsMoreOpen((current) => !current);
              setIsQuickOpen(false);
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
                : "ui-pressable relative flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl bg-white/72 px-0.5 py-1 opacity-100 shadow-inner dark:bg-black/30"
            }
            aria-label="Открыть дополнительные разделы"
          >
            <NavIcon name="settings" className="h-7 w-7" />
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
