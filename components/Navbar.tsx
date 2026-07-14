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
import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
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
  const accent = isLogin ? "#be123c" : theme.accent;
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
    setIsActionsOpen(false);
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
    setIsActionsOpen(false);

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

  const navStyle = { "--desktop-nav-accent": accent } as CSSProperties;

  return (
    <header className="desktop-sidebar fixed inset-y-3 left-3 z-40 hidden w-[4.5rem] lg:block 2xl:w-[13.5rem]">
      <nav
        aria-label="Основная навигация"
        style={navStyle}
        className="desktop-matte-rail flex h-full w-full flex-col p-2"
      >
        <Link href="/" className="desktop-rail-brand group relative" aria-label="Couple Space">
          <NavIcon name="home" className="h-8 w-8" />
          <span className="desktop-rail-label">Couple Space</span>
          <span className="desktop-rail-tooltip" aria-hidden="true">Couple Space</span>
        </Link>

        <div className="desktop-rail-divider" />

        <div className="grid gap-1">
          {primaryNavLinks.map((link) => {
            const isActive = isActivePath(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={`desktop-rail-item group relative ${isActive ? "desktop-rail-item-active" : ""}`}
              >
                <NavIcon name={link.icon} className="h-8 w-8" />
                <span className="desktop-rail-label">{link.label}</span>
                <span className="desktop-rail-tooltip" aria-hidden="true">{link.label}</span>
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
                setIsActionsOpen(false);
              }}
              className={`desktop-rail-item group relative w-full ${isSecondaryActive || isMoreOpen ? "desktop-rail-item-active" : ""}`}
              aria-expanded={isMoreOpen}
            >
              <NavIcon name="more" className="h-8 w-8" />
              <span className="desktop-rail-label">Ещё</span>
              <span className="desktop-rail-tooltip" aria-hidden="true">Ещё</span>
            </button>

            {isMoreOpen && (
              <div className="desktop-matte-popover absolute left-[calc(100%+0.75rem)] top-0 w-72 p-2">
                <p className="desktop-popover-title">Разделы</p>
                <div className="grid gap-1">
                  {secondaryNavLinks.map((link) => {
                    const isActive = isActivePath(pathname, link.href);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setIsMoreOpen(false)}
                        className={`desktop-popover-row ${isActive ? "desktop-popover-row-active" : ""}`}
                      >
                        <NavIcon name={link.icon} className="h-9 w-9" />
                        <span className="min-w-0">
                          <span className="block truncate font-extrabold">{link.label}</span>
                          <span className="block truncate text-xs font-semibold opacity-65">{link.description}</span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-auto grid gap-1">
          {isLoadingUser ? (
            <div className="desktop-rail-loading animate-pulse" />
          ) : profile ? (
            <>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsActionsOpen((current) => !current);
                    setIsNotificationsOpen(false);
                    setIsProfileOpen(false);
                    setIsMoreOpen(false);
                  }}
                  className={`desktop-rail-item group relative w-full ${isActionsOpen ? "desktop-rail-item-active" : ""}`}
                  aria-label="Быстрые действия"
                  aria-expanded={isActionsOpen}
                >
                  <NavIcon name="plus" className="h-8 w-8" />
                  <span className="desktop-rail-label">Добавить</span>
                  <span className="desktop-rail-tooltip" aria-hidden="true">Добавить</span>
                </button>

                {isActionsOpen && (
                  <div className="desktop-matte-popover absolute bottom-0 left-[calc(100%+0.75rem)] w-72 p-2">
                    <p className="desktop-popover-title">Быстро добавить</p>
                    <div className="grid gap-1">
                      {quickNavActions.map((action) => (
                        <Link
                          key={action.href + action.label}
                          href={action.href}
                          onClick={() => setIsActionsOpen(false)}
                          className="desktop-popover-row"
                        >
                          <NavIcon name={action.icon} className="h-9 w-9" />
                          <span className="min-w-0">
                            <span className="block truncate font-extrabold">{action.label}</span>
                            <span className="block truncate text-xs font-semibold opacity-65">{action.description}</span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={openNotifications}
                  className={`desktop-rail-item group relative w-full ${isNotificationsOpen ? "desktop-rail-item-active" : ""}`}
                  aria-label="Уведомления"
                  aria-expanded={isNotificationsOpen}
                >
                  <NavIcon name="notifications" className="h-8 w-8" />
                  <span className="desktop-rail-label">Уведомления</span>
                  <span className="desktop-rail-tooltip" aria-hidden="true">Уведомления</span>
                  {unreadNotifications > 0 && (
                    <span className="desktop-notification-badge">
                      {unreadNotifications > 9 ? "9+" : unreadNotifications}
                    </span>
                  )}
                </button>

                {isNotificationsOpen && (
                  <div className="desktop-matte-popover absolute bottom-0 left-[calc(100%+0.75rem)] w-[22rem] p-2">
                    <div className="flex items-center justify-between px-3 py-2">
                      <div>
                        <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Уведомления</p>
                        <p className="mt-1 text-sm font-bold">Новые события пары</p>
                      </div>
                      {notifications.length > 0 && (
                        <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-black dark:bg-slate-800">
                          {notifications.length}
                        </span>
                      )}
                    </div>
                    <div className="max-h-96 overflow-y-auto px-1 pb-1">
                      {notifications.length === 0 ? (
                        <div className="rounded-xl bg-slate-100 px-4 py-5 text-sm font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          Пока уведомлений нет.
                        </div>
                      ) : (
                        notifications.map((notification) => (
                          <Link
                            key={notification.id}
                            href={notification.href || "/dashboard"}
                            onClick={() => setIsNotificationsOpen(false)}
                            className="desktop-notification-row"
                          >
                            <NavIcon name={getNotificationIcon(notification.type)} className="h-9 w-9" />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                {!notification.read_at && <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" />}
                                <span className="truncate font-extrabold">{notification.title}</span>
                              </span>
                              {notification.body && (
                                <span className="mt-1 line-clamp-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                                  {notification.body}
                                </span>
                              )}
                              <span className="mt-2 block text-xs font-bold text-slate-400">
                                {formatNotificationTime(notification.created_at)}
                              </span>
                            </span>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen((current) => !current);
                    setIsNotificationsOpen(false);
                    setIsMoreOpen(false);
                    setIsActionsOpen(false);
                  }}
                  className={`desktop-rail-item group relative w-full ${isProfileOpen ? "desktop-rail-item-active" : ""}`}
                  aria-label="Профиль"
                  aria-expanded={isProfileOpen}
                >
                  {profile.avatar ? (
                    <Image
                      src={profile.avatar}
                      alt=""
                      width={34}
                      height={34}
                      sizes="34px"
                      className="h-[2.125rem] w-[2.125rem] shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="desktop-profile-initial">{getInitial(profile.name)}</span>
                  )}
                  <span className="desktop-rail-label truncate">{profile.name}</span>
                  <span className="desktop-rail-tooltip" aria-hidden="true">{profile.name}</span>
                </button>

                {isProfileOpen && (
                  <div className="desktop-matte-popover absolute bottom-0 left-[calc(100%+0.75rem)] w-64 p-2">
                    <div className="px-3 py-2">
                      <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Профиль</p>
                      <p className="mt-1 truncate font-black">{profile.name}</p>
                    </div>
                    <Link href="/profile" onClick={() => setIsProfileOpen(false)} className="desktop-profile-action">
                      Открыть профиль
                    </Link>
                    <button type="button" onClick={toggleCompactMode} className="desktop-profile-action">
                      {isCompact ? "Обычная плотность" : "Компактная плотность"}
                    </button>
                    <div className="mb-1"><PushNotificationButton accent={accent} /></div>
                    <button type="button" onClick={logout} className="desktop-profile-action desktop-profile-action-danger">
                      Выйти
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Link href="/login" className="desktop-rail-item desktop-rail-item-active group relative">
              <NavIcon name="profile" className="h-8 w-8" />
              <span className="desktop-rail-label">Войти</span>
              <span className="desktop-rail-tooltip" aria-hidden="true">Войти</span>
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
