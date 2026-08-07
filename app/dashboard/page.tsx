"use client";

import { supabase } from "@/lib/supabaseClient";
import { toBrowserSupabaseUrl, toPortableSupabaseUrl } from "@/lib/supabaseUrls";
import { createPartnerNotification } from "@/lib/notifications";
import { compressImageFile } from "@/lib/imageCompression";
import {
  dashboardAccentEventName,
  dashboardAccentStorageKey,
  dashboardThemeAccents,
} from "@/lib/dashboardTheme";
import EmojiPicker from "@/components/EmojiPicker";
import { FluentEmoji } from "@/components/FluentEmoji";
import { AppDialog } from "@/components/ui/AppDialog";
import NextImage from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Cropper from "react-easy-crop";
import { Heart } from "lucide-react";
import { fetchDashboardSession } from "./dashboardRepository";
import type { Couple, CoupleProfile } from "./dashboardTypes";

type CropPixels = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const theme = {
  page: "from-[#ffe7ef] via-[#fff1f4] to-[#fff7f8]",
  text: "text-[#dc2626]",
  muted: "text-[#dc2626]/70",
  panel: "from-[#ffd6e3] to-[#ffe3ec]",
  soft: "bg-white/35",
  button: "bg-[#dc2626]",
  buttonHover: "hover:bg-[#ff5a6b]",
  darkPage: "dark:from-[#2a080c] dark:via-[#21070b] dark:to-[#140704]",
  darkPanel: "dark:from-[#3a1017] dark:to-[#24070c]",
};

function initials(name?: string | null) {
  return (name || "?").trim().slice(0, 1).toUpperCase();
}

function formatDate(date: string) {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "недавно";
  }

  return parsedDate.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getStatus(profile: CoupleProfile, slot: "one" | "two") {
  const text =
    slot === "one" ? profile.status_one_text || "" : profile.status_two_text || "";
  const emoji =
    slot === "one" ? profile.status_one_emoji || "❤️" : profile.status_two_emoji || "❤️";

  return { text, emoji };
}

function AvatarBubble({
  name,
  image,
  status,
  size = "large",
}: {
  name?: string | null;
  image?: string | null;
  status?: { text: string; emoji: string };
  size?: "large" | "small";
}) {
  const sizeClass = size === "large" ? "h-24 w-24 text-4xl" : "h-14 w-14 text-xl";

  return (
    <div className={size === "large" ? "relative w-[112px] shrink-0 sm:w-[142px]" : "relative w-14 shrink-0"}>
      {image ? (
        <NextImage
          src={image}
          alt={name || "Аватар"}
          width={size === "large" ? 96 : 56}
          height={size === "large" ? 96 : 56}
          sizes={size === "large" ? "96px" : "56px"}
          className={`${sizeClass} mx-auto rounded-full object-cover shadow-xl ring-4 ring-white/60`}
 unoptimized />
      ) : (
        <div
          className={`${sizeClass} mx-auto flex items-center justify-center rounded-full bg-white/55 font-bold shadow-xl ring-4 ring-white/50 backdrop-blur dark:bg-white/10`}
        >
          {initials(name)}
        </div>
      )}

      {status?.text && (
        <>
          <div className="absolute -top-3 left-1/2 grid h-8 w-8 -translate-x-1/2 place-items-center rounded-full bg-white/90 text-base shadow-xl ring-2 ring-white/75 backdrop-blur dark:bg-black/55 dark:ring-white/10">
            <FluentEmoji emoji={status.emoji} size={23} decorative />
          </div>
          <div className="absolute -bottom-5 left-1/2 w-max max-w-full -translate-x-1/2 rounded-2xl bg-white/88 px-2.5 py-1.5 text-center text-xs font-black leading-tight text-[#dc2626] shadow-xl ring-1 ring-white/70 backdrop-blur dark:bg-black/50 dark:text-white dark:ring-white/10">
            <span className="line-clamp-2 whitespace-normal break-words">
              {status.text}
            </span>
          </div>
        </>
      )}
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
    <NextImage
      src={preview}
      alt="Preview"
      width={96}
      height={96}
      unoptimized
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
  const [statusMessage, setStatusMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [avatarOneUrl, setAvatarOneUrl] = useState<string | null>(null);
  const [avatarTwoUrl, setAvatarTwoUrl] = useState<string | null>(null);
  const [croppingImage, setCroppingImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] =
    useState<CropPixels | null>(null);
  const [statusText, setStatusText] = useState("");
  const [statusEmoji, setStatusEmoji] = useState("❤️");
  const [isStatusEmojiPickerOpen, setIsStatusEmojiPickerOpen] = useState(false);

  useEffect(() => {
    const accent = dashboardThemeAccents.rose;
    localStorage.setItem(dashboardAccentStorageKey, accent);
    window.dispatchEvent(
      new CustomEvent(dashboardAccentEventName, {
        detail: accent,
      })
    );
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        const session = await fetchDashboardSession();
        if (session.status === "unauthenticated") {
          router.push("/login");
          return;
        }
        if (session.status === "no-couple") {
          router.push("/profile");
          return;
        }

        const { userId, couple: activeCouple, profile: activeProfile } = session;
        setCurrentUserId(userId);
        setCouple(activeCouple);
        setProfile(activeProfile);
        setStartDate(activeProfile.start_date);
        setAvatarOneUrl(activeProfile.avatar_one || null);
        setAvatarTwoUrl(activeProfile.avatar_two || null);
        const myStatus = getStatus(
          activeProfile,
          userId === activeCouple.partner_one_id ? "one" : "two"
        );
        setStatusText(myStatus.text);
        setStatusEmoji(myStatus.emoji);
        setDaysTogether(
          Math.floor(
            (Date.now() - new Date(activeProfile.start_date).getTime()) / (1000 * 60 * 60 * 24)
          )
        );
      } catch (error) {
        console.error(error);
      }

    }

    void loadData();
  }, [router]);

  const coupleName = `${profile?.partner_one || "Вы"} + ${
    profile?.partner_two || "Партнёр"
  }`;

  const isPartnerOne = currentUserId === couple?.partner_one_id;
  const legacyAvatarUrl = profile?.avatar || null;
  const myAvatarUrl = (isPartnerOne ? avatarOneUrl : avatarTwoUrl) || legacyAvatarUrl;
  const leftHeroUrl = avatarOneUrl || (isPartnerOne ? legacyAvatarUrl : null);
  const rightHeroUrl = avatarTwoUrl || (!isPartnerOne ? legacyAvatarUrl : null);
  const heroPartners = [
    { key: "one", name: profile?.partner_one || "Вы", image: leftHeroUrl },
    { key: "two", name: profile?.partner_two || "Партнёр", image: rightHeroUrl },
  ];

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

  async function saveStatus() {
    if (!profile || !couple || !currentUserId) return;

    const text = statusText.trim().slice(0, 20);
    const isFirstPartner = currentUserId === couple.partner_one_id;
    const updatePayload = isFirstPartner
      ? {
          status_one_text: text,
          status_one_emoji: statusEmoji,
          status_updates_one: (profile.status_updates_one || 0) + 1,
        }
      : {
          status_two_text: text,
          status_two_emoji: statusEmoji,
          status_updates_two: (profile.status_updates_two || 0) + 1,
        };

    const { data, error } = await supabase
      .from("couple_profiles")
      .update(updatePayload)
      .eq("id", profile.id)
      .select()
      .single();

    if (error) {
      console.error(error);
      setStatusMessage("Не удалось сохранить статус");
    } else if (data) {
      const nextProfile = data as CoupleProfile;
      setProfile(nextProfile);
      setStatusText(text);
      setStatusMessage("Статус обновлён");
      await createPartnerNotification(couple, currentUserId, {
        type: "status_updated",
        title: "Новый статус",
        body: text ? `${statusEmoji} ${text}` : "Партнёр обновил статус.",
        href: "/dashboard",
      });
    }

    setTimeout(() => setStatusMessage(""), 2500);
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
      const compressedAvatar = await compressImageFile(croppedFile, {
        maxWidth: 900,
        maxHeight: 900,
        quality: 0.82,
      });
      const filePath = `${currentUserId}/${crypto.randomUUID()}.webp`;
      const avatarField =
        currentUserId === couple.partner_one_id ? "avatar_one" : "avatar_two";

      const { error: uploadError } = await supabase.storage
        .from("profile-avatars")
        .upload(filePath, compressedAvatar);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("profile-avatars")
        .getPublicUrl(filePath);
      const publicUrl = toPortableSupabaseUrl(publicUrlData.publicUrl);

      const { error } = await supabase
        .from("couple_profiles")
        .update({ [avatarField]: publicUrl })
        .eq("id", profile.id);

      if (error) throw error;

      if (avatarField === "avatar_one") {
        setAvatarOneUrl(toBrowserSupabaseUrl(publicUrl));
      } else {
        setAvatarTwoUrl(toBrowserSupabaseUrl(publicUrl));
      }
      setProfile({
        ...profile,
        [avatarField]: publicUrl,
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
      className={`dashboard-page mobile-redesign-page min-h-screen bg-gradient-to-b ${theme.page} ${theme.darkPage} px-4 pb-28 pt-20 ${theme.text} transition-colors dark:text-white md:px-6 md:pt-28`}
      style={{ ["--scroll-accent" as string]: "#dc2626" }}
    >
      <div className="mx-auto max-w-6xl space-y-5 md:space-y-8">
        <section
          className={`dashboard-hero relative min-h-[300px] overflow-hidden rounded-[1.5rem] bg-gradient-to-b ${theme.panel} ${theme.darkPanel} p-5 shadow-2xl md:min-h-[360px] md:rounded-3xl md:p-8`}
        >
          <div className="absolute inset-0 opacity-60">
            <div className="grid h-full w-full grid-cols-2">
              {heroPartners.map((partner) => (
                <div key={partner.key} className="relative h-full min-w-0 overflow-hidden">
                  {partner.image ? (
                    <NextImage
                      src={partner.image}
                      alt={`Фото: ${partner.name}`}
                      fill
                      sizes="(min-width: 1024px) 560px, 50vw"
                      className="dashboard-hero-portrait object-cover"
 unoptimized />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-rose-300 via-red-300 to-orange-200 text-[clamp(5rem,18vw,13rem)] font-black text-white/75 dark:from-rose-950 dark:via-red-950 dark:to-orange-950">
                      {initials(partner.name)}
                    </div>
                  )}
                </div>
              ))}
            </div>
              <div className="absolute inset-y-0 left-1/2 w-[42%] -translate-x-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent blur-3xl dark:via-black/30" />
              <div className="absolute inset-y-0 left-1/2 w-[34%] -translate-x-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent blur-2xl dark:via-white/5" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/18 via-white/10 to-black/18 dark:via-black/10" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/10 dark:from-black/60" />

          <div className="dashboard-hero-content relative flex min-h-[300px] flex-col justify-between gap-8">
            <div className="dashboard-hero-actions flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <label className="cursor-pointer rounded-full bg-white/55 px-5 py-2 text-sm font-semibold shadow-lg backdrop-blur transition hover:bg-red-50/90 dark:bg-black/25 dark:hover:bg-red-500/15">
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

              <Link
                href="/profile"
                className="rounded-full bg-white/55 px-5 py-2 text-sm font-semibold shadow-lg backdrop-blur transition hover:bg-red-50/90 dark:bg-black/25 dark:hover:bg-red-500/15"
              >
                Профиль
              </Link>

              {avatarMessage && (
                <p className="rounded-full bg-white/55 px-4 py-2 text-sm font-semibold shadow-lg backdrop-blur dark:bg-black/25">
                  {avatarMessage}
                </p>
              )}
            </div>

            <div>
              <div className="dashboard-avatars mb-8 flex items-center justify-center gap-3 sm:gap-4 md:justify-start">
                <AvatarBubble
                  name={profile.partner_one}
                  image={avatarOneUrl}
                  status={getStatus(profile, "one")}
                />
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-[#dc2626] shadow-lg">
                  <Heart aria-hidden="true" size={24} fill="currentColor" />
                </div>
                <AvatarBubble
                  name={profile.partner_two}
                  image={avatarTwoUrl}
                  status={getStatus(profile, "two")}
                />
              </div>

              <p className="text-sm font-semibold uppercase tracking-wide text-white/80">
                Кабинет пары · аналитика и история
              </p>
              <h1 className="mt-2 text-5xl font-bold tracking-tight text-white md:text-6xl">
                {coupleName}
              </h1>
              <p className="mt-4 text-3xl font-bold text-white">
                {daysTogether} дней вместе <FluentEmoji emoji="❤️" size={30} decorative />
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <span className="rounded-full bg-white/60 px-4 py-2 text-sm font-black text-[#dc2626] shadow-lg backdrop-blur dark:bg-black/25 dark:text-white">
                  Вместе с {startDate ? formatDate(startDate) : "первого дня"}
                </span>
              </div>
            </div>
          </div>
        </section>


        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div
            className={`rounded-3xl bg-gradient-to-b ${theme.panel} ${theme.darkPanel} p-6 shadow-2xl`}
          >
            <h2 className="text-2xl font-bold">Статус</h2>
            <p className={`mt-2 text-sm font-semibold ${theme.muted} dark:text-white/65`}>
              Короткая подпись будет отображаться рядом с вашей аватаркой.
            </p>

            <div className="mt-5 rounded-2xl bg-white/35 p-5 shadow-inner dark:bg-white/5">
              <div className="mb-3 flex items-center gap-3">
                <button type="button" onClick={() => setIsStatusEmojiPickerOpen((current) => !current)} className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/80 text-2xl shadow-inner transition hover:scale-105 dark:bg-white/10" aria-label="Выбрать эмодзи статуса" aria-expanded={isStatusEmojiPickerOpen}>
                  <FluentEmoji emoji={statusEmoji} size={32} decorative />
                </button>
                <p className={`text-xs font-bold ${theme.muted} dark:text-white/55`}>
                  Выберите любой эмодзи для своего статуса.
                </p>
              </div>
              {isStatusEmojiPickerOpen && <EmojiPicker
                selectedEmoji={statusEmoji}
                onSelect={(emoji) => { setStatusEmoji(emoji); setIsStatusEmojiPickerOpen(false); }}
                tone="red"
                compact
              />}

              <div className="mt-4 flex gap-3">
                <input
                  value={statusText}
                  onChange={(e) => setStatusText(e.target.value.slice(0, 20))}
                  maxLength={20}
                  placeholder="Например: скучаю"
                  className="min-w-0 flex-1 rounded-2xl border border-white/40 bg-white/70 p-4 outline-none transition focus:border-[#dc2626]/40 focus:shadow-[0_0_0_4px_rgba(220,38,38,0.12)] dark:border-white/10 dark:bg-black/20"
                />
                <button
                  onClick={saveStatus}
                  className={`rounded-2xl ${theme.button} ${theme.buttonHover} px-5 font-semibold text-white shadow-lg transition`}
                >
                  Сохранить
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between text-sm font-semibold">
                <span className={theme.muted}>{statusText.length}/20</span>
                {statusMessage && <span>{statusMessage}</span>}
              </div>
            </div>
          </div>

          <div
            className={`rounded-3xl bg-gradient-to-b ${theme.panel} ${theme.darkPanel} p-6 shadow-2xl`}
          >
            <h2 className="text-2xl font-bold">Дата отношений</h2>
            <p className={`mt-2 text-sm font-semibold ${theme.muted} dark:text-white/65`}>
              От неё считаются дни вместе.
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-2xl border border-white/40 bg-white/70 p-4 outline-none dark:border-white/10 dark:bg-black/20"
              />
              <button
                onClick={saveStartDate}
                disabled={isSaving}
                className={`rounded-2xl ${theme.button} ${theme.buttonHover} px-6 py-3 font-semibold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {isSaving ? "Сохраняем..." : "Обновить"}
              </button>
            </div>
            {saveMessage && <p className="mt-3 text-sm font-semibold">{saveMessage}</p>}
          </div>
        </section>

      </div>


      {croppingImage && (
        <AppDialog
          open
          onOpenChange={(open) => {
            if (!open) setCroppingImage(null);
          }}
          ariaLabelledby="avatar-crop-title"
          backdrop="default"
          className="items-center justify-center p-4"
        >
          <div className="relative w-full max-w-md rounded-3xl bg-white p-4 shadow-2xl dark:bg-gray-900">
            <h2 id="avatar-crop-title" className="sr-only">
              Настройка фотографии профиля
            </h2>
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
                type="button"
                data-dialog-initial-focus
                onClick={() => setCroppingImage(null)}
                className="rounded-full bg-gray-300 px-4 py-2 font-semibold text-gray-800 transition hover:bg-gray-400"
              >
                Отмена
              </button>

              <button
                type="button"
                onClick={saveCroppedAvatar}
                className="rounded-full bg-[#dc2626] px-4 py-2 font-semibold text-white transition hover:bg-[#ff5a6b]"
              >
                Сохранить
              </button>
            </div>
          </div>
        </AppDialog>
      )}
    </main>
  );
}
