"use client";

import { supabase } from "@/lib/supabaseClient";
import { notificationsUpdatedEventName } from "@/lib/notifications";
import { getPageTheme } from "@/lib/pageThemes";
import { profileUpdatedEventName } from "@/lib/profileEvents";
import { useDashboardAccent } from "@/lib/useDashboardAccent";
import {
  isActivePath,
  primaryNavLinks,
  quickNavActions,
  secondaryNavLinks,
  type NavIconName,
} from "@/lib/navigation";
import type { User } from "@supabase/supabase-js";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import NavIcon from "./NavIcon";
import { showAppToast } from "./AppToast";
import PushNotificationButton from "./PushNotificationButton";
import { LiquidGlassButton, LiquidGlassSurface } from "./LiquidGlass";

type UserProfile = {
  name: string;
  avatar: string | null;
};

type Couple = {
  id: string;
  partner_one_id: string;
  partner_two_id: string | null;
};

type CoupleProfile = {
  partner_one: string;
  partner_two: string;
  avatar?: string | null;
  avatar_one?: string | null;
  avatar_two?: string | null;
};

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
  if (type === "achievement_unlocked") return "achievements";
  if (type.includes("question")) return "questions";
  if (type.includes("quiz")) return "quizzes";
  if (type.includes("chat")) return "chat";
  if (type.includes("memory")) return "memories";
  return "notifications";
}

const densityStorageKey = "couple-space:density";
const densityUpdatedEventName = "couple-space:density-updated";

function getDensitySnapshot() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(densityStorageKey) === "compact";
}

function subscribeToDensity(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  window.addEventListener(densityUpdatedEventName, onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener(densityUpdatedEventName, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getFallbackName(user: User) {
  const login = user.user_metadata?.login;
  const fullName = user.user_metadata?.full_name;
  const name = user.user_metadata?.name;
  const candidates = [login, fullName, name, user.email?.split("@")[0]];
  const readable = candidates.find(
    (candidate) =>
      typeof candidate === "string" && candidate.trim() && !/^\d{5,}$/.test(candidate.trim()),
  );

  return typeof readable === "string" ? readable.trim() : "Профиль";
}

function getFallbackAvatar(user: User) {
  const avatarUrl = user.user_metadata?.avatar_url;
  const picture = user.user_metadata?.picture;
  if (typeof avatarUrl === "string" && avatarUrl.trim()) return avatarUrl;
  if (typeof picture === "string" && picture.trim()) return picture;
  return null;
}

function getInitial(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "♡";
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
  if (value.length !== 6) return "28, 139, 89";
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `${red}, ${green}, ${blue}`;
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<CoupleNotification[]>([]);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const isCompact = useSyncExternalStore(subscribeToDensity, getDensitySnapshot, () => false);

  const dashboardAccent = useDashboardAccent();
  const isLogin = pathname.startsWith("/login");
  const theme = getPageTheme(pathname, dashboardAccent);
  const accent = isLogin ? "#f3f4f6" : theme.accent;
  const accentRgb = hexToRgb(accent);
  const isSecondaryActive = secondaryNavLinks.some((link) => isActivePath(pathname, link.href));

  useEffect(() => {
    let ignore = false;

    async function loadProfile(user: User | null) {
      if (!user) {
        if (!ignore) {
          setProfile(null);
          setCurrentUserId(null);
          setNotifications([]);
          setIsLoadingUser(false);
        }
        return;
      }

      setCurrentUserId(user.id);

      let nextProfile: UserProfile = {
        name: getFallbackName(user),
        avatar: getFallbackAvatar(user),
      };

      const { data: coupleData } = await supabase
        .from("couples")
        .select("id, partner_one_id, partner_two_id")
        .or(`partner_one_id.eq.${user.id},partner_two_id.eq.${user.id}`)
        .limit(1)
        .maybeSingle<Couple>();

      if (coupleData) {
        const { data: coupleProfile } = await supabase
          .from("couple_profiles")
          .select("partner_one, partner_two, avatar, avatar_one, avatar_two")
          .eq("couple_id", coupleData.id)
          .limit(1)
          .maybeSingle<CoupleProfile>();

        if (coupleProfile) {
          const isPartnerOne = user.id === coupleData.partner_one_id;
          const profileName = isPartnerOne ? coupleProfile.partner_one : coupleProfile.partner_two;
          nextProfile = {
            name:
              profileName && !/^\d{5,}$/.test(profileName.trim())
                ? profileName
                : getFallbackName(user),
            avatar: isPartnerOne
              ? coupleProfile.avatar_one || coupleProfile.avatar || null
              : coupleProfile.avatar_two || coupleProfile.avatar || null,
          };
        }
      }

      if (!ignore) {
        setProfile(nextProfile);
        setIsLoadingUser(false);
      }

      await loadNotifications(user.id);
    }

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
      await loadProfile(user);
    }

    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoadingUser(true);
      setIsProfileOpen(false);
      setIsNotificationsOpen(false);
      window.setTimeout(() => {
        loadProfile(session?.user || null);
      }, 0);
    });

    function handleProfileUpdated(event: Event) {
      const detail = (event as CustomEvent<Partial<UserProfile>>).detail;
      if (detail?.name || detail?.avatar !== undefined) {
        setProfile((current) => ({
          name: detail.name || current?.name || "Профиль",
          avatar: detail.avatar === undefined ? current?.avatar || null : detail.avatar,
        }));
      }

      window.setTimeout(async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        await loadProfile(user);
      }, 0);
    }

    window.addEventListener(profileUpdatedEventName, handleProfileUpdated);
    window.addEventListener(notificationsUpdatedEventName, checkUser);

    return () => {
      ignore = true;
      window.removeEventListener(profileUpdatedEventName, handleProfileUpdated);
      window.removeEventListener(notificationsUpdatedEventName, checkUser);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`couple-notifications:${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "couple_notifications",
          filter: `recipient_id=eq.${currentUserId}`,
        },
        async (payload) => {
          const { data } = await supabase
            .from("couple_notifications")
            .select("id, type, title, body, href, read_at, created_at")
            .eq("recipient_id", currentUserId)
            .order("created_at", { ascending: false })
            .limit(12);

          setNotifications((data || []) as CoupleNotification[]);

          if (payload.eventType === "INSERT") {
            const next = payload.new as CoupleNotification;
            showAppToast({
              title: next.title,
              text: next.body || "Новое событие пары",
              accent,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [accent, currentUserId]);

  useEffect(() => {
    document.documentElement.classList.toggle("app-compact", isCompact);
    document.body.classList.toggle("app-compact", isCompact);
  }, [isCompact]);

  function toggleCompactMode() {
    const nextCompact = !isCompact;
    document.documentElement.classList.toggle("app-compact", nextCompact);
    document.body.classList.toggle("app-compact", nextCompact);
    localStorage.setItem(densityStorageKey, nextCompact ? "compact" : "comfortable");
    window.dispatchEvent(new Event(densityUpdatedEventName));
    showAppToast({
      title: nextCompact ? "Компактный режим включён" : "Обычный режим включён",
      text: nextCompact ? "На десктопе поместится больше данных." : "Интерфейс снова просторнее.",
      accent,
    });
  }

  async function logout() {
    setIsProfileOpen(false);
    setIsNotificationsOpen(false);
    setIsMoreOpen(false);
    await supabase.auth.signOut();
    setProfile(null);
    setNotifications([]);
    router.push("/login");
  }

  async function openNotifications() {
    const nextIsOpen = !isNotificationsOpen;
    setIsNotificationsOpen(nextIsOpen);
    setIsProfileOpen(false);
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

  const unreadNotifications = notifications.filter(
    (notification) => !notification.read_at
  ).length;

  return (
    <header className="fixed left-0 top-0 z-30 hidden w-full px-4 py-2 md:block">
      <LiquidGlassSurface
        as="nav"
        accent={accent}
        accentRgb={accentRgb}
        className="desktop-navbar-shell mx-auto flex max-w-6xl items-center justify-between gap-2 overflow-visible px-2 py-1.5 transition-colors"
      >
        <LiquidGlassButton
          asChild
          accent={accent}
          accentRgb={accentRgb}
          tone="subtle"
          size="md"
          className="px-3 opacity-95"
        >
        <Link
          href="/"
        >
          <NavIcon name="home" className="h-7 w-7" />
          <span className="hidden lg:inline">Couple Space</span>
          <span className="lg:hidden">CS</span>
        </Link>
        </LiquidGlassButton>

        <div className="hidden min-w-0 flex-1 items-center justify-center gap-1 md:flex">
          {primaryNavLinks.map((link) => {
            const isActive = isActivePath(pathname, link.href);
            return (
              <LiquidGlassButton
                asChild
                key={link.href}
                accent={accent}
                accentRgb={accentRgb}
                tone={isActive ? "active" : "default"}
                size="md"
                className="group relative px-3"
              >
              <Link
                href={link.href}
                title={link.description || link.label}
              >
                <NavIcon name={link.icon} className="h-7 w-7" />
                <span className="hidden xl:inline">{link.label}</span>
                <span className="app-tooltip" aria-hidden="true">{link.label}</span>
              </Link>
              </LiquidGlassButton>
            );
          })}

          <div className="relative">
            <LiquidGlassButton
              type="button"
              onClick={() => {
                setIsMoreOpen((current) => !current);
                setIsProfileOpen(false);
                setIsNotificationsOpen(false);
              }}
              accent={accent}
              accentRgb={accentRgb}
              tone={isSecondaryActive ? "active" : "default"}
              size="md"
              className="group relative px-3"
            >
              <NavIcon name="settings" className="h-7 w-7" />
              <span className="hidden xl:inline">Ещё</span>
              <span className="app-tooltip" aria-hidden="true">Ещё</span>
            </LiquidGlassButton>

            {isMoreOpen && (
              <LiquidGlassSurface
                tone="menu"
                accent={accent}
                accentRgb={accentRgb}
                className="liquid-glass-readable absolute left-1/2 top-12 z-50 w-72 -translate-x-1/2 rounded-[1.25rem] p-3 text-[#7f1d1d] dark:text-white"
              >
                <p className="px-2 pb-2 text-[10px] font-black uppercase tracking-wide opacity-45">
                  Разделы
                </p>
                <div className="grid gap-1">
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
                      className="w-full justify-start px-3 text-sm"
                    >
                    <Link
                      href={link.href}
                      onClick={() => setIsMoreOpen(false)}
                    >
                      <NavIcon name={link.icon} className="h-9 w-9 bg-white/55 shadow-inner dark:bg-white/10" />
                      <span className="min-w-0">
                        <span className="block truncate">{link.label}</span>
                        <span className="block truncate text-xs font-bold opacity-55">
                          {link.description}
                        </span>
                      </span>
                    </Link>
                    </LiquidGlassButton>
                  );
                })}
                </div>
              </LiquidGlassSurface>
            )}
          </div>
        </div>

        {isLoadingUser ? (
          <div
            className="h-10 w-28 animate-pulse rounded-[1rem]"
            style={{
              backgroundColor: isLogin ? "#f3f4f6" : accent,
            }}
          />
        ) : profile ? (
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsActionsOpen((current) => !current);
                  setIsNotificationsOpen(false);
                  setIsProfileOpen(false);
                  setIsMoreOpen(false);
                }}
                style={!isLogin ? { backgroundColor: accent, color: "#fff" } : undefined}
                className={`hidden ui-pressable h-9 w-9 place-items-center rounded-full text-xl font-black shadow-lg ${
                  isLogin ? "bg-black text-white dark:bg-white dark:text-black" : ""
                }`}
                aria-label="Быстрые действия"
              >
                <NavIcon name="plus" className="h-7 w-7" />
              </button>

              {isActionsOpen && (
                <LiquidGlassSurface
                  tone="menu"
                  accent={accent}
                  accentRgb={accentRgb}
                  className="liquid-glass-readable absolute right-0 top-12 z-50 w-72 rounded-[1.25rem] p-3 text-[#7f1d1d] dark:text-white"
                >
                  <p className="px-2 pb-2 text-[10px] font-black uppercase tracking-wide opacity-45">
                    Быстро добавить
                  </p>
                  <div className="grid gap-1">
                    {quickNavActions.map((action) => (
                      <LiquidGlassButton
                        asChild
                        key={action.href + action.label}
                        accent={accent}
                        accentRgb={accentRgb}
                        tone="subtle"
                        size="lg"
                        shape="rounded"
                        className="w-full justify-start px-3 text-sm"
                      >
                      <Link
                        href={action.href}
                        onClick={() => setIsActionsOpen(false)}
                      >
                        <NavIcon
                          name={action.icon}
                          className="h-9 w-9 text-white shadow-inner"
                          title={action.label}
                        />
                        <span className="min-w-0">
                          <span className="block truncate">{action.label}</span>
                          <span className="block truncate text-xs font-bold opacity-55">
                            {action.description}
                          </span>
                        </span>
                      </Link>
                      </LiquidGlassButton>
                    ))}
                  </div>
                </LiquidGlassSurface>
              )}
            </div>

            <div className="relative">
              <LiquidGlassButton
                onClick={openNotifications}
                accent={accent}
                accentRgb={accentRgb}
                tone="default"
                size="icon"
                aria-label="Уведомления"
              >
                <NavIcon name="notifications" className="h-7 w-7" />
                {unreadNotifications > 0 && (
                  <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-[#ef4444] px-1.5 text-[11px] font-black leading-none text-white shadow-[0_0_18px_rgba(239,68,68,0.8)] ring-2 ring-white">
                    {unreadNotifications > 9 ? "9+" : unreadNotifications}
                  </span>
                )}
              </LiquidGlassButton>

              {isNotificationsOpen && (
                <LiquidGlassSurface
                  tone="menu"
                  accent={accent}
                  accentRgb={accentRgb}
                  className="liquid-glass-readable absolute right-0 top-12 z-50 w-[22rem] max-w-[calc(100vw-2rem)] rounded-[1.25rem] p-2 text-[#7f1d1d] dark:text-white"
                >
                  <div className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide opacity-55">
                        Уведомления
                      </p>
                      <p className="mt-1 text-sm font-bold opacity-70">
                        Новые события пары
                      </p>
                    </div>
                    {notifications.length > 0 && (
                      <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-black text-rose-600 dark:bg-white/10 dark:text-rose-100">
                        {notifications.length}
                      </span>
                    )}
                  </div>

                  <div className="max-h-96 overflow-y-auto px-2 pb-2">
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
                          className="mb-2 block rounded-[1rem] border border-white/32 bg-white/52 px-4 py-3 shadow-inner backdrop-blur transition hover:bg-white/68 dark:border-white/10 dark:bg-white/8 dark:hover:bg-white/14"
                        >
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-rose-100 text-rose-700 dark:bg-white/10 dark:text-rose-100">
                              <NavIcon name={getNotificationIcon(notification.type)} className="h-7 w-7 bg-transparent shadow-none" />
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
            </div>

            <div className="relative">
            <LiquidGlassButton
              onClick={() => {
                setIsProfileOpen((current) => !current);
                setIsNotificationsOpen(false);
                setIsMoreOpen(false);
              }}
              accent={accent}
              accentRgb={accentRgb}
              tone="default"
              size="md"
              className="gap-2 py-1 pl-1.5 pr-3 text-sm"
            >
              {profile.avatar ? (
                <Image
                  src={profile.avatar}
                  alt={profile.name}
                  width={36}
                  height={36}
                  sizes="36px"
                  className="h-8 w-8 rounded-full object-cover ring-2 ring-white/70"
                />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/75 text-sm font-black shadow-inner dark:bg-white/10">
                  {getInitial(profile.name)}
                </span>
              )}
              <span className="hidden max-w-28 truncate sm:block">{profile.name}</span>
            </LiquidGlassButton>

            {isProfileOpen && (
              <LiquidGlassSurface
                tone="menu"
                accent={accent}
                accentRgb={accentRgb}
                className="liquid-glass-readable absolute right-0 top-12 z-50 w-56 rounded-[1.25rem] p-2 text-[#7f1d1d] dark:text-white"
              >
                <div className="px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-wide opacity-55">
                    Профиль
                  </p>
                  <p className="mt-1 truncate font-black">{profile.name}</p>
                </div>
                <Link
                  href="/profile"
                  onClick={() => setIsProfileOpen(false)}
                  className="mb-2 block rounded-2xl border border-white/32 bg-white/52 px-4 py-3 font-black shadow-inner backdrop-blur transition hover:bg-white/68 dark:border-white/10 dark:bg-white/8 dark:hover:bg-white/14"
                >
                  Открыть профиль
                </Link>
                <button
                  type="button"
                  onClick={toggleCompactMode}
                  className="mb-2 w-full rounded-2xl border border-white/32 bg-white/52 px-4 py-3 text-left font-black shadow-inner backdrop-blur transition hover:bg-white/68 dark:border-white/10 dark:bg-white/8 dark:hover:bg-white/14"
                >
                  {isCompact ? "Обычная плотность" : "Компактная плотность"}
                </button>
                <div className="mb-2">
                  <PushNotificationButton accent={accent} />
                </div>
                <button
                  onClick={logout}
                  className="w-full rounded-2xl bg-[#dc2626] px-4 py-3 text-left font-black text-white shadow-lg transition hover:bg-[#ef4444]"
                >
                  Выйти
                </button>
              </LiquidGlassSurface>
            )}
          </div>
          </div>
        ) : (
          <LiquidGlassButton
            asChild
            accent={isLogin ? "#be123c" : accent}
            accentRgb={isLogin ? "190, 18, 60" : accentRgb}
            tone="active"
            size="md"
          >
          <Link
            href="/login"
          >
            Войти
          </Link>
          </LiquidGlassButton>
        )}
      </LiquidGlassSurface>
    </header>
  );
}
