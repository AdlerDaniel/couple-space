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
} from "@/lib/navigation";
import type { User } from "@supabase/supabase-js";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import NavIcon from "./NavIcon";
import { showAppToast } from "./AppToast";
import PushNotificationButton from "./PushNotificationButton";

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
  const navStyle =
    !isLogin && theme.nav
      ? theme.nav
      : !isLogin
        ? {
            background: `linear-gradient(135deg, rgba(${accentRgb}, 0.24), rgba(${accentRgb}, 0.12))`,
            borderColor: `rgba(${accentRgb}, 0.34)`,
            boxShadow: `0 16px 52px rgba(${accentRgb}, 0.2)`,
          }
        : undefined;
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
      <nav
        style={navStyle}
        className="app-glass mx-auto flex max-w-5xl items-center justify-between gap-2 rounded-[1.15rem] px-2 py-1 transition-colors"
      >
        <Link
          href="/"
          style={!isLogin ? { color: accent } : undefined}
          className={`ui-pressable flex shrink-0 items-center gap-2 rounded-[0.95rem] bg-white/64 px-2.5 py-1.5 text-sm font-black opacity-95 shadow-inner dark:bg-white/8 ${
            isLogin ? "text-gray-800 dark:text-gray-100" : ""
          }`}
        >
          <NavIcon name="home" className="h-7 w-7" />
          <span className="hidden lg:inline">Couple Space</span>
          <span className="lg:hidden">CS</span>
        </Link>

        <div className="hidden min-w-0 flex-1 items-center justify-center gap-1 md:flex">
          {primaryNavLinks.map((link) => {
            const isActive = isActivePath(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                title={link.description || link.label}
                style={
                  !isLogin
                    ? {
                        color: isActive ? "#fff" : accent,
                        backgroundColor: isActive ? accent : `rgba(${accentRgb}, 0.09)`,
                        boxShadow: isActive ? `0 10px 28px rgba(${accentRgb}, 0.26)` : undefined,
                      }
                    : undefined
                }
                className={`group ui-pressable relative flex items-center gap-1.5 rounded-[0.95rem] px-2 py-1.5 text-sm font-black ${
                  isLogin ? "text-gray-700 dark:text-gray-200" : ""
                }`}
              >
                <NavIcon name={link.icon} className="h-7 w-7" />
                <span className="hidden xl:inline">{link.label}</span>
                <span className="app-tooltip" aria-hidden="true">{link.label}</span>
              </Link>
            );
          })}

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsMoreOpen((current) => !current);
                setIsProfileOpen(false);
                setIsNotificationsOpen(false);
              }}
              style={
                !isLogin
                  ? {
                      color: isSecondaryActive ? "#fff" : accent,
                      backgroundColor: isSecondaryActive ? accent : `rgba(${accentRgb}, 0.09)`,
                      boxShadow: isSecondaryActive ? `0 10px 28px rgba(${accentRgb}, 0.26)` : undefined,
                    }
                  : undefined
              }
              className={`group ui-pressable relative flex items-center gap-1.5 rounded-[0.95rem] px-2 py-1.5 text-sm font-black ${
                isLogin ? "text-gray-700 dark:text-gray-200" : ""
              }`}
            >
              <NavIcon name="settings" className="h-7 w-7" />
              <span className="hidden xl:inline">Ещё</span>
              <span className="app-tooltip" aria-hidden="true">Ещё</span>
            </button>

            {isMoreOpen && (
              <div
                className="app-glass absolute left-1/2 top-10 w-72 -translate-x-1/2 overflow-hidden rounded-[1.25rem] p-3 text-[#7f1d1d] dark:text-white"
                style={{ color: accent }}
              >
                <p className="px-2 pb-2 text-[10px] font-black uppercase tracking-wide opacity-45">
                  Разделы
                </p>
                <div className="grid gap-1">
                {secondaryNavLinks.map((link) => {
                  const isActive = isActivePath(pathname, link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setIsMoreOpen(false)}
                      style={
                        !isLogin && isActive
                          ? { backgroundColor: accent, color: "#fff" }
                          : undefined
                      }
                      className="ui-pressable flex items-center gap-3 rounded-[1rem] px-3 py-2.5 text-sm font-black hover:bg-black/5 dark:hover:bg-white/10"
                    >
                      <NavIcon name={link.icon} className="h-9 w-9 bg-white/55 shadow-inner dark:bg-white/10" />
                      <span className="min-w-0">
                        <span className="block truncate">{link.label}</span>
                        <span className="block truncate text-xs font-bold opacity-55">
                          {link.description}
                        </span>
                      </span>
                    </Link>
                  );
                })}
                </div>
              </div>
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
                <div
                  className="app-glass absolute right-0 top-11 w-72 overflow-hidden rounded-[1.25rem] p-3 text-[#7f1d1d] dark:text-white"
                  style={{ color: accent }}
                >
                  <p className="px-2 pb-2 text-[10px] font-black uppercase tracking-wide opacity-45">
                    Быстро добавить
                  </p>
                  <div className="grid gap-1">
                    {quickNavActions.map((action) => (
                      <Link
                        key={action.href + action.label}
                        href={action.href}
                        onClick={() => setIsActionsOpen(false)}
                        className="ui-pressable flex items-center gap-3 rounded-[1rem] px-3 py-2.5 text-sm font-black hover:bg-black/5 dark:hover:bg-white/10"
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
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={openNotifications}
                style={!isLogin ? { backgroundColor: `${accent}18`, color: accent } : undefined}
                className={`ui-pressable relative grid h-9 w-9 place-items-center rounded-[0.95rem] border border-white/35 text-base font-black shadow-lg backdrop-blur ${
                  isLogin
                    ? "bg-white/75 text-[#be123c] dark:bg-white/10 dark:text-white"
                    : ""
                }`}
                aria-label="Уведомления"
              >
                <NavIcon name="notifications" className="h-7 w-7" />
                {unreadNotifications > 0 && (
                  <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-[#ef4444] px-1.5 text-[11px] font-black leading-none text-white shadow-[0_0_18px_rgba(239,68,68,0.8)] ring-2 ring-white">
                    {unreadNotifications > 9 ? "9+" : unreadNotifications}
                  </span>
                )}
              </button>

              {isNotificationsOpen && (
                <div className="app-glass absolute right-0 top-11 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[1.25rem] p-2 text-[#7f1d1d] dark:text-white">
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
                          className="mb-2 block rounded-[1rem] bg-white/72 px-4 py-3 shadow-inner transition hover:bg-black/5 dark:bg-white/10 dark:hover:bg-white/15"
                        >
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-rose-100 text-lg dark:bg-white/10">
                              {notification.type === "achievement_unlocked"
                                ? "🏆"
                                : notification.type.includes("question")
                                  ? "💌"
                                  : notification.type.includes("quiz")
                                    ? "✨"
                                    : notification.type.includes("chat")
                                      ? "💬"
                                      : notification.type.includes("memory")
                                        ? "📸"
                                        : "❤️"}
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
            </div>

            <div className="relative">
            <button
              onClick={() => {
                setIsProfileOpen((current) => !current);
                setIsNotificationsOpen(false);
                setIsMoreOpen(false);
              }}
              style={!isLogin ? { backgroundColor: `${accent}22`, color: accent } : undefined}
              className={`ui-pressable flex items-center gap-2 rounded-[1rem] border border-white/35 px-1.5 py-1 pr-3 text-sm font-bold shadow-lg backdrop-blur ${
                isLogin
                  ? "bg-white/75 text-[#be123c] dark:bg-white/10 dark:text-white"
                  : ""
              }`}
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
            </button>

            {isProfileOpen && (
              <div className="app-glass absolute right-0 top-11 w-56 overflow-hidden rounded-[1.25rem] p-2 text-[#7f1d1d] dark:text-white">
                <div className="px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-wide opacity-55">
                    Профиль
                  </p>
                  <p className="mt-1 truncate font-black">{profile.name}</p>
                </div>
                <Link
                  href="/profile"
                  onClick={() => setIsProfileOpen(false)}
                  className="mb-2 block rounded-2xl bg-white/70 px-4 py-3 font-black shadow-inner transition hover:bg-black/5 dark:bg-white/10 dark:hover:bg-white/15"
                >
                  Открыть профиль
                </Link>
                <button
                  type="button"
                  onClick={toggleCompactMode}
                  className="mb-2 w-full rounded-2xl bg-white/70 px-4 py-3 text-left font-black shadow-inner transition hover:bg-black/5 dark:bg-white/10 dark:hover:bg-white/15"
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
              </div>
            )}
          </div>
          </div>
        ) : (
          <Link
            href="/login"
            style={!isLogin ? { backgroundColor: accent } : undefined}
            className={`rounded-full px-5 py-2 font-semibold shadow-lg transition hover:-translate-y-0.5 hover:opacity-90 ${
              isLogin
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "text-white"
            }`}
          >
            Войти
          </Link>
        )}
      </nav>
    </header>
  );
}
