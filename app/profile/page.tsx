"use client";

import { supabase } from "@/lib/supabaseClient";
import { compressImageFile } from "@/lib/imageCompression";
import { profileUpdatedEventName } from "@/lib/profileEvents";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Couple = {
  id: string;
  invite_code: string;
  partner_one_id: string | null;
  partner_two_id: string | null;
};

type CoupleProfile = {
  id: string;
  couple_id: string;
  partner_one: string;
  partner_two: string;
  start_date: string;
  avatar?: string | null;
  avatar_one?: string | null;
  avatar_two?: string | null;
};

function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function fallbackName(email?: string) {
  return email?.split("@")[0] || "Профиль";
}

function notifyProfileUpdated(profile: { name?: string; avatar?: string | null }) {
  window.dispatchEvent(new CustomEvent(profileUpdatedEventName, { detail: profile }));
}

export default function ProfilePage() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [couple, setCouple] = useState<Couple | null>(null);
  const [profile, setProfile] = useState<CoupleProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(false);

  const isPartnerOne = useMemo(
    () => Boolean(currentUserId && couple?.partner_one_id === currentUserId),
    [couple?.partner_one_id, currentUserId]
  );

  async function ensureCoupleProfile(activeCouple: Couple) {
    const { data: existingProfile } = await supabase
      .from("couple_profiles")
      .select("*")
      .eq("couple_id", activeCouple.id)
      .limit(1)
      .maybeSingle<CoupleProfile>();

    if (existingProfile) return existingProfile;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const response = await fetch("/api/couple/profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {}),
      },
      body: JSON.stringify({ coupleId: activeCouple.id }),
    });

    const result = (await response.json()) as {
      profile?: CoupleProfile;
      error?: string;
    };

    if (!response.ok || !result.profile) {
      throw new Error(result.error || "Не удалось создать профиль пары");
    }

    return result.profile;
  }

  async function loadData() {
    setIsLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    setCurrentUserId(user.id);
    setUserEmail(user.email);

    const { data: coupleData } = await supabase
      .from("couples")
      .select("*")
      .or(`partner_one_id.eq.${user.id},partner_two_id.eq.${user.id}`)
      .limit(1)
      .maybeSingle<Couple>();

    if (!coupleData) {
      setCouple(null);
      setProfile(null);
      setDisplayName(fallbackName(user.email));
      setAvatarUrl(null);
      setIsLoading(false);
      return;
    }

    setCouple(coupleData);

    try {
      const activeProfile = await ensureCoupleProfile(coupleData);
      const userIsPartnerOne = user.id === coupleData.partner_one_id;
      setProfile(activeProfile);
      setDisplayName(
        userIsPartnerOne ? activeProfile.partner_one : activeProfile.partner_two
      );
      setAvatarUrl(
        userIsPartnerOne
          ? activeProfile.avatar_one || activeProfile.avatar || null
          : activeProfile.avatar_two || activeProfile.avatar || null
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка загрузки профиля");
    }

    setIsLoading(false);
  }

  useEffect(() => {
    queueMicrotask(() => {
      setIsDarkTheme(localStorage.getItem("theme") === "dark");
    });

    const timer = window.setTimeout(() => {
      loadData();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleDarkTheme() {
    const nextTheme = !isDarkTheme;
    setIsDarkTheme(nextTheme);

    if (nextTheme) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }

  async function createCouple() {
    if (!currentUserId) return;

    setIsSaving(true);
    const code = generateInviteCode();

    const { data, error } = await supabase
      .from("couples")
      .insert([
        {
          invite_code: code,
          partner_one_id: currentUserId,
        },
      ])
      .select()
      .single<Couple>();

    if (error || !data) {
      setMessage(error?.message || "Ошибка создания пары");
      setIsSaving(false);
      return;
    }

    setCouple(data);
    const activeProfile = await ensureCoupleProfile(data);
    setProfile(activeProfile);
    setDisplayName(activeProfile.partner_one || fallbackName(userEmail));
    setAvatarUrl(activeProfile.avatar_one || activeProfile.avatar || null);
    setMessage("Пара создана. Отправьте invite-код партнёру");
    setIsSaving(false);
  }

  async function joinCouple() {
    if (!currentUserId) return;

    setIsSaving(true);
    const normalizedCode = inviteCode.trim().toUpperCase();

    const { data: foundCouple, error: findError } = await supabase
      .from("couples")
      .select("*")
      .eq("invite_code", normalizedCode)
      .is("partner_two_id", null)
      .maybeSingle<Couple>();

    if (findError || !foundCouple) {
      setMessage("Код не найден или уже использован");
      setIsSaving(false);
      return;
    }

    if (foundCouple.partner_one_id === currentUserId) {
      setMessage("Вы уже состоите в этой паре");
      setIsSaving(false);
      return;
    }

    const { data, error } = await supabase
      .from("couples")
      .update({
        partner_two_id: currentUserId,
      })
      .eq("id", foundCouple.id)
      .select()
      .single<Couple>();

    if (error || !data) {
      setMessage(error?.message || "Ошибка присоединения");
      setIsSaving(false);
      return;
    }

    setCouple(data);
    const activeProfile = await ensureCoupleProfile(data);
    setProfile(activeProfile);
    setDisplayName(activeProfile.partner_two || fallbackName(userEmail));
    setAvatarUrl(activeProfile.avatar_two || activeProfile.avatar || null);
    setMessage("Вы присоединились к паре");
    setIsSaving(false);
  }

  async function saveProfile() {
    if (!profile || !couple || !currentUserId) return;

    setIsSaving(true);
    const nameField = isPartnerOne ? "partner_one" : "partner_two";
    const { data, error } = await supabase
      .from("couple_profiles")
      .update({ [nameField]: displayName.trim() || fallbackName(userEmail) })
      .eq("couple_id", couple.id)
      .select()
      .returns<CoupleProfile[]>();

    const nextProfile = data?.[0];

    if (error || !nextProfile) {
      setMessage(error?.message || "Не удалось сохранить профиль");
      setIsSaving(false);
      return;
    }

    const nextName = isPartnerOne ? nextProfile.partner_one : nextProfile.partner_two;
    await supabase.auth.updateUser({
      data: {
        name: nextName,
        full_name: nextName,
      },
    });
    setProfile(nextProfile);
    setDisplayName(nextName);
    setMessage("Профиль обновлён");
    notifyProfileUpdated({ name: nextName, avatar: avatarUrl });
    setIsSaving(false);
  }

  async function uploadAvatar(file: File) {
    if (!profile || !couple || !currentUserId) return;

    setIsSaving(true);
    const compressedAvatar = await compressImageFile(file, {
      maxWidth: 900,
      maxHeight: 900,
      quality: 0.82,
    });
    const filePath = `${currentUserId}/${crypto.randomUUID()}.webp`;
    const avatarField = isPartnerOne ? "avatar_one" : "avatar_two";

    const { error: uploadError } = await supabase.storage
      .from("profile-avatars")
      .upload(filePath, compressedAvatar, { upsert: true });

    if (uploadError) {
      setMessage(uploadError.message);
      setIsSaving(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("profile-avatars")
      .getPublicUrl(filePath);

    const { data, error } = await supabase
      .from("couple_profiles")
      .update({ [avatarField]: publicUrlData.publicUrl })
      .eq("couple_id", couple.id)
      .select()
      .returns<CoupleProfile[]>();

    const nextProfile = data?.[0];

    if (error || !nextProfile) {
      setMessage(error?.message || "Не удалось сохранить фото");
      setIsSaving(false);
      return;
    }

    await supabase.auth.updateUser({
      data: {
        avatar_url: publicUrlData.publicUrl,
      },
    });
    setProfile(nextProfile);
    setAvatarUrl(publicUrlData.publicUrl);
    setMessage("Фото обновлено");
    notifyProfileUpdated({ name: displayName, avatar: publicUrlData.publicUrl });
    setIsSaving(false);
  }

  async function leaveCouple() {
    if (!couple || !currentUserId) return;

    setIsSaving(true);
    const updates =
      couple.partner_one_id === currentUserId
        ? couple.partner_two_id
          ? { partner_one_id: couple.partner_two_id, partner_two_id: null }
          : { partner_one_id: null, partner_two_id: null }
        : { partner_two_id: null };

    const { error } = await supabase.from("couples").update(updates).eq("id", couple.id);

    if (error) {
      setMessage(error.message);
      setIsSaving(false);
      return;
    }

    setCouple(null);
    setProfile(null);
    setAvatarUrl(null);
    setDisplayName(fallbackName(userEmail));
    setMessage("Вы покинули пару");
    setIsSaving(false);
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#fff7ed] to-[#fde7c8] px-6 pt-28 text-[#92400e] dark:from-[#1c0f08] dark:to-[#090502] dark:text-white">
        <div className="rounded-3xl bg-white/55 p-8 font-black shadow-2xl backdrop-blur dark:bg-white/10">
          Загружаем профиль...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#fff7ed] via-[#fffbf5] to-[#fde7c8] px-6 pb-24 pt-28 text-[#5f2d12] dark:from-[#1c0f08] dark:via-[#0d0704] dark:to-black dark:text-white">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="overflow-hidden rounded-[1.5rem] border border-white/45 bg-white/48 p-3 shadow-[0_32px_110px_rgba(146,64,14,0.18)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/5 sm:rounded-[2rem] sm:p-6">
          <div className="rounded-[1.25rem] bg-white/45 p-4 shadow-inner dark:bg-black/20 sm:rounded-[1.6rem] sm:p-6">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-[#92400e]/70 dark:text-white/55">
              Профиль
            </p>
            <h1 className="mt-3 text-4xl font-black">Ваш аккаунт</h1>

            <div className="mt-5 rounded-3xl border border-white/50 bg-white/55 p-4 shadow-inner dark:border-white/10 dark:bg-black/20">
              <div className="flex items-center justify-between gap-4">
                <div className="text-left">
                  <p className="text-sm font-black text-[#92400e] dark:text-amber-100">
                    Тёмная тема
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#92400e]/60 dark:text-white/55">
                    Применяется ко всем страницам сайта.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleDarkTheme}
                  className={`relative h-9 w-16 shrink-0 rounded-full p-1 shadow-inner transition ${
                    isDarkTheme
                      ? "bg-[#92400e]"
                      : "bg-white/85 ring-1 ring-[#92400e]/20"
                  }`}
                  aria-label="Переключить тёмную тему"
                >
                  <span
                    className={`grid h-7 w-7 place-items-center rounded-full bg-white text-sm shadow-lg transition ${
                      isDarkTheme ? "translate-x-7 text-[#92400e]" : "translate-x-0 text-[#92400e]"
                    }`}
                  >
                    {isDarkTheme ? "☀️" : "🌙"}
                  </span>
                </button>
              </div>
            </div>

            <div className="mt-8 flex flex-col items-center text-center">
              <div className="relative">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={displayName}
                    width={128}
                    height={128}
                    sizes="128px"
                    className="h-32 w-32 rounded-full object-cover shadow-2xl ring-4 ring-white/70"
                  />
                ) : (
                  <div className="flex h-32 w-32 items-center justify-center rounded-full bg-white/65 text-5xl font-black shadow-2xl ring-4 ring-white/60 dark:bg-white/10">
                    {displayName.slice(0, 1).toUpperCase() || "♡"}
                  </div>
                )}
              </div>

              <label className="mt-5 cursor-pointer rounded-full bg-[#92400e] px-5 py-3 font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#b45309]">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) uploadAvatar(file);
                  }}
                  disabled={!profile || isSaving}
                />
                Изменить фото
              </label>
            </div>

            <div className="mt-8">
              <label className="text-sm font-black text-[#92400e]/70 dark:text-white/60">
                Ваше имя
              </label>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Введите имя"
                disabled={!profile}
                className="mt-2 h-14 w-full rounded-2xl border border-white/45 bg-white/72 px-4 font-bold outline-none transition focus:border-[#d97706] focus:shadow-[0_0_0_5px_rgba(217,119,6,0.16)] disabled:cursor-not-allowed disabled:opacity-55 dark:border-white/10 dark:bg-white/10"
              />
              <button
                onClick={saveProfile}
                disabled={!profile || isSaving}
                className="mt-4 w-full rounded-2xl bg-[#92400e] px-5 py-4 font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#b45309] disabled:cursor-not-allowed disabled:opacity-55"
              >
                {isSaving ? "Сохраняем..." : "Сохранить профиль"}
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-[1.5rem] border border-white/45 bg-white/48 p-3 shadow-[0_32px_110px_rgba(146,64,14,0.14)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/5 sm:rounded-[2rem] sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.22em] text-[#92400e]/70 dark:text-white/55">
                  Пара
                </p>
                <h2 className="mt-2 text-3xl font-black">
                  {couple ? "Ваша пара создана" : "Создайте пару"}
                </h2>
              </div>
              {couple && (
                <div className="rounded-full bg-white/65 px-4 py-2 text-sm font-black shadow-inner dark:bg-white/10">
                  Invite: {couple.invite_code}
                </div>
              )}
            </div>

            {couple ? (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl bg-white/45 p-5 shadow-inner dark:bg-white/5">
                  <p className="text-sm font-black text-[#92400e]/70 dark:text-white/60">
                    Код приглашения
                  </p>
                  <p className="mt-2 text-5xl font-black tracking-widest">
                    {couple.invite_code}
                  </p>
                  <p className="mt-3 text-sm font-semibold text-[#92400e]/65 dark:text-white/60">
                    Отправьте этот код партнёру, чтобы он присоединился.
                  </p>
                </div>
                <div className="rounded-3xl bg-white/45 p-5 shadow-inner dark:bg-white/5">
                  <p className="text-sm font-black text-[#92400e]/70 dark:text-white/60">
                    Участники
                  </p>
                  <p className="mt-3 font-black">
                    {profile?.partner_one || "Партнёр 1"}
                  </p>
                  <p className="mt-2 font-black">
                    {profile?.partner_two || "Партнёр 2"}
                  </p>
                  <button
                    onClick={leaveCouple}
                    disabled={isSaving}
                    className="mt-5 rounded-full bg-white/75 px-5 py-3 font-black text-[#92400e] shadow-lg transition hover:bg-amber-50 disabled:opacity-55 dark:bg-white/10 dark:text-white dark:hover:bg-amber-500/15"
                  >
                    Покинуть пару
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <div className="rounded-3xl bg-white/45 p-5 shadow-inner dark:bg-white/5">
                  <h3 className="text-xl font-black">Создать пару</h3>
                  <p className="mt-2 text-sm font-semibold text-[#92400e]/65 dark:text-white/60">
                    Создайте invite-код и отправьте его партнёру.
                  </p>
                  <button
                    onClick={createCouple}
                    disabled={isSaving}
                    className="mt-5 w-full rounded-2xl bg-[#92400e] px-5 py-4 font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#b45309] disabled:opacity-55"
                  >
                    Создать пару
                  </button>
                </div>

                <div className="rounded-3xl bg-white/45 p-5 shadow-inner dark:bg-white/5">
                  <h3 className="text-xl font-black">Присоединиться</h3>
                  <input
                    value={inviteCode}
                    onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                    placeholder="INVITE-КОД"
                    className="mt-4 h-14 w-full rounded-2xl border border-white/45 bg-white/72 px-4 font-black uppercase tracking-widest outline-none transition focus:border-[#d97706] focus:shadow-[0_0_0_5px_rgba(217,119,6,0.16)] dark:border-white/10 dark:bg-white/10"
                  />
                  <button
                    onClick={joinCouple}
                    disabled={isSaving}
                    className="mt-4 w-full rounded-2xl bg-[#92400e] px-5 py-4 font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#b45309] disabled:opacity-55"
                  >
                    Присоединиться
                  </button>
                </div>
              </div>
            )}
          </div>

          {message && (
            <div className="rounded-3xl bg-white/55 p-5 text-center font-black text-[#92400e] shadow-lg backdrop-blur dark:bg-white/10 dark:text-white">
              {message}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

