"use client";

import { supabase } from "@/lib/supabaseClient";
import { profileUpdatedEventName } from "@/lib/profileEvents";
import { useDashboardAccent } from "@/lib/useDashboardAccent";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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

function getFallbackName(user: User) {
  const login = user.user_metadata?.login;
  const fullName = user.user_metadata?.full_name;
  const name = user.user_metadata?.name;
  if (typeof login === "string" && login.trim()) return login.trim();
  if (typeof fullName === "string" && fullName.trim()) return fullName.trim();
  if (typeof name === "string" && name.trim()) return name.trim();
  return user.email?.split("@")[0] || "Профиль";
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

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const dashboardAccent = useDashboardAccent();

  useEffect(() => {
    let ignore = false;

    async function loadProfile(user: User | null) {
      if (!user) {
        if (!ignore) {
          setProfile(null);
          setIsLoadingUser(false);
        }
        return;
      }

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
          nextProfile = {
            name: isPartnerOne ? coupleProfile.partner_one : coupleProfile.partner_two,
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

    return () => {
      ignore = true;
      window.removeEventListener(profileUpdatedEventName, handleProfileUpdated);
      subscription.unsubscribe();
    };
  }, []);

  const isLogin = pathname.startsWith("/login");
  const isHome = pathname === "/";
  const isMemories = pathname.startsWith("/memories");
  const isQuestions = pathname.startsWith("/questions");
  const isQuizzes = pathname.startsWith("/quizzes");
  const isDashboard = pathname.startsWith("/dashboard");
  const homeAccent = "#9f1239";

  const accent = isLogin
    ? "#f3f4f6"
    : isHome
      ? homeAccent
      : isMemories
        ? "#1a73e8"
        : isQuestions
          ? "#27ae60"
          : isQuizzes
            ? "#7c3aed"
            : isDashboard
              ? dashboardAccent
              : "#1c8b59";

  const navStyle = isHome
    ? {
        background:
          "linear-gradient(135deg, rgba(159, 18, 57, 0.2), rgba(192, 38, 211, 0.16))",
        borderColor: "rgba(159, 18, 57, 0.24)",
        boxShadow: "0 18px 58px rgba(159, 18, 57, 0.2)",
      }
    : isDashboard && !isLogin
      ? {
          backgroundColor: `${dashboardAccent}24`,
          borderColor: `${dashboardAccent}55`,
          boxShadow: `0 12px 40px ${dashboardAccent}33`,
        }
      : undefined;

  async function logout() {
    setIsProfileOpen(false);
    await supabase.auth.signOut();
    setProfile(null);
    router.push("/login");
  }

  return (
    <header className="fixed left-0 top-0 z-30 w-full px-6 py-4">
      <nav
        style={navStyle}
        className="mx-auto flex max-w-6xl items-center justify-between rounded-full border border-white/30 bg-white/35 px-6 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-colors dark:border-white/10 dark:bg-black/25 dark:shadow-black/40"
      >
        <Link
          href="/"
          style={!isLogin ? { color: accent } : undefined}
          className={`text-xl font-bold opacity-90 transition hover:opacity-100 ${
            isLogin ? "text-gray-800 dark:text-gray-100" : ""
          }`}
        >
          ❤️ Couple Space
        </Link>

        <div className="hidden gap-6 md:flex">
          {[
            ["Главная", "/"],
            ["Кабинет", "/dashboard"],
            ["Воспоминания", "/memories"],
            ["Вопросы", "/questions"],
            ["Викторины", "/quizzes"],
          ].map(([label, href]) => (
            <Link
              key={href}
              href={href}
              style={!isLogin ? { color: accent } : undefined}
              className={`opacity-80 transition hover:opacity-100 ${
                isLogin ? "text-gray-700 dark:text-gray-200" : ""
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {isLoadingUser ? (
          <div
            className="h-11 w-32 animate-pulse rounded-full"
            style={{
              backgroundColor: isLogin
                ? "#f3f4f6"
                : isHome
                  ? "#dc2626"
                  : isMemories
                    ? "#1a73e8"
                    : isQuestions
                      ? "#27ae60"
                      : isQuizzes
                        ? "#7c3aed"
                        : isDashboard
                          ? dashboardAccent
                          : "#1c8b59",
            }}
          />
        ) : profile ? (
          <div className="relative">
            <button
              onClick={() => setIsProfileOpen((current) => !current)}
              style={!isLogin ? { backgroundColor: `${accent}22`, color: accent } : undefined}
              className={`flex items-center gap-3 rounded-full border border-white/35 px-2 py-1.5 pr-4 font-bold shadow-lg backdrop-blur transition hover:-translate-y-0.5 hover:shadow-xl ${
                isLogin
                  ? "bg-white/75 text-[#be123c] dark:bg-white/10 dark:text-white"
                  : ""
              }`}
            >
              {profile.avatar ? (
                <img
                  src={profile.avatar}
                  alt={profile.name}
                  className="h-9 w-9 rounded-full object-cover ring-2 ring-white/70"
                />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/75 text-sm font-black shadow-inner dark:bg-white/10">
                  {getInitial(profile.name)}
                </span>
              )}
              <span className="hidden max-w-28 truncate sm:block">{profile.name}</span>
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 top-14 w-56 overflow-hidden rounded-3xl border border-white/45 bg-white/90 p-2 text-[#7f1d1d] shadow-[0_24px_80px_rgba(127,29,29,0.22)] backdrop-blur-2xl dark:border-white/10 dark:bg-black/80 dark:text-white">
                <div className="px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-wide opacity-55">
                    Профиль
                  </p>
                  <p className="mt-1 truncate font-black">{profile.name}</p>
                </div>
                <Link
                  href="/profile"
                  onClick={() => setIsProfileOpen(false)}
                  className="mb-2 block rounded-2xl bg-white/70 px-4 py-3 font-black shadow-inner transition hover:bg-white dark:bg-white/10 dark:hover:bg-white/15"
                >
                  Открыть профиль
                </Link>
                <button
                  onClick={logout}
                  className="w-full rounded-2xl bg-[#dc2626] px-4 py-3 text-left font-black text-white shadow-lg transition hover:bg-[#ef4444]"
                >
                  Выйти
                </button>
              </div>
            )}
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
