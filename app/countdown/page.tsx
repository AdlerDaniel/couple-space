"use client";

import EmptyState from "@/components/EmptyState";
import EmojiPicker from "@/components/EmojiPicker";
import { FluentEmoji } from "@/components/FluentEmoji";
import { AppDialog } from "@/components/ui/AppDialog";
import { getCountdownTimeParts, sortCountdowns, toLocalDateTimeValue } from "@/lib/countdowns";
import { createPartnerNotification } from "@/lib/notifications";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import {
  CalendarHeart,
  Check,
  Clock3,
  Edit3,
  Heart,
  Hourglass,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Couple = {
  id: string;
  partner_one_id: string;
  partner_two_id: string | null;
};

type Countdown = {
  id: string;
  couple_id: string;
  title: string;
  description: string | null;
  icon: string;
  target_at: string;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type CountdownDraft = {
  title: string;
  description: string;
  icon: string;
  targetAt: string;
};

type Filter = "upcoming" | "all" | "completed";

const panelClass =
  "border border-pink-900/10 bg-white/68 shadow-[0_22px_70px_rgba(190,24,93,0.12)] backdrop-blur-xl dark:border-pink-100/10 dark:bg-[#240b1c]/74 dark:shadow-[0_24px_80px_rgba(0,0,0,0.34)]";

function getDefaultTarget() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(19, 0, 0, 0);
  return toLocalDateTimeValue(date);
}

function createEmptyDraft(): CountdownDraft {
  return {
    title: "",
    description: "",
    icon: "💗",
    targetAt: getDefaultTarget(),
  };
}

function formatTargetDate(targetAt: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(targetAt));
}

export default function CountdownPage() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [countdowns, setCountdowns] = useState<Countdown[]>([]);
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [isLoading, setIsLoading] = useState(true);
  const [dataError, setDataError] = useState("");
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingCountdown, setEditingCountdown] = useState<Countdown | null>(null);
  const [draft, setDraft] = useState<CountdownDraft>(() => createEmptyDraft());
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Countdown | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadCountdowns = useCallback(async (coupleId: string) => {
    const { data, error } = await supabase
      .from("countdowns")
      .select("*")
      .eq("couple_id", coupleId)
      .order("target_at", { ascending: true });

    if (error) {
      setDataError("Не удалось загрузить отсчёты. Попробуйте обновить страницу.");
      return;
    }

    setDataError("");
    setCountdowns(sortCountdowns((data || []) as Countdown[]));
  }, []);

  useEffect(() => {
    async function loadPage() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsLoading(false);
        return;
      }

      setCurrentUserId(user.id);

      const { data: coupleData } = await supabase
        .from("couples")
        .select("id, partner_one_id, partner_two_id")
        .or(`partner_one_id.eq.${user.id},partner_two_id.eq.${user.id}`)
        .limit(1)
        .maybeSingle<Couple>();

      if (!coupleData) {
        setIsLoading(false);
        return;
      }

      setCouple(coupleData);
      await loadCountdowns(coupleData.id);
      setIsLoading(false);
    }

    loadPage();
  }, [loadCountdowns]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!couple) return;

    const channel = supabase
      .channel(`countdowns:${couple.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "countdowns",
          filter: `couple_id=eq.${couple.id}`,
        },
        () => loadCountdowns(couple.id),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [couple, loadCountdowns]);

  useEffect(() => {
    if (!isEditorOpen && !pendingDelete) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (pendingDelete) setPendingDelete(null);
      else if (!isSaving) {
        setIsEditorOpen(false);
        setEditingCountdown(null);
        setFormError("");
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isEditorOpen, isSaving, pendingDelete]);

  const upcomingCount = useMemo(
    () => countdowns.filter((countdown) => new Date(countdown.target_at).getTime() > now).length,
    [countdowns, now],
  );

  const completedCount = countdowns.length - upcomingCount;

  const visibleCountdowns = useMemo(() => {
    if (filter === "all") return countdowns;
    return countdowns.filter((countdown) => {
      const isCompleted = new Date(countdown.target_at).getTime() <= now;
      return filter === "completed" ? isCompleted : !isCompleted;
    });
  }, [countdowns, filter, now]);

  const nearestCountdown = countdowns.find(
    (countdown) => new Date(countdown.target_at).getTime() > now,
  );

  function flashMessage(nextMessage: string) {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage(""), 2_400);
  }

  function openCreateEditor() {
    setEditingCountdown(null);
    setDraft(createEmptyDraft());
    setFormError("");
    setIsEditorOpen(true);
  }

  function openEditEditor(countdown: Countdown) {
    setEditingCountdown(countdown);
    setDraft({
      title: countdown.title,
      description: countdown.description || "",
      icon: countdown.icon,
      targetAt: toLocalDateTimeValue(countdown.target_at),
    });
    setFormError("");
    setIsEditorOpen(true);
  }

  function closeEditor() {
    if (isSaving) return;
    setIsEditorOpen(false);
    setEditingCountdown(null);
    setFormError("");
  }

  async function saveCountdown(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!couple || !currentUserId || isSaving) return;

    const title = draft.title.trim();
    const targetDate = new Date(draft.targetAt);

    if (!title) {
      setFormError("Добавьте название события.");
      return;
    }

    if (!draft.targetAt || Number.isNaN(targetDate.getTime())) {
      setFormError("Укажите дату и время события.");
      return;
    }

    if (!editingCountdown && targetDate.getTime() <= Date.now()) {
      setFormError("Для нового отсчёта выберите время в будущем.");
      return;
    }

    setIsSaving(true);
    setFormError("");

    const payload = {
      title,
      description: draft.description.trim() || null,
      icon: draft.icon.trim() || "💗",
      target_at: targetDate.toISOString(),
      updated_by: currentUserId,
      updated_at: new Date().toISOString(),
    };

    if (editingCountdown) {
      const { data, error } = await supabase
        .from("countdowns")
        .update(payload)
        .eq("id", editingCountdown.id)
        .eq("couple_id", couple.id)
        .select("*")
        .single<Countdown>();

      if (error || !data) {
        setFormError(error?.message || "Не удалось сохранить изменения.");
        setIsSaving(false);
        return;
      }

      setCountdowns((current) =>
        sortCountdowns(current.map((countdown) => (countdown.id === data.id ? data : countdown))),
      );
      setIsEditorOpen(false);
      setEditingCountdown(null);
      setIsSaving(false);
      flashMessage("Отсчёт обновлён");

      await createPartnerNotification(couple, currentUserId, {
        type: "countdown_updated",
        title: "Отсчёт обновлён",
        body: `${data.icon} ${data.title}`,
        href: "/countdown",
      });
      return;
    }

    const { data, error } = await supabase
      .from("countdowns")
      .insert({
        ...payload,
        couple_id: couple.id,
        created_by: currentUserId,
      })
      .select("*")
      .single<Countdown>();

    if (error || !data) {
      setFormError(error?.message || "Не удалось создать отсчёт.");
      setIsSaving(false);
      return;
    }

    setCountdowns((current) => sortCountdowns([data, ...current]));
    setFilter("upcoming");
    setIsEditorOpen(false);
    setIsSaving(false);
    flashMessage("Новый отсчёт запущен");

    await createPartnerNotification(couple, currentUserId, {
      type: "countdown_created",
      title: "Новый отсчёт пары",
      body: `${data.icon} ${data.title} · ${formatTargetDate(data.target_at)}`,
      href: "/countdown",
    });
  }

  async function deleteCountdown() {
    if (!pendingDelete || !couple || !currentUserId || deletingId) return;

    const countdown = pendingDelete;
    setDeletingId(countdown.id);

    const { error } = await supabase
      .from("countdowns")
      .delete()
      .eq("id", countdown.id)
      .eq("couple_id", couple.id);

    if (error) {
      setDataError("Не удалось удалить отсчёт. Попробуйте ещё раз.");
      setDeletingId(null);
      return;
    }

    setCountdowns((current) => current.filter((item) => item.id !== countdown.id));
    setPendingDelete(null);
    setDeletingId(null);
    flashMessage("Отсчёт удалён");

    await createPartnerNotification(couple, currentUserId, {
      type: "countdown_deleted",
      title: "Отсчёт удалён",
      body: `${countdown.icon} ${countdown.title}`,
      href: "/countdown",
    });
  }

  if (isLoading) {
    return (
      <main className="countdown-page flex min-h-screen items-center justify-center bg-[#fff4f8] px-6 text-[#831843] dark:bg-[#160811] dark:text-pink-50">
        <div className={`${panelClass} countdown-soft-pulse rounded-[2rem] px-8 py-7 text-center`}>
          <Hourglass className="mx-auto h-8 w-8 text-[#db2777]" aria-hidden="true" />
          <p className="mt-3 font-black">Собираем ваши важные даты...</p>
        </div>
      </main>
    );
  }

  if (!currentUserId || !couple) {
    return (
      <main className="countdown-page flex min-h-screen items-center justify-center bg-[#fff4f8] px-6 text-[#831843] dark:bg-[#160811] dark:text-pink-50">
        <div className={`${panelClass} max-w-md rounded-[2rem] p-8 text-center`}>
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-pink-100 text-3xl dark:bg-pink-400/10">🫶</span>
          <h1 className="mt-5 text-3xl font-black">Сначала создайте пару</h1>
          <p className="mt-3 font-semibold leading-7 opacity-65">
            Общие отсчёты появятся после того, как вы создадите пару или примете приглашение.
          </p>
          <Link href="/profile" className="mt-6 inline-flex rounded-full bg-[#db2777] px-6 py-3 font-black text-white shadow-[0_16px_38px_rgba(219,39,119,0.28)]">
            Открыть профиль
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="countdown-page mobile-redesign-page relative min-h-screen overflow-hidden bg-[#fff4f8] px-4 pb-32 pt-7 text-[#831843] transition-colors dark:bg-[#160811] dark:text-pink-50 sm:px-6 lg:px-8 lg:pb-14 lg:pt-9">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_14%_10%,rgba(244,114,182,0.28),transparent_31rem),radial-gradient(circle_at_88%_18%,rgba(251,113,133,0.2),transparent_30rem),linear-gradient(145deg,#fff7fb_0%,#fff1f6_48%,#fce7f3_100%)] dark:bg-[radial-gradient(circle_at_14%_10%,rgba(219,39,119,0.2),transparent_31rem),radial-gradient(circle_at_88%_18%,rgba(244,63,94,0.13),transparent_30rem),linear-gradient(145deg,#160811_0%,#260b1b_52%,#12070d_100%)]" />
      <div className="countdown-grain pointer-events-none fixed inset-0 opacity-50 dark:opacity-25" />
      <div className="countdown-orb pointer-events-none fixed left-[8%] top-28 h-28 w-28 rounded-full bg-pink-300/30 blur-3xl dark:bg-pink-500/12" />
      <div className="countdown-orb countdown-orb-delay pointer-events-none fixed bottom-24 right-[8%] h-40 w-40 rounded-full bg-rose-300/25 blur-3xl dark:bg-rose-500/10" />

      <div className="relative mx-auto max-w-[1440px]">
        <header className="countdown-hero mobile-page-header grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-[#db2777] dark:text-pink-300">
              <Heart className="h-4 w-4 fill-current" aria-hidden="true" />
              <span>Отсчёт пары</span>
            </div>
            <h1 className="mt-3 max-w-4xl text-4xl font-black leading-[0.98] tracking-[-0.04em] text-[#831843] dark:text-white sm:text-5xl lg:text-7xl">
              Считаем мгновения
              <span className="block bg-gradient-to-r from-[#db2777] via-[#f43f5e] to-[#fb7185] bg-clip-text text-transparent">
                до важного
              </span>
            </h1>
            <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-[#831843]/65 dark:text-pink-100/62 sm:text-lg">
              Путешествие, годовщина или уютный вечер — сохраните дату здесь, чтобы ждать вместе было ещё приятнее.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateEditor}
            className="group inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-gradient-to-r from-[#db2777] via-[#e11d48] to-[#fb7185] px-6 font-black text-white shadow-[0_20px_55px_rgba(219,39,119,0.3)] transition hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(219,39,119,0.4)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pink-300/60 active:translate-y-0"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-white/18 transition group-hover:rotate-90">
              <Plus className="h-5 w-5" aria-hidden="true" />
            </span>
            Создать отсчёт
          </button>
        </header>

        <section className="countdown-stats mt-8 grid gap-3 sm:grid-cols-3" aria-label="Краткая статистика отсчётов">
          {[
            { value: countdowns.length, label: "всего дат", Icon: CalendarHeart },
            { value: upcomingCount, label: "в ожидании", Icon: Hourglass },
            { value: completedCount, label: "уже случилось", Icon: Check },
          ].map(({ value, label, Icon }) => (
            <div key={label} className={`${panelClass} rounded-[1.35rem] p-4 sm:p-5`}>
              <div className="flex items-center gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-pink-100 to-rose-100 text-[#db2777] shadow-inner dark:from-pink-400/15 dark:to-rose-400/8 dark:text-pink-200">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-2xl font-black tabular-nums text-[#be185d] dark:text-pink-200">{value}</p>
                  <p className="text-xs font-black uppercase tracking-wide text-[#831843]/48 dark:text-pink-100/45">{label}</p>
                </div>
              </div>
            </div>
          ))}
        </section>

        {nearestCountdown && (
          <section className={`${panelClass} countdown-featured relative mt-5 overflow-hidden rounded-[2rem] p-5 sm:p-7 lg:p-9`}>
            <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-pink-300/42 to-rose-300/8 blur-2xl dark:from-pink-500/16" />
            <div className="relative grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center">
              <div>
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-[#db2777] dark:text-pink-300">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  Ближайшее событие
                </p>
                <div className="mt-4 flex items-center gap-4">
                  <span className="grid h-16 w-16 shrink-0 place-items-center rounded-[1.4rem] bg-gradient-to-br from-pink-100 to-rose-100 text-3xl shadow-inner dark:from-pink-400/15 dark:to-rose-400/8 sm:h-20 sm:w-20 sm:text-4xl">
                    {nearestCountdown.icon}
                  </span>
                  <div className="min-w-0">
                    <h2 className="break-words text-2xl font-black text-[#831843] dark:text-white sm:text-3xl">{nearestCountdown.title}</h2>
                    <p className="mt-1 flex items-center gap-2 text-sm font-bold text-[#831843]/55 dark:text-pink-100/50">
                      <Clock3 className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {formatTargetDate(nearestCountdown.target_at)}
                    </p>
                  </div>
                </div>
              </div>
              <CountdownDigits countdown={nearestCountdown} now={now} featured />
            </div>
          </section>
        )}

        <div className="countdown-collection-head mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#db2777]/75 dark:text-pink-300/70">Ваша коллекция</p>
            <h2 className="mt-1 text-2xl font-black text-[#831843] dark:text-white sm:text-3xl">Все важные даты</h2>
          </div>
          <div className={`${panelClass} grid grid-cols-3 gap-1 rounded-full p-1.5`} role="tablist" aria-label="Фильтр отсчётов">
            {[
              ["upcoming", "Впереди"],
              ["all", "Все"],
              ["completed", "Прошли"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={filter === key}
                onClick={() => setFilter(key as Filter)}
                className={`rounded-full px-4 py-2.5 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 ${
                  filter === key
                    ? "bg-[#db2777] text-white shadow-[0_10px_28px_rgba(219,39,119,0.26)]"
                    : "text-[#831843]/58 hover:bg-pink-100/70 dark:text-pink-100/58 dark:hover:bg-pink-400/10"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {message && (
          <div role="status" className="mt-4 rounded-2xl border border-pink-300/40 bg-pink-50/85 px-5 py-3 text-center text-sm font-black text-[#be185d] shadow-inner dark:border-pink-300/12 dark:bg-pink-400/8 dark:text-pink-200">
            {message}
          </div>
        )}

        {dataError && (
          <div role="alert" className="mt-4 rounded-2xl border border-rose-300/50 bg-rose-50/90 px-5 py-4 text-sm font-bold text-rose-700 dark:border-rose-300/15 dark:bg-rose-400/8 dark:text-rose-200">
            {dataError}
          </div>
        )}

        <section className="mt-5">
          {visibleCountdowns.length === 0 ? (
            <div className={`${panelClass} rounded-[2rem] p-4 sm:p-7`}>
              <EmptyState
                icon={filter === "completed" ? "🌸" : "💗"}
                title={filter === "completed" ? "Всё ещё впереди" : "Создайте первый отсчёт"}
                text={filter === "completed" ? "Завершённые события появятся здесь после наступления даты." : "Добавьте событие, которое хочется ждать вместе."}
                actionLabel={filter === "completed" ? "Показать будущие" : "Создать отсчёт"}
                onAction={filter === "completed" ? () => setFilter("upcoming") : openCreateEditor}
                accent="#db2777"
              />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleCountdowns.map((countdown) => (
                <CountdownCard
                  key={countdown.id}
                  countdown={countdown}
                  now={now}
                  isMine={countdown.created_by === currentUserId}
                  onEdit={() => openEditEditor(countdown)}
                  onDelete={() => setPendingDelete(countdown)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {isEditorOpen && (
        <CountdownEditor
          draft={draft}
          setDraft={setDraft}
          isEditing={Boolean(editingCountdown)}
          isSaving={isSaving}
          error={formError}
          onClose={closeEditor}
          onSubmit={saveCountdown}
        />
      )}

      {pendingDelete && (
        <DeleteDialog
          countdown={pendingDelete}
          isDeleting={deletingId === pendingDelete.id}
          onCancel={() => !deletingId && setPendingDelete(null)}
          onConfirm={deleteCountdown}
        />
      )}
    </main>
  );
}

function CountdownDigits({ countdown, now, featured = false }: { countdown: Countdown; now: number; featured?: boolean }) {
  const time = getCountdownTimeParts(countdown.target_at, now);

  if (time.isCompleted) {
    return (
      <div className={`flex items-center gap-3 rounded-[1.35rem] border border-pink-200/70 bg-pink-50/72 p-4 text-[#be185d] dark:border-pink-200/10 dark:bg-pink-400/8 dark:text-pink-200 ${featured ? "justify-center sm:p-6" : ""}`}>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-pink-100 dark:bg-pink-400/12">
          <Check className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="font-black">Событие наступило</p>
          <p className="mt-0.5 text-xs font-bold opacity-55">Этот момент уже стал частью вашей истории</p>
        </div>
      </div>
    );
  }

  const parts = [
    [time.days, "дней"],
    [time.hours, "часов"],
    [time.minutes, "минут"],
    [time.seconds, "секунд"],
  ];

  return (
    <div className={`grid grid-cols-4 ${featured ? "gap-2 sm:gap-3" : "gap-1.5"}`} aria-label={`До события: ${time.days} дней, ${time.hours} часов, ${time.minutes} минут, ${time.seconds} секунд`}>
      {parts.map(([value, label]) => (
        <div key={String(label)} className={`rounded-[1.15rem] border border-pink-200/70 bg-gradient-to-b from-white/90 to-pink-50/72 text-center shadow-inner dark:border-pink-100/10 dark:from-white/10 dark:to-pink-400/5 ${featured ? "px-1 py-4 sm:py-6" : "px-1 py-3"}`}>
          <p className={`countdown-number font-black tabular-nums text-[#be185d] dark:text-pink-200 ${featured ? "text-2xl sm:text-4xl lg:text-5xl" : "text-xl sm:text-2xl"}`}>
            {String(value).padStart(2, "0")}
          </p>
          <p className={`mt-1 truncate font-black uppercase tracking-wide text-[#831843]/42 dark:text-pink-100/42 ${featured ? "text-[9px] sm:text-[11px]" : "text-[8px] sm:text-[10px]"}`}>
            {label}
          </p>
        </div>
      ))}
    </div>
  );
}

function CountdownCard({
  countdown,
  now,
  isMine,
  onEdit,
  onDelete,
}: {
  countdown: Countdown;
  now: number;
  isMine: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isCompleted = new Date(countdown.target_at).getTime() <= now;

  return (
    <article className={`${panelClass} countdown-card performance-list-item group relative overflow-hidden rounded-[1.7rem] p-4 transition hover:-translate-y-1 hover:border-pink-300/55 hover:shadow-[0_28px_90px_rgba(190,24,93,0.2)] sm:p-5`}>
      <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-pink-200/35 blur-2xl transition group-hover:scale-125 dark:bg-pink-500/8" />
      <div className="relative flex items-start gap-3">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[1.15rem] bg-gradient-to-br from-pink-100 to-rose-100 text-2xl shadow-inner dark:from-pink-400/15 dark:to-rose-400/8">
          <FluentEmoji emoji={countdown.icon} size={34} decorative />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="break-words text-xl font-black text-[#831843] dark:text-white">{countdown.title}</h3>
              <p className="mt-1 text-xs font-black uppercase tracking-wide text-[#db2777]/60 dark:text-pink-300/55">
                {isMine ? "Создано вами" : "Создано партнёром"}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button type="button" onClick={onEdit} className="grid h-9 w-9 place-items-center rounded-full bg-pink-100/80 text-[#be185d] transition hover:bg-pink-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 dark:bg-pink-400/10 dark:text-pink-200 dark:hover:bg-pink-400/18" aria-label={`Редактировать отсчёт «${countdown.title}»`} title="Редактировать">
                <Edit3 className="h-4 w-4" aria-hidden="true" />
              </button>
              <button type="button" onClick={onDelete} className="grid h-9 w-9 place-items-center rounded-full bg-rose-100/75 text-rose-600 transition hover:bg-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 dark:bg-rose-400/10 dark:text-rose-200 dark:hover:bg-rose-400/18" aria-label={`Удалить отсчёт «${countdown.title}»`} title="Удалить">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {countdown.description && (
        <p className="relative mt-4 line-clamp-3 text-sm font-semibold leading-6 text-[#831843]/62 dark:text-pink-100/58">
          {countdown.description}
        </p>
      )}

      <div className="relative mt-4">
        <CountdownDigits countdown={countdown} now={now} />
      </div>

      <div className="relative mt-4 flex items-center gap-2 rounded-full bg-pink-50/72 px-3 py-2 text-xs font-bold text-[#831843]/58 dark:bg-pink-400/6 dark:text-pink-100/52">
        <CalendarHeart className="h-4 w-4 shrink-0 text-[#db2777]" aria-hidden="true" />
        <span className="truncate">{formatTargetDate(countdown.target_at)}</span>
        {isCompleted && <span className="ml-auto shrink-0 rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-black text-[#be185d] dark:bg-pink-400/10 dark:text-pink-200">прошло</span>}
      </div>
    </article>
  );
}

function CountdownEditor({
  draft,
  setDraft,
  isEditing,
  isSaving,
  error,
  onClose,
  onSubmit,
}: {
  draft: CountdownDraft;
  setDraft: React.Dispatch<React.SetStateAction<CountdownDraft>>;
  isEditing: boolean;
  isSaving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <AppDialog
      open
      onOpenChange={(open) => {
        if (!open && !isSaving) onClose();
      }}
      ariaLabelledby="countdown-editor-title"
      dismissOnBackdrop={!isSaving}
      dismissOnEscape={!isSaving}
      backdrop="rose"
      className="items-end justify-center p-0 sm:items-center sm:p-5"
    >
      <section className="countdown-dialog-in relative max-h-[94dvh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] border border-pink-200/60 bg-[#fff9fc] p-5 text-[#831843] shadow-[0_30px_120px_rgba(80,7,36,0.36)] dark:border-pink-100/10 dark:bg-[#21101b] dark:text-pink-50 sm:rounded-[2rem] sm:p-7">
        <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-pink-200 dark:bg-pink-300/20 sm:hidden" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#db2777] dark:text-pink-300">{isEditing ? "Изменить дату" : "Новый момент"}</p>
            <h2 id="countdown-editor-title" className="mt-1 text-2xl font-black text-[#831843] dark:text-white sm:text-3xl">
              {isEditing ? "Редактировать отсчёт" : "Создать отсчёт"}
            </h2>
          </div>
          <button type="button" onClick={onClose} disabled={isSaving} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-pink-100 text-[#be185d] transition hover:bg-pink-200 disabled:opacity-45 dark:bg-pink-400/10 dark:text-pink-200" aria-label="Закрыть">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-5">
          <div>
            <label htmlFor="countdown-title" className="text-sm font-black">Название</label>
            <input id="countdown-title" data-dialog-initial-focus value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} maxLength={80} placeholder="Например, поездка в Петербург" className="mt-2 w-full rounded-2xl border border-pink-200/80 bg-white/82 px-4 py-3.5 font-semibold outline-none transition placeholder:text-[#831843]/30 focus:border-[#db2777] focus:ring-4 focus:ring-pink-300/18 dark:border-pink-100/10 dark:bg-white/7 dark:placeholder:text-pink-100/28" />
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="countdown-description" className="text-sm font-black">Описание <span className="font-semibold opacity-45">необязательно</span></label>
              <span className="text-xs font-black opacity-35">{draft.description.length}/500</span>
            </div>
            <textarea id="countdown-description" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} maxLength={500} rows={4} placeholder="Почему вы ждёте этот день?" className="mt-2 w-full resize-none rounded-2xl border border-pink-200/80 bg-white/82 px-4 py-3.5 font-semibold leading-6 outline-none transition placeholder:text-[#831843]/30 focus:border-[#db2777] focus:ring-4 focus:ring-pink-300/18 dark:border-pink-100/10 dark:bg-white/7 dark:placeholder:text-pink-100/28" />
          </div>

          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(13rem,0.75fr)]">
            <fieldset>
              <legend className="text-sm font-black">Значок</legend>
              <div className="mt-2 flex items-center gap-3 rounded-2xl bg-pink-50/72 p-3 dark:bg-pink-400/7">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white text-2xl shadow-inner dark:bg-white/10" aria-label={`Выбранный значок ${draft.icon}`}>
                  <FluentEmoji emoji={draft.icon} size={32} decorative />
                </span>
                <p className="text-xs font-bold leading-5 opacity-55">Выберите значок из полного набора Microsoft Fluent Emoji.</p>
              </div>
              <EmojiPicker
                selectedEmoji={draft.icon}
                onSelect={(icon) => setDraft((current) => ({ ...current, icon }))}
                tone="pink"
                className="mt-2"
                compact
              />
            </fieldset>

            <div>
              <label htmlFor="countdown-target" className="text-sm font-black">Дата и время</label>
              <input id="countdown-target" type="datetime-local" value={draft.targetAt} min={isEditing ? undefined : toLocalDateTimeValue(new Date())} onChange={(event) => setDraft((current) => ({ ...current, targetAt: event.target.value }))} className="mt-2 w-full rounded-2xl border border-pink-200/80 bg-white/82 px-4 py-3.5 font-black outline-none transition focus:border-[#db2777] focus:ring-4 focus:ring-pink-300/18 dark:border-pink-100/10 dark:bg-white/7 dark:[color-scheme:dark]" />
              <div className="mt-3 rounded-2xl bg-gradient-to-br from-pink-100/80 to-rose-50/75 p-3 text-xs font-bold leading-5 text-[#831843]/58 dark:from-pink-400/10 dark:to-rose-400/5 dark:text-pink-100/55">
                Время сохраняется в вашем часовом поясе и одинаково отображается у обоих партнёров.
              </div>
            </div>
          </div>

          {error && <p role="alert" className="rounded-2xl border border-rose-300/55 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 dark:border-rose-300/15 dark:bg-rose-400/8 dark:text-rose-200">{error}</p>}

          <div className="flex flex-col-reverse gap-2 border-t border-pink-200/55 pt-5 dark:border-pink-100/10 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={isSaving} className="min-h-12 rounded-full border border-pink-200/75 bg-white/65 px-6 font-black text-[#831843]/65 transition hover:bg-pink-50 disabled:opacity-45 dark:border-pink-100/10 dark:bg-white/6 dark:text-pink-100/65 dark:hover:bg-white/10">Отмена</button>
            <button type="submit" disabled={isSaving} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#db2777] to-[#f43f5e] px-7 font-black text-white shadow-[0_16px_42px_rgba(219,39,119,0.3)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55">
              {isSaving ? <Hourglass className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
              {isSaving ? "Сохраняем..." : isEditing ? "Сохранить" : "Запустить отсчёт"}
            </button>
          </div>
        </form>
      </section>
    </AppDialog>
  );
}

function DeleteDialog({ countdown, isDeleting, onCancel, onConfirm }: { countdown: Countdown; isDeleting: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <AppDialog
      open
      onOpenChange={(open) => {
        if (!open && !isDeleting) onCancel();
      }}
      role="alertdialog"
      ariaLabelledby="delete-countdown-title"
      ariaDescribedby="delete-countdown-description"
      dismissOnBackdrop={false}
      dismissOnEscape={!isDeleting}
      backdrop="rose"
      className="items-center justify-center p-5"
    >
      <section className="countdown-dialog-in relative w-full max-w-md rounded-[2rem] border border-pink-200/60 bg-[#fff9fc] p-6 text-center text-[#831843] shadow-[0_30px_120px_rgba(80,7,36,0.38)] dark:border-pink-100/10 dark:bg-[#21101b] dark:text-pink-50 sm:p-8">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-rose-100 text-3xl shadow-inner dark:bg-rose-400/10"><FluentEmoji emoji={countdown.icon} size={42} decorative /></span>
        <h2 id="delete-countdown-title" className="mt-5 text-2xl font-black text-[#831843] dark:text-white">Удалить «{countdown.title}»?</h2>
        <p id="delete-countdown-description" className="mt-3 font-semibold leading-6 opacity-60">Отсчёт исчезнет у обоих партнёров. Это действие нельзя отменить.</p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <button type="button" data-dialog-initial-focus onClick={onCancel} disabled={isDeleting} className="min-h-12 rounded-full border border-pink-200/75 bg-white/75 px-5 font-black transition hover:bg-pink-50 disabled:opacity-45 dark:border-pink-100/10 dark:bg-white/7 dark:hover:bg-white/10">Оставить</button>
          <button type="button" onClick={onConfirm} disabled={isDeleting} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-rose-600 to-pink-600 px-5 font-black text-white shadow-[0_16px_38px_rgba(225,29,72,0.28)] transition hover:-translate-y-0.5 disabled:opacity-55">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {isDeleting ? "Удаляем..." : "Удалить"}
          </button>
        </div>
      </section>
    </AppDialog>
  );
}
