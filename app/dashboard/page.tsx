"use client";

import { supabase } from "@/lib/supabaseClient";
import {
  dashboardAccentEventName,
  dashboardAccentStorageKey,
  dashboardThemeAccents,
  type DashboardThemeKey,
} from "@/lib/dashboardTheme";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Cropper from "react-easy-crop";

type CoupleProfile = {
  partner_one: string;
  partner_two: string;
  start_date: string;
  id: string;
  avatar?: string | null;
  avatar_one?: string | null;
  avatar_two?: string | null;
};

type Couple = {
  id: string;
  partner_one_id: string;
  partner_two_id: string | null;
};

type CropPixels = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type DashboardStats = {
  memories: number;
  questionAnswers: number;
  streak: number;
};

type ActivityItem = {
  id: string;
  text: string;
  time: string;
};

type ThemeKey = DashboardThemeKey;

const themes: Record<
  ThemeKey,
  {
    name: string;
    page: string;
    text: string;
    muted: string;
    panel: string;
    soft: string;
    button: string;
    buttonHover: string;
    darkPage: string;
    darkPanel: string;
  }
> = {
  rose: {
    name: "Rose",
    page: "from-[#ffe7ef] to-[#fff7f8]",
    text: "text-[#dc2626]",
    muted: "text-[#dc2626]/70",
    panel: "from-[#ffd6e3] to-[#ffe3ec]",
    soft: "bg-white/35",
    button: "bg-[#dc2626]",
    buttonHover: "hover:bg-[#ff5a6b]",
    darkPage: "dark:from-[#2a080c] dark:to-[#140704]",
    darkPanel: "dark:from-[#3a1017] dark:to-[#24070c]",
  },
  emerald: {
    name: "Emerald",
    page: "from-[#e2fff2] to-[#f5fff9]",
    text: "text-[#15803d]",
    muted: "text-[#15803d]/70",
    panel: "from-[#c9f4dd] to-[#e3f9ec]",
    soft: "bg-white/35",
    button: "bg-[#15803d]",
    buttonHover: "hover:bg-[#22c55e]",
    darkPage: "dark:from-[#041f0f] dark:to-[#011209]",
    darkPanel: "dark:from-[#123025] dark:to-[#0d1e17]",
  },
  ocean: {
    name: "Ocean",
    page: "from-[#e2f0ff] to-[#f4f9ff]",
    text: "text-[#1a73e8]",
    muted: "text-[#1a73e8]/70",
    panel: "from-[#c5dcf0] to-[#dcecff]",
    soft: "bg-white/35",
    button: "bg-[#1a73e8]",
    buttonHover: "hover:bg-[#2380e0]",
    darkPage: "dark:from-[#001923] dark:to-[#000e13]",
    darkPanel: "dark:from-[#0f2b40] dark:to-[#0b2235]",
  },
  midnight: {
    name: "Midnight",
    page: "from-[#e9e7ff] to-[#f8f7ff]",
    text: "text-[#5b21b6]",
    muted: "text-[#5b21b6]/70",
    panel: "from-[#d7ccff] to-[#eee8ff]",
    soft: "bg-white/35",
    button: "bg-[#5b21b6]",
    buttonHover: "hover:bg-[#7c3aed]",
    darkPage: "dark:from-[#09020f] dark:to-[#020106]",
    darkPanel: "dark:from-[#241238] dark:to-[#13071f]",
  },
};

function localKey(coupleId: string, key: string) {
  return `couple-space:dashboard:${coupleId}:${key}`;
}

function initials(name?: string | null) {
  return (name || "?").trim().slice(0, 1).toUpperCase();
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function daysUntil(date: string) {
  if (!date) return null;

  const today = new Date();
  const target = new Date(date);
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function calculateStreak(dates: string[]) {
  const uniqueDates = [...new Set(dates)].sort((a, b) => b.localeCompare(a));
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  let streak = 0;

  for (const date of uniqueDates) {
    const current = new Date(date);
    current.setHours(0, 0, 0, 0);

    if (current.getTime() === cursor.getTime()) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else if (streak === 0) {
      cursor.setDate(cursor.getDate() - 1);
      if (current.getTime() === cursor.getTime()) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      }
    } else {
      break;
    }
  }

  return streak;
}

function AvatarBubble({
  name,
  image,
  size = "large",
}: {
  name?: string | null;
  image?: string | null;
  size?: "large" | "small";
}) {
  const sizeClass = size === "large" ? "h-24 w-24 text-4xl" : "h-14 w-14 text-xl";

  if (image) {
    return (
      <img
        src={image}
        alt={name || "Аватар"}
        className={`${sizeClass} rounded-full object-cover shadow-xl ring-4 ring-white/60`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} flex items-center justify-center rounded-full bg-white/55 font-bold shadow-xl ring-4 ring-white/50 backdrop-blur dark:bg-white/10`}
    >
      {initials(name)}
    </div>
  );
}

function CroppedPreview({
  imageSrc,
  croppedArea,
  size = 100,
}: {
  imageSrc: string;
  croppedArea: CropPixels;
  size?: number;
}) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;

    img.onload = () => {
      ctx.drawImage(
        img,
        croppedArea.x,
        croppedArea.y,
        croppedArea.width,
        croppedArea.height,
        0,
        0,
        size,
        size
      );

      setPreview(canvas.toDataURL("image/webp"));
    };
  }, [imageSrc, croppedArea, size]);

  if (!preview) {
    return <div className="h-24 w-24 rounded-full bg-gray-300 dark:bg-gray-700" />;
  }

  return (
    <img
      src={preview}
      alt="Preview"
      className="h-24 w-24 rounded-full object-cover shadow-lg"
    />
  );
}

export default function DashboardPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<CoupleProfile | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [startDate, setStartDate] = useState("");
  const [daysTogether, setDaysTogether] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [avatarMessage, setAvatarMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [avatarOneUrl, setAvatarOneUrl] = useState<string | null>(null);
  const [avatarTwoUrl, setAvatarTwoUrl] = useState<string | null>(null);
  const [croppingImage, setCroppingImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] =
    useState<CropPixels | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    memories: 0,
    questionAnswers: 0,
    streak: 0,
  });
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [themeKey, setThemeKey] = useState<ThemeKey>("rose");
  const [song, setSong] = useState("");
  const [eventTitle, setEventTitle] = useState("Годовщина");
  const [eventDate, setEventDate] = useState("");
  const [mood, setMood] = useState("😊");
  const [currentYear] = useState(() => new Date().getFullYear());

  const theme = themes[themeKey];

  useEffect(() => {
    const accent = dashboardThemeAccents[themeKey];
    localStorage.setItem(dashboardAccentStorageKey, accent);
    window.dispatchEvent(
      new CustomEvent(dashboardAccentEventName, {
        detail: accent,
      })
    );
  }, [themeKey]);

  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setCurrentUserId(user.id);

      const { data: coupleData, error: coupleError } = await supabase
        .from("couples")
        .select("*")
        .or(`partner_one_id.eq.${user.id},partner_two_id.eq.${user.id}`)
        .limit(1)
        .single();

      if (coupleError || !coupleData) {
        router.push("/couple");
        return;
      }

      setCouple(coupleData);

      const { data: profileData, error: profileError } = await supabase
        .from("couple_profiles")
        .select("*")
        .eq("couple_id", coupleData.id)
        .limit(1)
        .single();

      let activeProfile = profileData as CoupleProfile | null;

      if (profileError || !profileData) {
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
          body: JSON.stringify({ coupleId: coupleData.id }),
        });

        const result = (await response.json()) as {
          profile?: CoupleProfile;
          error?: string;
        };

        if (!response.ok || !result.profile) {
          console.error(result.error || "Профиль ещё не создан");
          return;
        }

        activeProfile = result.profile;
      }

      if (!activeProfile) return;

      setProfile(activeProfile);
      setStartDate(activeProfile.start_date);
      setAvatarOneUrl(activeProfile.avatar_one || null);
      setAvatarTwoUrl(activeProfile.avatar_two || null);

      const diff = Math.floor(
        (new Date().getTime() - new Date(activeProfile.start_date).getTime()) /
          (1000 * 60 * 60 * 24)
      );

      setDaysTogether(diff);

      const savedTheme = localStorage.getItem(localKey(coupleData.id, "theme"));
      const savedSong = localStorage.getItem(localKey(coupleData.id, "song"));
      const savedEventTitle = localStorage.getItem(localKey(coupleData.id, "event-title"));
      const savedEventDate = localStorage.getItem(localKey(coupleData.id, "event-date"));
      const savedMood = localStorage.getItem(localKey(coupleData.id, "mood"));

      if (savedTheme && savedTheme in themes) {
        setThemeKey(savedTheme as ThemeKey);
      }
      if (savedSong) setSong(savedSong);
      if (savedEventTitle) setEventTitle(savedEventTitle);
      if (savedEventDate) setEventDate(savedEventDate);
      if (savedMood) setMood(savedMood);

      const [{ data: memoriesData }, { data: answerRows }] = await Promise.all([
        supabase
          .from("memories")
          .select("id, text, created_at, user_id")
          .eq("couple_id", coupleData.id)
          .order("created_at", { ascending: false })
          .limit(6),
        supabase
          .from("question_answers")
          .select("date, answer_one, answer_two")
          .eq("couple_id", coupleData.id),
      ]);

      const totalQuestionAnswers =
        answerRows?.reduce((sum, row) => {
          return sum + (row.answer_one ? 1 : 0) + (row.answer_two ? 1 : 0);
        }, 0) || 0;

      setStats({
        memories: memoriesData?.length || 0,
        questionAnswers: totalQuestionAnswers,
        streak: calculateStreak(answerRows?.map((row) => row.date) || []),
      });

      const recentActivity: ActivityItem[] = [];

      memoriesData?.slice(0, 3).forEach((memory) => {
        const author =
          memory.user_id === coupleData.partner_one_id
            ? activeProfile?.partner_one
            : activeProfile?.partner_two;
        recentActivity.push({
          id: memory.id,
          text: `${author || "Партнёр"} добавил воспоминание`,
          time: formatDate(memory.created_at),
        });
      });

      answerRows?.slice(-2).forEach((answer, index) => {
        recentActivity.push({
          id: `answer-${answer.date}-${index}`,
          text: "Появился ответ на вопрос дня",
          time: formatDate(answer.date),
        });
      });

      setActivity(recentActivity.slice(0, 5));
    }

    loadData();
  }, [router]);

  const myName =
    currentUserId === couple?.partner_one_id
      ? profile?.partner_one
      : profile?.partner_two;

  const partnerName =
    currentUserId === couple?.partner_one_id
      ? profile?.partner_two
      : profile?.partner_one;

  const coupleName = `${profile?.partner_one || "Вы"} + ${
    profile?.partner_two || "Партнёр"
  }`;

  const isPartnerOne = currentUserId === couple?.partner_one_id;
  const myAvatarUrl = isPartnerOne ? avatarOneUrl : avatarTwoUrl;
  const partnerAvatarUrl = isPartnerOne ? avatarTwoUrl : avatarOneUrl;
  const heroAvatarUrl = myAvatarUrl || partnerAvatarUrl || profile?.avatar || null;
  const leftHeroUrl = avatarOneUrl || heroAvatarUrl;
  const rightHeroUrl = avatarTwoUrl || heroAvatarUrl;
  const hasHeroCollage = Boolean(leftHeroUrl || rightHeroUrl);

  const relationshipEnergy = useMemo(() => {
    const base = Math.min(92, 55 + stats.streak * 3 + stats.memories * 2);
    return Math.max(64, base);
  }, [stats.memories, stats.streak]);

  const countdownDays = daysUntil(eventDate);
  const startYear = startDate ? new Date(startDate).getFullYear() : currentYear;

  const achievements = [
    {
      label: "7 дней подряд",
      icon: "🔥",
      unlocked: stats.streak >= 7,
    },
    {
      label: "100 ответов",
      icon: "💌",
      unlocked: stats.questionAnswers >= 100,
    },
    {
      label: "50 воспоминаний",
      icon: "📸",
      unlocked: stats.memories >= 50,
    },
    {
      label: "Год вместе",
      icon: "❤️",
      unlocked: daysTogether >= 365,
    },
  ];

  const timeline = [
    {
      year: startYear,
      icon: "❤️",
      title: "Начали встречаться",
      text: startDate ? formatDate(startDate) : "Дата пока не выбрана",
    },
    {
      year: currentYear,
      icon: "📸",
      title: "Воспоминания",
      text: `${stats.memories} сохранено`,
    },
    {
      year: currentYear,
      icon: "💌",
      title: "Вопросы дня",
      text: `${stats.questionAnswers} ответов`,
    },
  ];

  function persistSetting(key: string, value: string) {
    if (!couple) return;
    localStorage.setItem(localKey(couple.id, key), value);
  }

  async function saveStartDate() {
    if (!profile) return;

    setIsSaving(true);

    const { error, data } = await supabase
      .from("couple_profiles")
      .update({ start_date: startDate })
      .eq("id", profile.id)
      .select()
      .single();

    if (error) {
      console.error(error);
      setSaveMessage("Ошибка при сохранении");
    } else if (data) {
      setProfile(data);

      const diff = Math.floor(
        (new Date().getTime() - new Date(data.start_date).getTime()) /
          (1000 * 60 * 60 * 24)
      );

      setDaysTogether(diff);
      setSaveMessage("Дата обновлена ❤️");
    }

    setIsSaving(false);
    setTimeout(() => setSaveMessage(""), 2500);
  }

  function createImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = url;
      img.onload = () => resolve(img);
      img.onerror = reject;
    });
  }

  async function getCroppedImg(
    imageSrc: string,
    pixelCrop: CropPixels
  ): Promise<File> {
    const image = await createImage(imageSrc);

    const canvas = document.createElement("canvas");
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas не поддерживается");
    }

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Не удалось создать изображение"));
            return;
          }

          resolve(
            new File([blob], `${crypto.randomUUID()}.webp`, {
              type: "image/webp",
            })
          );
        },
        "image/webp",
        0.9
      );
    });
  }

  async function saveCroppedAvatar() {
    if (!croppingImage || !croppedAreaPixels || !profile || !currentUserId || !couple) {
      return;
    }

    try {
      const croppedFile = await getCroppedImg(croppingImage, croppedAreaPixels);
      const filePath = `${crypto.randomUUID()}.webp`;
      const avatarField =
        currentUserId === couple.partner_one_id ? "avatar_one" : "avatar_two";

      const { error: uploadError } = await supabase.storage
        .from("profile-avatars")
        .upload(filePath, croppedFile);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("profile-avatars")
        .getPublicUrl(filePath);

      const { error } = await supabase
        .from("couple_profiles")
        .update({ [avatarField]: publicUrlData.publicUrl })
        .eq("id", profile.id);

      if (error) throw error;

      if (avatarField === "avatar_one") {
        setAvatarOneUrl(publicUrlData.publicUrl);
      } else {
        setAvatarTwoUrl(publicUrlData.publicUrl);
      }
      setProfile({
        ...profile,
        [avatarField]: publicUrlData.publicUrl,
      });
      setCroppingImage(null);
      setAvatarMessage("Фото сохранено ❤️");
      setTimeout(() => setAvatarMessage(""), 2500);
    } catch (err) {
      console.error(err);
      setAvatarMessage("Ошибка при сохранении фото");
      setTimeout(() => setAvatarMessage(""), 2500);
    }
  }

  if (!profile || !couple) {
    return (
      <main
        className={`flex min-h-screen items-center justify-center bg-gradient-to-b ${theme.page} ${theme.darkPage} transition-colors`}
      >
        <div
          className={`rounded-3xl bg-gradient-to-b ${theme.panel} ${theme.darkPanel} p-8 text-center shadow-2xl`}
        >
          <p className={`text-lg font-semibold ${theme.text} dark:text-white`}>
            Загружаем кабинет пары...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      className={`min-h-screen bg-gradient-to-b ${theme.page} ${theme.darkPage} px-6 pb-28 pt-28 ${theme.text} transition-colors dark:text-white`}
    >
      <div className="mx-auto max-w-6xl space-y-8">
        <section
          className={`relative min-h-[360px] overflow-hidden rounded-3xl bg-gradient-to-b ${theme.panel} ${theme.darkPanel} p-8 shadow-2xl`}
        >
          {hasHeroCollage && (
            <div className="absolute inset-0 opacity-40">
              <div className="grid h-full w-full grid-cols-2">
                {leftHeroUrl && (
                  <img
                    src={leftHeroUrl}
                    alt="Фото первого участника"
                    className="h-full w-full object-cover"
                  />
                )}
                {rightHeroUrl && (
                  <img
                    src={rightHeroUrl}
                    alt="Фото второго участника"
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="absolute inset-y-0 left-1/2 w-[42%] -translate-x-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent blur-3xl dark:via-black/30" />
              <div className="absolute inset-y-0 left-1/2 w-[34%] -translate-x-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent blur-2xl dark:via-white/5" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/18 via-white/10 to-black/18 dark:via-black/10" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/10 dark:from-black/60" />

          <div className="relative flex min-h-[300px] flex-col justify-between gap-8">
            <div className="flex items-start justify-between gap-4">
              <label className="cursor-pointer rounded-full bg-white/55 px-5 py-2 text-sm font-semibold shadow-lg backdrop-blur transition hover:bg-white/75 dark:bg-black/25 dark:hover:bg-black/35">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    const reader = new FileReader();
                    reader.onloadend = () =>
                      setCroppingImage(reader.result as string);
                    reader.readAsDataURL(file);
                  }}
                  className="hidden"
                />
                {myAvatarUrl ? "Изменить моё фото" : "Добавить моё фото"}
              </label>

              {avatarMessage && (
                <p className="rounded-full bg-white/55 px-4 py-2 text-sm font-semibold shadow-lg backdrop-blur dark:bg-black/25">
                  {avatarMessage}
                </p>
              )}
            </div>

            <div>
              <div className="mb-6 flex items-center justify-center gap-4 md:justify-start">
                <AvatarBubble name={profile.partner_one} image={avatarOneUrl} />
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-2xl shadow-lg">
                  ❤️
                </div>
                <AvatarBubble name={profile.partner_two} image={avatarTwoUrl} />
              </div>

              <p className="text-sm font-semibold uppercase tracking-wide text-white/80">
                Вместе с {startDate ? formatDate(startDate) : "первого дня"}
              </p>
              <h1 className="mt-2 text-5xl font-bold tracking-tight text-white md:text-6xl">
                {coupleName}
              </h1>
              <p className="mt-4 text-3xl font-bold text-white">
                {daysTogether} дней вместе ❤️
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          {[
            ["📸", "Воспоминаний", stats.memories],
            ["💌", "Ответов", stats.questionAnswers],
            ["🔥", "Серия дней", stats.streak],
            ["🗓", "Вместе", daysTogether],
          ].map(([icon, label, value]) => (
            <div
              key={label}
              className={`rounded-3xl bg-gradient-to-b ${theme.panel} ${theme.darkPanel} p-6 shadow-xl`}
            >
              <p className="text-3xl">{icon}</p>
              <p className={`mt-4 text-sm font-semibold ${theme.muted} dark:text-white/65`}>
                {label}
              </p>
              <p className="mt-1 text-4xl font-bold">{value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div
            className={`rounded-3xl bg-gradient-to-b ${theme.panel} ${theme.darkPanel} p-6 shadow-2xl`}
          >
            <h2 className="text-2xl font-bold">Общая карточка пары</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className={`rounded-2xl ${theme.soft} p-5 shadow-inner dark:bg-white/5`}>
                <p className={`text-sm font-semibold ${theme.muted} dark:text-white/65`}>
                  Ваше имя
                </p>
                <p className="mt-2 text-2xl font-bold">{myName}</p>
              </div>
              <div className={`rounded-2xl ${theme.soft} p-5 shadow-inner dark:bg-white/5`}>
                <p className={`text-sm font-semibold ${theme.muted} dark:text-white/65`}>
                  Имя партнёра
                </p>
                <p className="mt-2 text-2xl font-bold">{partnerName}</p>
              </div>
            </div>

            <div className="mt-5">
              <p className={`mb-2 text-sm font-semibold ${theme.muted} dark:text-white/65`}>
                Дата начала отношений
              </p>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-2xl border border-white/40 bg-white/70 p-4 outline-none dark:border-white/10 dark:bg-black/20"
              />
              <button
                onClick={saveStartDate}
                disabled={isSaving}
                className={`mt-4 w-full rounded-full ${theme.button} ${theme.buttonHover} px-6 py-3 font-semibold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {isSaving ? "Сохраняем..." : "Обновить дату"}
              </button>
              {saveMessage && <p className="mt-2 text-sm font-semibold">{saveMessage}</p>}
            </div>
          </div>

          <div
            className={`rounded-3xl bg-gradient-to-b ${theme.panel} ${theme.darkPanel} p-6 shadow-2xl`}
          >
            <h2 className="text-2xl font-bold">Тема пары</h2>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {(Object.keys(themes) as ThemeKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => {
                    setThemeKey(key);
                    persistSetting("theme", key);
                  }}
                  className={`rounded-2xl border px-4 py-3 text-left font-semibold transition ${
                    themeKey === key
                      ? "border-white bg-white/70 shadow-lg dark:bg-white/20"
                      : "border-white/30 bg-white/30 hover:bg-white/45 dark:bg-white/5 dark:hover:bg-white/10"
                  }`}
                >
                  {themes[key].name}
                </button>
              ))}
            </div>

            <div className="mt-6 rounded-2xl bg-white/35 p-5 shadow-inner dark:bg-white/5">
              <p className={`text-sm font-semibold ${theme.muted} dark:text-white/65`}>
                Relationship energy today
              </p>
              <div className="mt-3 flex items-end justify-between">
                <p className="text-5xl font-bold">{relationshipEnergy}%</p>
                <p className="text-3xl">{mood}</p>
              </div>
              <div className="mt-4 flex gap-2">
                {["😊", "😴", "🥰", "❤️"].map((item) => (
                  <button
                    key={item}
                    onClick={() => {
                      setMood(item);
                      persistSetting("mood", item);
                    }}
                    className={`h-11 w-11 rounded-full text-xl shadow-inner transition ${
                      mood === item ? "bg-white" : "bg-white/40 hover:bg-white/65"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div
            className={`rounded-3xl bg-gradient-to-b ${theme.panel} ${theme.darkPanel} p-6 shadow-2xl`}
          >
            <h2 className="text-2xl font-bold">Последняя активность</h2>
            <div className="mt-5 space-y-3">
              {activity.length === 0 ? (
                <p className={`${theme.muted} dark:text-white/65`}>
                  Активности пока нет.
                </p>
              ) : (
                activity.map((item) => (
                  <div key={item.id} className="rounded-2xl bg-white/35 p-4 shadow-inner dark:bg-white/5">
                    <p className="font-semibold">{item.text}</p>
                    <p className={`mt-1 text-sm ${theme.muted} dark:text-white/65`}>
                      {item.time}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div
            className={`rounded-3xl bg-gradient-to-b ${theme.panel} ${theme.darkPanel} p-6 shadow-2xl`}
          >
            <h2 className="text-2xl font-bold">Таймлайн</h2>
            <div className="mt-5 space-y-4">
              {timeline.map((item) => (
                <div key={`${item.title}-${item.text}`} className="flex gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/55 shadow-inner dark:bg-white/10">
                    {item.icon}
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${theme.muted} dark:text-white/65`}>
                      {item.year}
                    </p>
                    <p className="font-bold">{item.title}</p>
                    <p className={`text-sm ${theme.muted} dark:text-white/65`}>{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            className={`rounded-3xl bg-gradient-to-b ${theme.panel} ${theme.darkPanel} p-6 shadow-2xl`}
          >
            <h2 className="text-2xl font-bold">Ачивки</h2>
            <div className="mt-5 grid gap-3">
              {achievements.map((achievement) => (
                <div
                  key={achievement.label}
                  className={`rounded-2xl p-4 font-semibold shadow-inner ${
                    achievement.unlocked
                      ? "bg-white/55"
                      : "bg-white/20 opacity-60 grayscale dark:bg-white/5"
                  }`}
                >
                  <span className="mr-2">{achievement.icon}</span>
                  {achievement.label}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div
            className={`rounded-3xl bg-gradient-to-b ${theme.panel} ${theme.darkPanel} p-6 shadow-2xl`}
          >
            <h2 className="text-2xl font-bold">Наша песня</h2>
            <input
              value={song}
              onChange={(e) => {
                setSong(e.target.value);
                persistSetting("song", e.target.value);
              }}
              placeholder="Ссылка на Spotify, YouTube или название песни"
              className="mt-5 w-full rounded-2xl border border-white/40 bg-white/70 p-4 outline-none dark:border-white/10 dark:bg-black/20"
            />
            {song && (
              <a
                href={song.startsWith("http") ? song : undefined}
                target="_blank"
                className={`mt-4 inline-block rounded-full ${theme.button} ${theme.buttonHover} px-5 py-2 font-semibold text-white shadow-lg transition`}
              >
                Открыть песню
              </a>
            )}
          </div>

          <div
            className={`rounded-3xl bg-gradient-to-b ${theme.panel} ${theme.darkPanel} p-6 shadow-2xl`}
          >
            <h2 className="text-2xl font-bold">Countdown</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <input
                value={eventTitle}
                onChange={(e) => {
                  setEventTitle(e.target.value);
                  persistSetting("event-title", e.target.value);
                }}
                placeholder="Событие"
                className="rounded-2xl border border-white/40 bg-white/70 p-4 outline-none dark:border-white/10 dark:bg-black/20"
              />
              <input
                type="date"
                value={eventDate}
                onChange={(e) => {
                  setEventDate(e.target.value);
                  persistSetting("event-date", e.target.value);
                }}
                className="rounded-2xl border border-white/40 bg-white/70 p-4 outline-none dark:border-white/10 dark:bg-black/20"
              />
            </div>
            <p className="mt-5 text-3xl font-bold">
              {countdownDays === null
                ? "Выберите дату"
                : countdownDays >= 0
                  ? `${eventTitle}: через ${countdownDays} дней`
                  : `${eventTitle}: было ${Math.abs(countdownDays)} дней назад`}
            </p>
          </div>
        </section>
      </div>

      {croppingImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-4 shadow-2xl dark:bg-gray-900">
            <div className="relative h-64 w-full overflow-hidden rounded-2xl">
              <Cropper
                image={croppingImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, croppedPixels) =>
                  setCroppedAreaPixels(croppedPixels)
                }
              />
            </div>

            {croppedAreaPixels && (
              <div className="mt-4 flex flex-col items-center gap-2">
                <p className="text-sm font-semibold text-[#dc2626]">
                  Так будет выглядеть фото
                </p>
                <CroppedPreview
                  imageSrc={croppingImage}
                  croppedArea={croppedAreaPixels}
                  size={100}
                />
              </div>
            )}

            <div className="mt-4 flex justify-between">
              <button
                onClick={() => setCroppingImage(null)}
                className="rounded-full bg-gray-300 px-4 py-2 font-semibold text-gray-800 transition hover:bg-gray-400"
              >
                Отмена
              </button>

              <button
                onClick={saveCroppedAvatar}
                className="rounded-full bg-[#dc2626] px-4 py-2 font-semibold text-white transition hover:bg-[#ff5a6b]"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
