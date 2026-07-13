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
import { useEffect, useState, type CSSProperties } from "react";
import NavIcon from "./NavIcon";
import PushNotificationButton from "./PushNotificationButton";
import { LiquidGlassButton, LiquidGlassSurface } from "./LiquidGlass";

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
  const mobileNavStyle = {
    "--mobile-nav-accent": accent,
    "--mobile-nav-accent-rgb": accentRgb,
  } as CSSProperties & Record<"--mobile-nav-accent" | "--mobile-nav-accent-rgb", string>;

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
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px] md:hidden"
          aria-label="Закрыть уведомления"
          onClick={() => setIsNotificationsOpen(false)}
        />
      )}

      {isNotificationsOpen && (
        <LiquidGlassSurface
          tone="menu"
          accent={accent}
          accentRgb={accentRgb}
          className="liquid-glass-readable app-bottom-sheet fixed inset-x-0 bottom-0 z-50 max-h-[82dvh] rounded-t-[1.35rem] p-3 pb-[calc(5rem+env(safe-area-inset-bottom))]"
          style={{ color: accent }}
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
              <div className="rounded-[1rem] bg-white/78 px-4 py-5 text-sm font-bold opacity-70 shadow-inner dark:bg-white/10">
                Пока уведомлений нет.
              </div>
            ) : (
              notifications.map((notification) => (
                <Link
                  key={notification.id}
                  href={notification.href || "/dashboard"}
                  onClick={() => setIsNotificationsOpen(false)}
                  className="mb-2 block rounded-[1rem] border border-white/32 bg-white/52 px-4 py-3 shadow-inner backdrop-blur transition hover:bg-white/68 dark:border-white/10 dark:bg-white/8 dark:hover:bg-white/14"
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
        </LiquidGlassSurface>
      )}

      {(isMoreOpen || isQuickOpen) && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px] md:hidden"
          aria-label="Закрыть меню"
          onClick={() => {
            setIsMoreOpen(false);
            setIsQuickOpen(false);
          }}
        />
      )}

      {(isMoreOpen || isQuickOpen) && (
        <LiquidGlassSurface
          tone="menu"
          accent={accent}
          accentRgb={accentRgb}
          className="liquid-glass-readable app-bottom-sheet fixed inset-x-0 bottom-0 z-50 max-h-[86dvh] overflow-y-auto rounded-t-[1.35rem] p-4 pb-[calc(5rem+env(safe-area-inset-bottom))]"
          style={{ color: accent }}
        >
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-current opacity-25" />
          <div className="mb-3 rounded-[1rem] border border-white/36 bg-white/50 p-3 shadow-inner backdrop-blur dark:border-white/10 dark:bg-white/8">
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
              <div className="rounded-[0.8rem] border border-white/32 bg-white/42 px-2 py-2 shadow-inner dark:border-white/10 dark:bg-black/18">
                <p className="text-lg font-black">{unreadNotifications}</p>
                <p className="truncate text-[10px] font-black uppercase opacity-50">Новых</p>
              </div>
              <div className="rounded-[0.8rem] border border-white/32 bg-white/42 px-2 py-2 shadow-inner dark:border-white/10 dark:bg-black/18">
                <p className="text-lg font-black">{quickState.answerStreak}</p>
                <p className="truncate text-[10px] font-black uppercase opacity-50">Ответов</p>
              </div>
              <div className="rounded-[0.8rem] border border-white/32 bg-white/42 px-2 py-2 shadow-inner dark:border-white/10 dark:bg-black/18">
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
              <LiquidGlassButton
                asChild
                key={action.href + action.label}
                accent={accent}
                accentRgb={accentRgb}
                tone="subtle"
                size="mobile"
                shape="rounded"
                className="mobile-glass-tab min-w-0 px-2 py-3 text-center text-xs"
              >
              <Link
                href={action.href}
                onClick={() => setIsMoreOpen(false)}
              >
                <NavIcon name={action.icon} className="h-9 w-9 text-white shadow" />
                <span className="max-w-full truncate">{action.label}</span>
              </Link>
              </LiquidGlassButton>
            ))}
          </div>

          <p className="mb-2 px-2 text-[10px] font-black uppercase tracking-wide opacity-45">
            Основные разделы
          </p>
          <div className="grid grid-cols-2 gap-2">
            <LiquidGlassButton
              type="button"
              onClick={openNotifications}
              accent={accent}
              accentRgb={accentRgb}
              tone="subtle"
              size="lg"
              shape="rounded"
              className="mobile-glass-row relative justify-start px-3 py-3 text-left text-xs font-black"
            >
              <NavIcon name="notifications" className="h-8 w-8" />
              <span>Уведомления</span>
              {unreadNotifications > 0 && (
                <span className="ml-auto rounded-full bg-[#ef4444] px-2 py-0.5 text-xs text-white">
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              )}
            </LiquidGlassButton>
            {secondaryNavLinks.map((link) => {
              const isActive = isActivePath(pathname, link.href);

              return (
                <LiquidGlassButton
                  asChild
                  key={link.href}
                  accent={accent}
                  accentRgb={accentRgb}
                  tone={isActive ? "active" : "subtle"}
                  size="lg"
                  shape="rounded"
                  className="mobile-glass-row min-w-0 justify-start px-3 py-3 text-xs font-black"
                >
                <Link
                  href={link.href}
                  onClick={() => setIsMoreOpen(false)}
                >
                  <NavIcon name={link.icon} className="h-8 w-8" />
                  <span className="truncate">{link.label}</span>
                </Link>
                </LiquidGlassButton>
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
                <LiquidGlassButton
                  asChild
                  key={link.href}
                  accent={accent}
                  accentRgb={accentRgb}
                  tone={isActive ? "active" : "subtle"}
                  size="lg"
                  shape="rounded"
                  className="mobile-glass-tab min-w-0 px-2 py-3 text-xs font-black"
                >
                <Link
                  href={link.href}
                  onClick={() => setIsMoreOpen(false)}
                >
                  <NavIcon name={link.icon} className="h-7 w-7" />
                  <span className="truncate">{link.label}</span>
                </Link>
                </LiquidGlassButton>
              );
            })}
          </div>
          <PushNotificationButton
            accent={accent}
            className="mt-2 w-full rounded-[1rem] bg-white/78 px-3 py-3 text-left text-sm font-black shadow-inner transition hover:bg-black/5 dark:bg-white/10 dark:hover:bg-white/15"
          />
        </LiquidGlassSurface>
      )}

      <LiquidGlassSurface
        as="nav"
        accent={accent}
        accentRgb={accentRgb}
        style={mobileNavStyle}
        className={`mobile-nav-shell fixed bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-2 right-2 z-40 px-1 py-1.5 transition-transform duration-300 md:hidden ${
          isHiddenByScroll ? "translate-y-24" : "translate-y-0"
        }`}
      >
        <div className="grid grid-cols-5 items-stretch gap-0.5 text-center text-[9px] font-black leading-tight">
          {mobileMainLinks.map((link) => {
            const isActive = isActivePath(pathname, link.href);

            return (
              <LiquidGlassButton
                asChild
                key={link.href}
                accent={accent}
                accentRgb={accentRgb}
                tone={isActive ? "active" : "subtle"}
                size="mobile"
                shape="mobile"
                className="mobile-glass-tab relative min-w-0 px-0.5 py-1"
              >
                <Link href={link.href}>
                  <NavIcon name={link.icon} className="h-7 w-7" />
                  <span className="max-w-full truncate whitespace-nowrap">{link.label}</span>
                  {isActive && <span className="mobile-active-glow" />}
                </Link>
              </LiquidGlassButton>
            );
          })}
          <LiquidGlassButton
            type="button"
            onClick={() => {
              setIsMoreOpen((current) => !current);
              setIsQuickOpen(false);
              setIsNotificationsOpen(false);
            }}
            accent={accent}
            accentRgb={accentRgb}
            tone={isMoreOpen ? "active" : "subtle"}
            size="mobile"
            shape="mobile"
            className="mobile-glass-tab relative min-w-0 px-0.5 py-1"
            aria-label="Открыть дополнительные разделы"
          >
            <NavIcon name="settings" className="h-7 w-7" />
            <span className="max-w-full truncate whitespace-nowrap">Ещё</span>
            {isMoreOpen && <span className="mobile-active-glow" />}
            {unreadNotifications > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-[#ef4444] px-1 text-[9px] font-black leading-none text-white shadow-[0_0_14px_rgba(239,68,68,0.8)] ring-2 ring-white">
                {unreadNotifications > 9 ? "9+" : unreadNotifications}
              </span>
            )}
          </LiquidGlassButton>
        </div>
      </LiquidGlassSurface>
    </>
  );
}
