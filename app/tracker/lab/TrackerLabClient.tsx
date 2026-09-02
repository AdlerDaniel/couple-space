"use client";

import AccentAudioPlayer from "@/components/AccentAudioPlayer";
import { FluentEmoji } from "@/components/FluentEmoji";
import { handleClipboardFilePaste } from "@/lib/clipboardFiles";
import {
  createCompatibleAudioRecorder,
  createRecordedAudioFile,
  getMediaKind,
  getSafeStoragePath,
  MAX_AUDIO_SIZE,
  MAX_IMAGE_SIZE,
  validateMediaFile,
} from "@/lib/mediaFiles";
import { encodeMemoryMedia, type MemoryAttachment } from "@/lib/memoryMedia";
import { createPartnerNotification } from "@/lib/notifications";
import { supabase } from "@/lib/supabaseClient";
import { toPortableSupabaseUrl } from "@/lib/supabaseUrls";
import { animate } from "animejs";
import {
  Activity,
  Bell,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Dumbbell,
  Eye,
  EyeOff,
  FileText,
  Gamepad2,
  Heart,
  LayoutDashboard,
  ListFilter,
  Lock,
  MessageCircle,
  Mic,
  Minus,
  Palette,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Square,
  Target,
  Trash2,
  UsersRound,
  Utensils,
  X,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ClipboardEvent as ReactClipboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  addTrackerDays,
  buildTrackerPlanIcs,
  expandTrackerPlanOccurrences,
  formatTrackerDate,
  getPlanBaseDate,
  getTrackerViewRange,
  getWeekStrip,
  parseTrackerDateKey,
  toTrackerDateKey,
  type TrackerOccurrence,
  type TrackerParticipantScope,
  type TrackerPlan,
  type TrackerPlanKind,
  type TrackerPlanRepeat,
} from "./trackerLabDomain";

type Couple = {
  id: string;
  partner_one_id: string;
  partner_two_id: string | null;
};

type Profile = {
  partner_one: string | null;
  partner_two: string | null;
  avatar: string | null;
  avatar_one: string | null;
  avatar_two: string | null;
  time_zone: string | null;
};

type TrackerCategory = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  sort_order: number;
  is_default: boolean;
};

type TrackerCategoryPreference = {
  category_id: string;
  label: string | null;
  color: string | null;
  icon: string | null;
  sort_order: number | null;
  hidden: boolean;
};

type TrackerEvent = {
  id: string;
  couple_id: string;
  category_id: string;
  date: string;
  time: string | null;
  count: number;
  duration_minutes: number;
  note: string | null;
  mood: "great" | "good" | "normal" | "tired" | "bad";
  participants: "both" | "me" | "partner";
  created_by: string;
  created_at: string;
  updated_at: string;
};

type TrackerGoal = {
  id: string;
  couple_id: string;
  title: string;
  category_id: string | null;
  period: "day" | "week" | "month" | "year";
  target_count: number;
  created_by: string;
  created_at: string;
  status?: "active" | "completed" | "archived";
};

type TrackerCheckin = {
  id: string;
  couple_id: string;
  user_id: string;
  date: string;
  mood: MoodKey | null;
  energy: number | null;
  relationship: number | null;
  visibility: "private" | "summary" | "full";
  note: string | null;
  reveal_after_both: boolean;
  is_own: boolean;
  created_at: string;
  updated_at: string;
};

type TrackerComment = {
  id: string;
  plan_id: string;
  couple_id: string;
  user_id: string;
  text: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_type: "image" | "video" | "audio" | "file" | null;
  mime_type: string | null;
  created_at: string;
  attachment_signed_url?: string | null;
};

type LocalTab = "today" | "calendar" | "activity";
type CalendarMode = "day" | "week" | "month" | "year";
type ScopeFilter = "all" | "me" | "partner" | "both";
type ComposerMode = "menu" | "plan" | "checkin" | "goal" | "activity";
type MoodKey = "great" | "good" | "normal" | "tired" | "bad";

const moods: Array<{ key: MoodKey; label: string; emoji: string }> = [
  { key: "great", label: "Радость", emoji: "😄" },
  { key: "good", label: "С любовью", emoji: "🥰" },
  { key: "normal", label: "Спокойно", emoji: "😌" },
  { key: "tired", label: "Усталость", emoji: "😴" },
  { key: "bad", label: "Тяжёлый день", emoji: "😔" },
];

const kindLabels: Record<TrackerPlanKind, string> = {
  event: "Событие",
  date: "Свидание",
  task: "Задача",
  reminder: "Важная дата",
};

const repeatLabels: Record<TrackerPlanRepeat, string> = {
  none: "Не повторять",
  daily: "Каждый день",
  weekly: "Каждую неделю",
  monthly: "Каждый месяц",
  yearly: "Каждый год",
};

const MAX_FILE_SIZE = 50 * 1024 * 1024;

function getCategoryIcon(category: TrackerCategory, size = 18) {
  const Icon = category.slug === "food"
    ? Utensils
    : category.slug === "sex"
      ? Heart
      : category.slug === "sport"
        ? Dumbbell
        : category.slug === "games"
          ? Gamepad2
          : Palette;
  return <Icon size={size} aria-hidden="true" />;
}

function getPlanIcon(kind: TrackerPlanKind, size = 18) {
  const Icon = kind === "date" ? Heart : kind === "task" ? Check : kind === "reminder" ? Bell : CalendarDays;
  return <Icon size={size} aria-hidden="true" />;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatClock(value: string | null) {
  if (!value) return "Весь день";
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function monthCells(value: string) {
  const source = parseTrackerDateKey(value);
  const first = new Date(source.getFullYear(), source.getMonth(), 1, 12);
  const offset = (first.getDay() || 7) - 1;
  const start = addTrackerDays(first, -offset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = addTrackerDays(start, index);
    return {
      key: toTrackerDateKey(date),
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === source.getMonth(),
    };
  });
}

function relativeScope(plan: TrackerPlan, currentUserId: string): Exclude<ScopeFilter, "all"> {
  if (plan.participant_scope === "both") return "both";
  if (plan.created_by === currentUserId) return plan.participant_scope;
  return plan.participant_scope === "me" ? "partner" : "me";
}

function categoryColor(category: TrackerCategory) {
  return category.color || "#d97706";
}

function isMoodMarker(event: TrackerEvent) {
  return Boolean(event.note?.startsWith("[[day-mood]]"));
}

export default function TrackerLabClient() {
  const router = useRouter();
  const agendaRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [categories, setCategories] = useState<TrackerCategory[]>([]);
  const [events, setEvents] = useState<TrackerEvent[]>([]);
  const [goals, setGoals] = useState<TrackerGoal[]>([]);
  const [plans, setPlans] = useState<TrackerPlan[]>([]);
  const [checkins, setCheckins] = useState<TrackerCheckin[]>([]);
  const [comments, setComments] = useState<TrackerComment[]>([]);
  const [activeTab, setActiveTab] = useState<LocalTab>("today");
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("month");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [selectedDate, setSelectedDate] = useState(toTrackerDateKey(new Date()));
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [composerMode, setComposerMode] = useState<ComposerMode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const [planTitle, setPlanTitle] = useState("");
  const [planDescription, setPlanDescription] = useState("");
  const [planKind, setPlanKind] = useState<TrackerPlanKind>("event");
  const [planDate, setPlanDate] = useState(selectedDate);
  const [planTime, setPlanTime] = useState("");
  const [planEndTime, setPlanEndTime] = useState("");
  const [planScope, setPlanScope] = useState<TrackerParticipantScope>("both");
  const [planVisibility, setPlanVisibility] = useState<"couple" | "private">("couple");
  const [planRepeat, setPlanRepeat] = useState<TrackerPlanRepeat>("none");
  const [planRepeatUntil, setPlanRepeatUntil] = useState("");
  const [planReminder, setPlanReminder] = useState(60);

  const [checkinMood, setCheckinMood] = useState<MoodKey>("good");
  const [checkinEnergy, setCheckinEnergy] = useState(3);
  const [checkinRelationship, setCheckinRelationship] = useState(3);
  const [checkinVisibility, setCheckinVisibility] = useState<"private" | "summary" | "full">("private");
  const [checkinNote, setCheckinNote] = useState("");
  const [checkinReveal, setCheckinReveal] = useState(false);

  const [goalCategoryId, setGoalCategoryId] = useState("");
  const [goalPeriod, setGoalPeriod] = useState<TrackerGoal["period"]>("week");
  const [goalTarget, setGoalTarget] = useState(3);
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, string>>({});

  const [commentText, setCommentText] = useState("");
  const [commentFile, setCommentFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [freeSlots, setFreeSlots] = useState<Array<{ starts_at: string; ends_at: string }>>([]);
  const [isFreeTimeOpen, setIsFreeTimeOpen] = useState(false);

  const [memoryPlan, setMemoryPlan] = useState<TrackerPlan | null>(null);
  const [memoryTitle, setMemoryTitle] = useState("");
  const [memoryCaption, setMemoryCaption] = useState("");

  const selectedYear = Number(selectedDate.slice(0, 4));
  const partnerId = useMemo(() => {
    if (!couple || !currentUserId) return null;
    return couple.partner_one_id === currentUserId ? couple.partner_two_id : couple.partner_one_id;
  }, [couple, currentUserId]);

  const getPersonMeta = useCallback((userId: string | null) => {
    const isMe = userId === currentUserId;
    const isFirst = userId === couple?.partner_one_id;
    const name = isMe
      ? "Вы"
      : isFirst
        ? profile?.partner_one || "Партнёр"
        : profile?.partner_two || "Партнёр";
    const avatar = isFirst ? profile?.avatar_one || profile?.avatar : profile?.avatar_two || profile?.avatar;
    return { name, avatar: avatar || null, initial: name.trim().slice(0, 1).toUpperCase() || "П" };
  }, [couple, currentUserId, profile]);

  const loadData = useCallback(async (coupleId: string, year: number) => {
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;
    const [
      categoryResult,
      preferenceResult,
      eventResult,
      goalResult,
      planResult,
      checkinResult,
      profileResult,
      commentResult,
    ] = await Promise.all([
      supabase.from("tracker_categories").select("*").order("sort_order"),
      supabase.from("tracker_category_preferences").select("*").eq("couple_id", coupleId),
      supabase.from("tracker_events").select("*").eq("couple_id", coupleId).gte("date", from).lte("date", to).order("date"),
      supabase.from("tracker_goals").select("*").eq("couple_id", coupleId).order("created_at", { ascending: false }),
      supabase.from("tracker_plans").select("*").eq("couple_id", coupleId).order("created_at", { ascending: false }),
      supabase.rpc("get_tracker_checkins", { p_couple_id: coupleId, p_from: from, p_to: to }),
      supabase.from("couple_profiles").select("partner_one,partner_two,avatar,avatar_one,avatar_two,time_zone").eq("couple_id", coupleId).limit(1).maybeSingle(),
      supabase.from("tracker_plan_comments").select("*").eq("couple_id", coupleId).order("created_at"),
    ]);

    const rawCategories = (categoryResult.data || []) as TrackerCategory[];
    const preferences = (preferenceResult.data || []) as TrackerCategoryPreference[];
    const byCategory = new Map(preferences.map((item) => [item.category_id, item]));
    const mergedCategories = rawCategories
      .map((category) => {
        const preference = byCategory.get(category.id);
        return {
          ...category,
          name: preference?.label || category.name,
          color: preference?.color || category.color,
          sort_order: preference?.sort_order ?? category.sort_order,
          hidden: preference?.hidden || false,
        };
      })
      .filter((category) => !category.hidden)
      .sort((first, second) => first.sort_order - second.sort_order);

    const rawComments = (commentResult.data || []) as TrackerComment[];
    const signedComments = await Promise.all(rawComments.map(async (comment) => {
      if (!comment.attachment_url) return comment;
      const { data } = await supabase.storage.from("tracker-media").createSignedUrl(comment.attachment_url, 3600);
      return { ...comment, attachment_signed_url: data?.signedUrl || null };
    }));

    setCategories(mergedCategories);
    setCategoryDrafts(Object.fromEntries(mergedCategories.map((item) => [item.id, item.name])));
    setEvents((eventResult.data || []) as TrackerEvent[]);
    setGoals((goalResult.data || []) as TrackerGoal[]);
    setPlans((planResult.data || []) as TrackerPlan[]);
    setCheckins((checkinResult.data || []) as TrackerCheckin[]);
    setProfile((profileResult.data || null) as Profile | null);
    setComments(signedComments);
    setGoalCategoryId((current) => current || mergedCategories[0]?.id || "");

    const firstError = [
      categoryResult.error,
      preferenceResult.error,
      eventResult.error,
      goalResult.error,
      planResult.error,
      checkinResult.error,
      profileResult.error,
      commentResult.error,
    ].find(Boolean);
    if (firstError) setMessage(`Не всё удалось загрузить: ${firstError.message}`);
  }, []);

  useEffect(() => {
    let ignore = false;
    async function loadIdentity() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data } = await supabase
        .from("couples")
        .select("id,partner_one_id,partner_two_id")
        .or(`partner_one_id.eq.${user.id},partner_two_id.eq.${user.id}`)
        .limit(1)
        .maybeSingle<Couple>();
      if (ignore) return;
      if (!data) {
        router.replace("/couple");
        return;
      }
      setCurrentUserId(user.id);
      setCouple(data);
    }
    void loadIdentity();
    return () => { ignore = true; };
  }, [router]);

  useEffect(() => {
    if (!couple) return;
    let ignore = false;
    setIsLoading(true);
    void loadData(couple.id, selectedYear).finally(() => {
      if (!ignore) setIsLoading(false);
    });
    return () => { ignore = true; };
  }, [couple, loadData, reloadVersion, selectedYear]);

  useEffect(() => {
    if (!couple) return;
    const refresh = () => setReloadVersion((value) => value + 1);
    const channel = supabase
      .channel(`tracker-lab:${couple.id}:${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tracker_events", filter: `couple_id=eq.${couple.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "tracker_goals", filter: `couple_id=eq.${couple.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "tracker_plans", filter: `couple_id=eq.${couple.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "tracker_checkins", filter: `couple_id=eq.${couple.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "tracker_plan_comments", filter: `couple_id=eq.${couple.id}` }, refresh)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [couple]);

  useEffect(() => {
    const own = checkins.find((item) => item.date === selectedDate && item.is_own);
    if (!own) return;
    if (own.mood) setCheckinMood(own.mood);
    setCheckinEnergy(own.energy || 3);
    setCheckinRelationship(own.relationship || 3);
    setCheckinVisibility(own.visibility);
    setCheckinNote(own.note || "");
    setCheckinReveal(own.reveal_after_both);
  }, [checkins, selectedDate]);

  useEffect(() => {
    if (!agendaRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cards = agendaRef.current.querySelectorAll("[data-plan-card]");
    if (!cards.length) return;
    const animation = animate(cards, {
      opacity: [0, 1],
      translateY: [12, 0],
      duration: 420,
      delay: (_element, index) => index * 45,
      ease: "out(3)",
    });
    return () => {
      const controls = animation as { pause?: () => void; revert?: () => void };
      controls.pause?.();
      controls.revert?.();
    };
  }, [plans, selectedDate, activeTab]);

  useEffect(() => {
    function handleKeyboard(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input,textarea,select,[contenteditable='true']")) return;
      if (event.key.toLowerCase() === "t") setSelectedDate(toTrackerDateKey(new Date()));
      if (event.key.toLowerCase() === "n") {
        setPlanDate(selectedDate);
        setComposerMode("plan");
      }
      if (event.key === "/") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>("[data-tracker-search]")?.focus();
      }
      if (event.key === "Escape") {
        setComposerMode(null);
        setSelectedPlanId(null);
        setIsFreeTimeOpen(false);
        setMemoryPlan(null);
      }
      if (event.key === "ArrowLeft") setSelectedDate((date) => toTrackerDateKey(addTrackerDays(parseTrackerDateKey(date), -1)));
      if (event.key === "ArrowRight") setSelectedDate((date) => toTrackerDateKey(addTrackerDays(parseTrackerDateKey(date), 1)));
    }
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [selectedDate]);

  useEffect(() => () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    recorder?.stream.getTracks().forEach((track) => track.stop());
  }, []);

  const viewRange = useMemo(
    () => getTrackerViewRange(selectedDate, calendarMode),
    [calendarMode, selectedDate],
  );
  const occurrences = useMemo(
    () => expandTrackerPlanOccurrences(plans, `${selectedYear}-01-01`, `${selectedYear}-12-31`),
    [plans, selectedYear],
  );
  const filteredOccurrences = useMemo(() => occurrences.filter((occurrence) => {
    const scope = currentUserId ? relativeScope(occurrence.plan, currentUserId) : "both";
    const matchesScope = scopeFilter === "all" || scope === scopeFilter;
    const query = search.trim().toLocaleLowerCase("ru-RU");
    const matchesSearch = !query || [occurrence.plan.title, occurrence.plan.description, kindLabels[occurrence.plan.kind]]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("ru-RU")
      .includes(query);
    return matchesScope && matchesSearch;
  }), [currentUserId, occurrences, scopeFilter, search]);

  const selectedOccurrences = useMemo(
    () => filteredOccurrences.filter((item) => item.dateKey === selectedDate),
    [filteredOccurrences, selectedDate],
  );
  const selectedPlan = plans.find((item) => item.id === selectedPlanId) || null;
  const selectedComments = comments.filter((item) => item.plan_id === selectedPlanId);
  const week = useMemo(() => getWeekStrip(selectedDate), [selectedDate]);
  const cells = useMemo(() => monthCells(selectedDate), [selectedDate]);
  const activeEvents = events.filter((event) => event.count > 0 && !isMoodMarker(event));
  const selectedDayEvents = activeEvents.filter((event) => event.date === selectedDate);
  const nextOccurrence = useMemo(() => {
    const nowKey = toTrackerDateKey(new Date());
    return filteredOccurrences.find((item) => item.dateKey >= nowKey && item.plan.status !== "done") || null;
  }, [filteredOccurrences]);
  const selectedDateCheckins = checkins.filter((item) => item.date === selectedDate);

  const periodEvents = activeEvents.filter((event) => event.date >= viewRange.from && event.date <= viewRange.to);
  const stats = {
    marks: periodEvents.reduce((sum, event) => sum + event.count, 0),
    days: new Set(periodEvents.map((event) => event.date)).size,
    together: filteredOccurrences.filter((item) => item.dateKey >= viewRange.from && item.dateKey <= viewRange.to && item.plan.participant_scope === "both").length,
    done: filteredOccurrences.filter((item) => item.dateKey >= viewRange.from && item.dateKey <= viewRange.to && item.plan.status === "done").length,
  };

  function openComposer(mode: ComposerMode) {
    setPlanDate(selectedDate);
    setComposerMode(mode);
  }

  async function adjustCategory(category: TrackerCategory, delta: 1 | -1) {
    if (!couple || isSaving) return;
    setIsSaving(true);
    const previous = events;
    const own = events.find((event) =>
      event.date === selectedDate &&
      event.category_id === category.id &&
      event.created_by === currentUserId &&
      !isMoodMarker(event),
    );
    if (own) {
      const nextCount = own.count + delta;
      setEvents((items) => nextCount <= 0
        ? items.filter((item) => item.id !== own.id)
        : items.map((item) => item.id === own.id ? { ...item, count: nextCount } : item));
    }
    try {
      const { error } = await supabase.rpc("adjust_tracker_event_count", {
        p_couple_id: couple.id,
        p_category_id: category.id,
        p_date: selectedDate,
        p_delta: delta,
      });
      if (error) throw error;
      setReloadVersion((value) => value + 1);
    } catch (error) {
      setEvents(previous);
      setMessage(`Не удалось изменить отметку: ${getErrorMessage(error, "повторите ещё раз")}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function saveCheckin() {
    if (!couple) return;
    setIsSaving(true);
    const { error } = await supabase.rpc("save_tracker_checkin", {
      p_couple_id: couple.id,
      p_date: selectedDate,
      p_mood: checkinMood,
      p_energy: checkinEnergy,
      p_relationship: checkinRelationship,
      p_visibility: checkinVisibility,
      p_note: checkinNote.trim() || null,
      p_reveal_after_both: checkinReveal,
    });
    if (error) setMessage(`Не удалось сохранить check-in: ${error.message}`);
    else {
      setMessage("Состояние дня сохранено");
      setComposerMode(null);
      setReloadVersion((value) => value + 1);
    }
    setIsSaving(false);
  }

  async function savePlan() {
    if (!couple || !currentUserId || !planTitle.trim()) return;
    setIsSaving(true);
    const allDay = !planTime;
    const startsAt = allDay ? null : new Date(`${planDate}T${planTime}:00`).toISOString();
    const endsAt = allDay || !planEndTime ? null : new Date(`${planDate}T${planEndTime}:00`).toISOString();
    const optimistic: TrackerPlan = {
      id: `local-${Date.now()}`,
      couple_id: couple.id,
      title: planTitle.trim(),
      description: planDescription.trim() || null,
      kind: planKind,
      start_date: allDay ? planDate : null,
      starts_at: startsAt,
      ends_at: endsAt,
      all_day: allDay,
      participant_scope: planVisibility === "private" ? "me" : planScope,
      assignee_id: planScope === "partner" ? partnerId : planScope === "me" ? currentUserId : null,
      visibility: planVisibility,
      status: "planned",
      repeat_mode: planRepeat,
      repeat_interval: 1,
      repeat_weekdays: planRepeat === "weekly" ? [parseTrackerDateKey(planDate).getDay() || 7] : [],
      repeat_until: planRepeat === "none" ? null : planRepeatUntil || null,
      category_id: null,
      color: null,
      edit_scope: "participants",
      created_by: currentUserId,
      updated_by: currentUserId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setPlans((items) => [optimistic, ...items]);

    try {
      const { data, error } = await supabase.from("tracker_plans").insert({
        couple_id: optimistic.couple_id,
        title: optimistic.title,
        description: optimistic.description,
        kind: optimistic.kind,
        start_date: optimistic.start_date,
        starts_at: optimistic.starts_at,
        ends_at: optimistic.ends_at,
        all_day: optimistic.all_day,
        participant_scope: optimistic.participant_scope,
        assignee_id: optimistic.assignee_id,
        visibility: optimistic.visibility,
        status: optimistic.status,
        repeat_mode: optimistic.repeat_mode,
        repeat_interval: optimistic.repeat_interval,
        repeat_weekdays: optimistic.repeat_weekdays,
        repeat_until: optimistic.repeat_until,
        edit_scope: optimistic.edit_scope,
        created_by: currentUserId,
        updated_by: currentUserId,
      }).select("*").single<TrackerPlan>();
      if (error || !data) throw error || new Error("Событие не создано");

      const participantIds = data.visibility === "private"
        ? [currentUserId]
        : data.participant_scope === "both"
          ? [currentUserId, partnerId].filter((value): value is string => Boolean(value))
          : data.participant_scope === "partner" && partnerId
            ? [partnerId]
            : [currentUserId];
      await supabase.from("tracker_plan_participants").insert(participantIds.map((userId) => ({
        plan_id: data.id,
        couple_id: couple.id,
        user_id: userId,
        role: userId === data.assignee_id ? "responsible" : "participant",
        response: userId === currentUserId ? "accepted" : "pending",
      })));
      await supabase.from("tracker_plan_reminders").insert({
        plan_id: data.id,
        couple_id: couple.id,
        user_id: currentUserId,
        offset_minutes: planReminder,
        delivery: "push",
      });
      await supabase.from("tracker_plan_activity").insert({
        plan_id: data.id,
        couple_id: couple.id,
        actor_id: currentUserId,
        activity_type: "created",
      });

      setPlans((items) => items.map((item) => item.id === optimistic.id ? data : item));
      setPlanTitle("");
      setPlanDescription("");
      setPlanTime("");
      setPlanEndTime("");
      setPlanRepeat("none");
      setPlanRepeatUntil("");
      setComposerMode(null);
      setSelectedPlanId(data.id);
      if (data.visibility === "couple") {
        await createPartnerNotification(couple, currentUserId, {
          type: "tracker_plan_created",
          title: "Новый совместный план",
          body: data.title,
          href: "/tracker/lab",
        });
      }
    } catch (error) {
      setPlans((items) => items.filter((item) => item.id !== optimistic.id));
      setMessage(`Не удалось создать событие: ${getErrorMessage(error, "попробуйте снова")}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function updatePlanStatus(plan: TrackerPlan, status: TrackerPlan["status"]) {
    const previous = plans;
    setPlans((items) => items.map((item) => item.id === plan.id ? { ...item, status } : item));
    const { error } = await supabase.from("tracker_plans").update({
      status,
      updated_by: currentUserId,
      updated_at: new Date().toISOString(),
    }).eq("id", plan.id).eq("couple_id", plan.couple_id);
    if (error) {
      setPlans(previous);
      setMessage(`Не удалось обновить план: ${error.message}`);
      return;
    }
    if (status === "done" && currentUserId) {
      await supabase.from("tracker_plan_activity").insert({
        plan_id: plan.id,
        couple_id: plan.couple_id,
        actor_id: currentUserId,
        activity_type: "completed",
      });
    }
  }

  async function deletePlan(plan: TrackerPlan) {
    if (!window.confirm("Удалить этот план?")) return;
    const previous = plans;
    setPlans((items) => items.filter((item) => item.id !== plan.id));
    setSelectedPlanId(null);
    const { error } = await supabase.from("tracker_plans").delete().eq("id", plan.id).eq("created_by", currentUserId);
    if (error) {
      setPlans(previous);
      setMessage("Удалить план может только его автор.");
    }
  }

  async function createGoal() {
    if (!couple || !currentUserId || !goalCategoryId) return;
    const category = categories.find((item) => item.id === goalCategoryId);
    if (!category) return;
    setIsSaving(true);
    const { error } = await supabase.from("tracker_goals").insert({
      couple_id: couple.id,
      title: category.name,
      category_id: category.id,
      period: goalPeriod,
      target_count: goalTarget,
      created_by: currentUserId,
    });
    if (error) setMessage(`Не удалось сохранить цель: ${error.message}`);
    else {
      setComposerMode(null);
      setReloadVersion((value) => value + 1);
      await createPartnerNotification(couple, currentUserId, {
        type: "tracker_goal_created",
        title: "Новая цель пары",
        body: `${category.name}: ${goalTarget}`,
        href: "/tracker/lab",
      });
    }
    setIsSaving(false);
  }

  async function deleteGoal(goal: TrackerGoal) {
    const previous = goals;
    setGoals((items) => items.filter((item) => item.id !== goal.id));
    const { error } = await supabase.from("tracker_goals").delete().eq("id", goal.id).eq("created_by", currentUserId);
    if (error) {
      setGoals(previous);
      setMessage("Удалить цель может только её автор.");
    }
  }

  async function saveCategoryName(category: TrackerCategory) {
    if (!couple || !currentUserId) return;
    const label = categoryDrafts[category.id]?.trim();
    if (!label) return;
    const { error } = await supabase.from("tracker_category_preferences").upsert({
      couple_id: couple.id,
      category_id: category.id,
      label,
      updated_by: currentUserId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "couple_id,category_id" });
    if (error) setMessage(`Не удалось переименовать категорию: ${error.message}`);
    else {
      setMessage("Название изменено только для вашей пары");
      setReloadVersion((value) => value + 1);
    }
  }

  function selectCommentFile(files: File[]) {
    const file = files[0];
    if (!file) return;
    const kind = getMediaKind(file);
    const max = kind === "audio" ? MAX_AUDIO_SIZE : kind === "image" ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;
    const validation = validateMediaFile(file, ["image", "video", "audio", "file"], max);
    if (validation.error) {
      setMessage(validation.error);
      return;
    }
    setCommentFile(file);
  }

  function handleCommentPaste(event: ReactClipboardEvent<HTMLTextAreaElement>) {
    handleClipboardFilePaste(event, selectCommentFile);
  }

  async function toggleRecording() {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = createCompatibleAudioRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        try {
          setCommentFile(createRecordedAudioFile(audioChunksRef.current, recorder.mimeType, "tracker-voice"));
        } catch (error) {
          setMessage(getErrorMessage(error, "Не удалось сохранить голосовую запись"));
        }
      };
      recorder.start();
      setIsRecording(true);
    } catch {
      setMessage("Разрешите доступ к микрофону или прикрепите готовый аудиофайл.");
    }
  }

  async function addComment() {
    if (!couple || !currentUserId || !selectedPlan || (!commentText.trim() && !commentFile)) return;
    setIsSaving(true);
    let storagePath: string | null = null;
    try {
      let attachmentType: TrackerComment["attachment_type"] = null;
      if (commentFile) {
        attachmentType = getMediaKind(commentFile);
        const safeName = commentFile.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
        storagePath = `${couple.id}/${selectedPlan.id}/${currentUserId}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from("tracker-media").upload(storagePath, commentFile);
        if (uploadError) throw uploadError;
      }
      const { data, error } = await supabase.from("tracker_plan_comments").insert({
        plan_id: selectedPlan.id,
        couple_id: couple.id,
        user_id: currentUserId,
        text: commentText.trim() || null,
        attachment_url: storagePath,
        attachment_name: commentFile?.name || null,
        attachment_type: attachmentType,
        mime_type: commentFile?.type || null,
      }).select("*").single<TrackerComment>();
      if (error || !data) throw error || new Error("Комментарий не сохранён");
      if (storagePath && commentFile && attachmentType) {
        await supabase.from("tracker_plan_attachments").insert({
          plan_id: selectedPlan.id,
          comment_id: data.id,
          couple_id: couple.id,
          owner_id: currentUserId,
          storage_path: storagePath,
          url: storagePath,
          name: commentFile.name,
          mime_type: commentFile.type || null,
          media_type: attachmentType,
          size_bytes: commentFile.size,
        });
      }
      await supabase.from("tracker_plan_activity").insert({
        plan_id: selectedPlan.id,
        couple_id: couple.id,
        actor_id: currentUserId,
        activity_type: "commented",
      });
      setCommentText("");
      setCommentFile(null);
      setReloadVersion((value) => value + 1);
      if (selectedPlan.visibility === "couple") {
        await createPartnerNotification(couple, currentUserId, {
          type: "tracker_plan_comment",
          title: "Комментарий к плану",
          body: selectedPlan.title,
          href: "/tracker/lab",
        });
      }
    } catch (error) {
      if (storagePath) await supabase.storage.from("tracker-media").remove([storagePath]);
      setMessage(`Не удалось добавить комментарий: ${getErrorMessage(error, "попробуйте снова")}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function loadFreeTime() {
    if (!couple) return;
    setIsFreeTimeOpen(true);
    const { data, error } = await supabase.rpc("find_tracker_common_free_slots", {
      p_couple_id: couple.id,
      p_date: selectedDate,
      p_duration_minutes: 60,
      p_day_start: "09:00",
      p_day_end: "22:00",
    });
    if (error) setMessage(`Не удалось найти свободное время: ${error.message}`);
    setFreeSlots((data || []) as Array<{ starts_at: string; ends_at: string }>);
  }

  function downloadCalendar(plan: TrackerPlan) {
    const blob = new Blob([buildTrackerPlanIcs(plan, planReminder)], { type: "text/calendar;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `${plan.title.replace(/[^a-zа-яё0-9]+/gi, "-").toLowerCase() || "couple-space"}.ics`;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  function openMemoryComposer(plan: TrackerPlan) {
    setMemoryPlan(plan);
    setMemoryTitle(plan.title);
    setMemoryCaption(plan.description || "");
  }

  async function createMemoryFromPlan() {
    if (!memoryPlan || !couple || !currentUserId) return;
    setIsSaving(true);
    const uploadedPaths: string[] = [];
    try {
      const { data: attachmentRows } = await supabase
        .from("tracker_plan_attachments")
        .select("storage_path,name,mime_type,media_type,size_bytes")
        .eq("plan_id", memoryPlan.id)
        .order("created_at")
        .limit(8);
      let photoUrl: string | null = null;
      let voiceUrl: string | null = null;
      const memoryAttachments: MemoryAttachment[] = [];

      for (const attachment of attachmentRows || []) {
        const { data: blob, error: downloadError } = await supabase.storage
          .from("tracker-media")
          .download(attachment.storage_path);
        if (downloadError || !blob) continue;
        const file = new File([blob], attachment.name, { type: attachment.mime_type || blob.type });
        const targetPath = getSafeStoragePath(couple.id, file);
        const { error: uploadError } = await supabase.storage.from("memory-images").upload(targetPath, file);
        if (uploadError) continue;
        uploadedPaths.push(targetPath);
        const { data: publicData } = supabase.storage.from("memory-images").getPublicUrl(targetPath);
        const url = toPortableSupabaseUrl(publicData.publicUrl) || publicData.publicUrl;
        const mediaType = attachment.media_type as MemoryAttachment["type"];
        if (mediaType === "image" && !photoUrl) photoUrl = url;
        else if (mediaType === "audio" && !voiceUrl) voiceUrl = url;
        else memoryAttachments.push({
          url,
          type: mediaType,
          name: attachment.name,
          mimeType: attachment.mime_type,
          size: attachment.size_bytes || null,
        });
      }

      const { data: memory, error } = await supabase.from("memories").insert({
        couple_id: couple.id,
        user_id: currentUserId,
        title: memoryTitle.trim() || memoryPlan.title,
        caption: memoryCaption.trim() || null,
        text: memoryCaption.trim() || null,
        event_date: getPlanBaseDate(memoryPlan),
        image: encodeMemoryMedia({ photoUrl, voiceUrl, attachments: memoryAttachments }),
      }).select("id").single<{ id: string }>();
      if (error || !memory) throw error || new Error("Воспоминание не создано");
      await supabase.from("tracker_plan_memory_links").insert({
        plan_id: memoryPlan.id,
        memory_id: memory.id,
        couple_id: couple.id,
        created_by: currentUserId,
      });
      await supabase.from("tracker_plan_activity").insert({
        plan_id: memoryPlan.id,
        couple_id: couple.id,
        actor_id: currentUserId,
        activity_type: "memory_created",
      });
      router.push(`/memories/${memory.id}`);
    } catch (error) {
      if (uploadedPaths.length) await supabase.storage.from("memory-images").remove(uploadedPaths);
      setMessage(`Не удалось создать воспоминание: ${getErrorMessage(error, "попробуйте снова")}`);
    } finally {
      setIsSaving(false);
    }
  }

  function navigateDate(amount: number) {
    const source = parseTrackerDateKey(selectedDate);
    if (calendarMode === "day") source.setDate(source.getDate() + amount);
    if (calendarMode === "week") source.setDate(source.getDate() + amount * 7);
    if (calendarMode === "month") source.setMonth(source.getMonth() + amount);
    if (calendarMode === "year") source.setFullYear(source.getFullYear() + amount);
    setSelectedDate(toTrackerDateKey(source));
  }

  function renderPlanCard(occurrence: TrackerOccurrence, compact = false) {
    const plan = occurrence.plan;
    const person = getPersonMeta(plan.created_by);
    const scope = currentUserId ? relativeScope(plan, currentUserId) : "both";
    return (
      <article
        key={`${plan.id}-${occurrence.dateKey}`}
        className={`tracker-lab-plan-card is-${plan.kind} ${plan.status === "done" ? "is-done" : ""} ${compact ? "is-compact" : ""}`}
        data-plan-card
        data-plan-id={plan.id}
      >
        <button type="button" className="tracker-lab-plan-main" onClick={() => setSelectedPlanId(plan.id)}>
          <span className="tracker-lab-plan-icon">{getPlanIcon(plan.kind)}</span>
          <span className="tracker-lab-plan-copy">
            <span className="tracker-lab-plan-meta">
              {formatClock(occurrence.startsAt)}
              <span>·</span>
              {scope === "both" ? "Вместе" : scope === "me" ? "Для вас" : "Для партнёра"}
              {plan.visibility === "private" && <Lock size={12} aria-label="Приватное событие" />}
            </span>
            <strong>{plan.title}</strong>
            {!compact && plan.description && <small>{plan.description}</small>}
          </span>
          <span className="tracker-lab-avatar" aria-label={person.name}>
            {person.avatar ? <Image src={person.avatar} alt="" width={34} height={34} unoptimized /> : person.initial}
          </span>
        </button>
        <div className="tracker-lab-plan-actions">
          {plan.status !== "done" && (
            <button type="button" onClick={() => void updatePlanStatus(plan, "done")}><Check size={15} />Готово</button>
          )}
          <button type="button" onClick={() => downloadCalendar(plan)}><Download size={15} />В календарь</button>
          {plan.status === "done" && (
            <button type="button" onClick={() => openMemoryComposer(plan)}><Sparkles size={15} />В воспоминания</button>
          )}
        </div>
      </article>
    );
  }

  function renderMonthCalendar() {
    return (
      <section className="tracker-lab-calendar-card" aria-label="Календарь месяца">
        <div className="tracker-lab-calendar-title">
          <button type="button" onClick={() => navigateDate(-1)} aria-label="Предыдущий период"><ChevronLeft /></button>
          <div>
            <strong>{new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(parseTrackerDateKey(selectedDate))}</strong>
            <button type="button" onClick={() => setSelectedDate(toTrackerDateKey(new Date()))}>Сегодня</button>
          </div>
          <button type="button" onClick={() => navigateDate(1)} aria-label="Следующий период"><ChevronRight /></button>
        </div>
        <div className="tracker-lab-weekdays" aria-hidden="true">
          {["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="tracker-lab-month-grid">
          {cells.map((cell) => {
            const dayOccurrences = filteredOccurrences.filter((item) => item.dateKey === cell.key);
            const dayEvents = activeEvents.filter((event) => event.date === cell.key);
            return (
              <button
                type="button"
                key={cell.key}
                className={[
                  "tracker-lab-day-cell",
                  cell.isCurrentMonth ? "" : "is-muted",
                  cell.key === selectedDate ? "is-selected" : "",
                  cell.key === toTrackerDateKey(new Date()) ? "is-today" : "",
                ].join(" ")}
                onClick={() => setSelectedDate(cell.key)}
                aria-label={formatTrackerDate(cell.key)}
                aria-pressed={cell.key === selectedDate}
              >
                <span>{cell.day}</span>
                <span className="tracker-lab-day-dots">
                  {dayOccurrences.slice(0, 2).map((item) => <i key={item.plan.id} style={{ background: item.plan.color || "#d97706" }} />)}
                  {dayEvents.length > 0 && <i className="is-activity" />}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  function renderActivityCounters() {
    return (
      <section className="tracker-lab-activity-card">
        <div className="tracker-lab-section-heading">
          <div><span>Быстрая отметка</span><h2>Что было сегодня?</h2></div>
          <Activity aria-hidden="true" />
        </div>
        <div className="tracker-lab-counter-grid">
          {categories.map((category) => {
            const mine = selectedDayEvents.filter((event) => event.category_id === category.id && event.created_by === currentUserId)
              .reduce((sum, event) => sum + event.count, 0);
            const partner = selectedDayEvents.filter((event) => event.category_id === category.id && event.created_by !== currentUserId)
              .reduce((sum, event) => sum + event.count, 0);
            return (
              <div className="tracker-lab-counter" key={category.id} style={{ ["--category-color" as string]: categoryColor(category) }}>
                <span className="tracker-lab-counter-icon">{getCategoryIcon(category)}</span>
                <span className="tracker-lab-counter-name">{category.name}</span>
                <span className="tracker-lab-counter-partner">Партнёр · {partner}</span>
                <div>
                  <button type="button" onClick={() => void adjustCategory(category, -1)} disabled={mine === 0 || isSaving} aria-label={`Уменьшить ${category.name}`}><Minus /></button>
                  <strong>{mine}</strong>
                  <button type="button" onClick={() => void adjustCategory(category, 1)} disabled={isSaving} aria-label={`Добавить ${category.name}`}><Plus /></button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  function renderCheckinCard() {
    return (
      <section className="tracker-lab-checkin-card">
        <div className="tracker-lab-section-heading">
          <div><span>Состояние дня</span><h2>Как вы сегодня?</h2></div>
          <Sparkles aria-hidden="true" />
        </div>
        <div className="tracker-lab-checkin-people">
          {selectedDateCheckins.length === 0 && <p>Пока никто не отмечался.</p>}
          {selectedDateCheckins.map((checkin) => {
            const person = getPersonMeta(checkin.user_id);
            const mood = moods.find((item) => item.key === checkin.mood);
            return (
              <div key={checkin.id}>
                <span className="tracker-lab-avatar">{person.avatar ? <Image src={person.avatar} alt="" width={36} height={36} unoptimized /> : person.initial}</span>
                <span><strong>{person.name}</strong><small>{mood ? mood.label : "Ответ откроется позже"}</small></span>
                {mood ? <FluentEmoji emoji={mood.emoji} size={34} decorative /> : <Lock size={20} />}
              </div>
            );
          })}
        </div>
        <button type="button" className="tracker-lab-secondary-button" onClick={() => openComposer("checkin")}>Отметить состояние</button>
      </section>
    );
  }

  if (isLoading && !couple) {
    return (
      <main className="tracker-lab-page" style={{ ["--scroll-accent" as string]: "#d97706" }}>
        <div className="tracker-lab-loading"><Sparkles /><strong>Собираем ваш общий ритм…</strong></div>
      </main>
    );
  }

  return (
    <main className="tracker-lab-page" style={{ ["--scroll-accent" as string]: "#d97706" }}>
      <div className="tracker-lab-ambient one" />
      <div className="tracker-lab-ambient two" />
      <section className="tracker-lab-shell">
        <header className="tracker-lab-header">
          <div>
            <Link href="/tracker" className="tracker-lab-back"><ChevronLeft size={17} />Оригинальный трекер</Link>
            <p>Экспериментальная версия</p>
            <h1>Наш ритм</h1>
            <span>Планы, привычки и маленькие моменты в одном календаре</span>
          </div>
          <div className="tracker-lab-next">
            <span><Zap size={15} />Ближайшее</span>
            {nextOccurrence ? (
              <>
                <strong>{nextOccurrence.plan.title}</strong>
                <small>{formatTrackerDate(nextOccurrence.dateKey)} · {formatClock(nextOccurrence.startsAt)}</small>
              </>
            ) : (
              <>
                <strong>Свободное пространство</strong>
                <small>Добавьте совместный план</small>
              </>
            )}
          </div>
        </header>

        <nav className="tracker-lab-local-nav" aria-label="Разделы экспериментального трекера">
          {([
            ["today", LayoutDashboard, "Сегодня"],
            ["calendar", CalendarRange, "Календарь"],
            ["activity", Activity, "Активность"],
          ] as const).map(([key, Icon, label]) => (
            <button type="button" key={key} className={activeTab === key ? "is-active" : ""} onClick={() => setActiveTab(key)}>
              <Icon size={18} /><span>{label}</span>
            </button>
          ))}
        </nav>

        {message && (
          <div className="tracker-lab-toast" role="status">
            <span>{message}</span>
            <button type="button" onClick={() => setMessage("")} aria-label="Закрыть"><X /></button>
          </div>
        )}

        <section className="tracker-lab-toolbar">
          <div className="tracker-lab-week-strip">
            {week.map((item) => (
              <button type="button" key={item.dateKey} className={selectedDate === item.dateKey ? "is-active" : ""} onClick={() => setSelectedDate(item.dateKey)}>
                <small>{item.weekday}</small><strong>{item.day}</strong>{item.isToday && <i />}
              </button>
            ))}
          </div>
          <label className="tracker-lab-search">
            <Search aria-hidden="true" />
            <input data-tracker-search value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Найти в календаре" />
          </label>
          <button type="button" className="tracker-lab-refresh" onClick={() => setReloadVersion((value) => value + 1)} aria-label="Обновить"><RefreshCw /></button>
        </section>

        {activeTab === "today" && (
          <section className="tracker-lab-desktop-grid">
            <aside className="tracker-lab-left-column">
              {renderMonthCalendar()}
              <button type="button" className="tracker-lab-free-button" onClick={() => void loadFreeTime()}>
                <Clock3 /><span><strong>Наше свободное время</strong><small>Найти час без пересечений</small></span><ChevronRight />
              </button>
            </aside>

            <div className="tracker-lab-agenda-column">
              <div className="tracker-lab-agenda-heading">
                <div><span>Выбранный день</span><h2>{formatTrackerDate(selectedDate)}</h2></div>
                <div className="tracker-lab-filter-row">
                  {(["all","me","partner","both"] as ScopeFilter[]).map((filter) => (
                    <button type="button" key={filter} className={scopeFilter === filter ? "is-active" : ""} onClick={() => setScopeFilter(filter)}>
                      {filter === "all" ? "Все" : filter === "me" ? "Я" : filter === "partner" ? "Партнёр" : "Вместе"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="tracker-lab-agenda" ref={agendaRef}>
                {selectedOccurrences.length === 0 ? (
                  <div className="tracker-lab-empty">
                    <CalendarDays /><strong>День пока свободен</strong><span>Можно оставить его таким или добавить общий план.</span>
                    <button type="button" onClick={() => openComposer("plan")}><Plus />Добавить</button>
                  </div>
                ) : selectedOccurrences.map((occurrence) => renderPlanCard(occurrence))}
              </div>
              {renderActivityCounters()}
            </div>

            <aside className="tracker-lab-right-column">
              {renderCheckinCard()}
              <section className="tracker-lab-stats-card">
                <div className="tracker-lab-section-heading">
                  <div><span>Ритм периода</span><h2>Без соревнования</h2></div><Activity />
                </div>
                <div className="tracker-lab-mini-stats">
                  <div><strong>{stats.marks}</strong><span>отметок</span></div>
                  <div><strong>{stats.days}</strong><span>активных дней</span></div>
                  <div><strong>{stats.together}</strong><span>общих планов</span></div>
                  <div><strong>{stats.done}</strong><span>завершено</span></div>
                </div>
              </section>
              <section className="tracker-lab-goals-preview">
                <div className="tracker-lab-section-heading">
                  <div><span>Общие цели</span><h2>Маленькими шагами</h2></div><Target />
                </div>
                {goals.filter((goal) => goal.status !== "archived").slice(0, 3).map((goal) => {
                  const range = getTrackerViewRange(selectedDate, goal.period);
                  const progress = activeEvents.filter((event) => event.category_id === goal.category_id && event.date >= range.from && event.date <= range.to)
                    .reduce((sum, event) => sum + event.count, 0);
                  return (
                    <div className="tracker-lab-goal" key={goal.id}>
                      <span><strong>{goal.title}</strong><small>{Math.min(progress, goal.target_count)} из {goal.target_count}</small></span>
                      <i><b style={{ width: `${Math.min(100, progress / goal.target_count * 100)}%` }} /></i>
                    </div>
                  );
                })}
                <button type="button" className="tracker-lab-secondary-button" onClick={() => openComposer("goal")}><Plus />Новая цель</button>
              </section>
            </aside>
          </section>
        )}

        {activeTab === "calendar" && (
          <section className="tracker-lab-calendar-workspace">
            <div className="tracker-lab-calendar-controls">
              <div>
                {(["day","week","month","year"] as CalendarMode[]).map((mode) => (
                  <button type="button" key={mode} className={calendarMode === mode ? "is-active" : ""} onClick={() => setCalendarMode(mode)}>
                    {mode === "day" ? "День" : mode === "week" ? "Неделя" : mode === "month" ? "Месяц" : "Год"}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setSelectedDate(toTrackerDateKey(new Date()))}>Сегодня</button>
            </div>
            {calendarMode === "month" && renderMonthCalendar()}
            {(calendarMode === "day" || calendarMode === "week") && (
              <div className="tracker-lab-range-list" ref={agendaRef}>
                {filteredOccurrences
                  .filter((item) => item.dateKey >= viewRange.from && item.dateKey <= viewRange.to)
                  .map((item) => (
                    <div key={`${item.plan.id}-${item.dateKey}`}>
                      <time>{formatTrackerDate(item.dateKey, { weekday: "short", day: "numeric", month: "short" })}</time>
                      {renderPlanCard(item, true)}
                    </div>
                  ))}
              </div>
            )}
            {calendarMode === "year" && (
              <div className="tracker-lab-year-grid">
                {Array.from({ length: 12 }, (_, month) => {
                  const date = new Date(selectedYear, month, 1, 12);
                  const monthKey = `${selectedYear}-${String(month + 1).padStart(2, "0")}`;
                  const value = activeEvents.filter((event) => event.date.startsWith(monthKey)).reduce((sum, event) => sum + event.count, 0);
                  return (
                    <button type="button" key={month} onClick={() => { setSelectedDate(toTrackerDateKey(date)); setCalendarMode("month"); }}>
                      <span>{new Intl.DateTimeFormat("ru-RU", { month: "short" }).format(date)}</span>
                      <i style={{ ["--heat" as string]: Math.min(1, value / 18) }} />
                      <strong>{value}</strong>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {activeTab === "activity" && (
          <section className="tracker-lab-activity-workspace">
            <div className="tracker-lab-stat-strip">
              <article><Activity /><span><strong>{stats.marks}</strong><small>отметок за период</small></span></article>
              <article><CalendarDays /><span><strong>{stats.days}</strong><small>активных дней</small></span></article>
              <article><UsersRound /><span><strong>{stats.together}</strong><small>совместных планов</small></span></article>
              <article><Check /><span><strong>{stats.done}</strong><small>завершено</small></span></article>
            </div>
            <div className="tracker-lab-activity-layout">
              <section className="tracker-lab-insight-panel">
                <div className="tracker-lab-section-heading"><div><span>Категории</span><h2>Ваши названия</h2></div><Pencil /></div>
                {categories.map((category) => {
                  const value = periodEvents.filter((event) => event.category_id === category.id).reduce((sum, event) => sum + event.count, 0);
                  const max = Math.max(1, ...categories.map((item) => periodEvents.filter((event) => event.category_id === item.id).reduce((sum, event) => sum + event.count, 0)));
                  return (
                    <div className="tracker-lab-category-editor" key={category.id}>
                      <span style={{ color: categoryColor(category) }}>{getCategoryIcon(category)}</span>
                      <input value={categoryDrafts[category.id] || ""} onChange={(event) => setCategoryDrafts((items) => ({ ...items, [category.id]: event.target.value }))} />
                      <i><b style={{ width: `${value / max * 100}%`, background: categoryColor(category) }} /></i>
                      <strong>{value}</strong>
                      <button type="button" onClick={() => void saveCategoryName(category)} aria-label="Сохранить название"><Check /></button>
                    </div>
                  );
                })}
              </section>
              <section className="tracker-lab-insight-panel">
                <div className="tracker-lab-section-heading"><div><span>История</span><h2>Последние отметки</h2></div><ListFilter /></div>
                <div className="tracker-lab-history">
                  {[...activeEvents].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12).map((event) => {
                    const category = categories.find((item) => item.id === event.category_id);
                    const person = getPersonMeta(event.created_by);
                    return (
                      <div key={event.id}>
                        <span style={{ color: category ? categoryColor(category) : "#d97706" }}>{category ? getCategoryIcon(category) : <Activity />}</span>
                        <span><strong>{category?.name || "Активность"} · {event.count}</strong><small>{person.name} · {formatTrackerDate(event.date, { day: "numeric", month: "short" })}</small></span>
                      </div>
                    );
                  })}
                </div>
              </section>
              <section className="tracker-lab-insight-panel is-goals">
                <div className="tracker-lab-section-heading"><div><span>Цели</span><h2>Общий прогресс</h2></div><Target /></div>
                {goals.map((goal) => {
                  const range = getTrackerViewRange(selectedDate, goal.period);
                  const progress = activeEvents.filter((event) => event.category_id === goal.category_id && event.date >= range.from && event.date <= range.to).reduce((sum, event) => sum + event.count, 0);
                  return (
                    <div className="tracker-lab-goal-row" key={goal.id}>
                      <span><strong>{goal.title}</strong><small>{progress} / {goal.target_count}</small></span>
                      <i><b style={{ width: `${Math.min(100, progress / goal.target_count * 100)}%` }} /></i>
                      {goal.created_by === currentUserId && <button type="button" onClick={() => void deleteGoal(goal)} aria-label="Удалить цель"><Trash2 /></button>}
                    </div>
                  );
                })}
                <button type="button" className="tracker-lab-secondary-button" onClick={() => openComposer("goal")}><Plus />Добавить цель</button>
              </section>
            </div>
          </section>
        )}
      </section>

      <button type="button" className="tracker-lab-fab" onClick={() => setComposerMode("menu")} aria-label="Добавить запись">
        <Plus />
      </button>

      {selectedPlan && (
        <div className="tracker-lab-overlay" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelectedPlanId(null); }}>
          <aside className="tracker-lab-detail-sheet" aria-label="Подробности события">
            <button type="button" className="tracker-lab-sheet-close" onClick={() => setSelectedPlanId(null)} aria-label="Закрыть"><X /></button>
            <span className="tracker-lab-detail-icon">{getPlanIcon(selectedPlan.kind, 24)}</span>
            <p>{kindLabels[selectedPlan.kind]} · {selectedPlan.visibility === "private" ? "Только вам" : "Для пары"}</p>
            <h2>{selectedPlan.title}</h2>
            {selectedPlan.description && <div className="tracker-lab-detail-description">{selectedPlan.description}</div>}
            <dl className="tracker-lab-detail-list">
              <div><dt><CalendarDays /></dt><dd><strong>{formatTrackerDate(getPlanBaseDate(selectedPlan))}</strong><span>{selectedPlan.all_day ? "Весь день" : formatClock(selectedPlan.starts_at)}</span></dd></div>
              <div><dt><UsersRound /></dt><dd><strong>{selectedPlan.participant_scope === "both" ? "Вместе" : selectedPlan.participant_scope === "me" ? "Автор" : "Партнёр"}</strong><span>{selectedPlan.edit_scope === "participants" ? "Можно редактировать вместе" : "Редактирует автор"}</span></dd></div>
              <div><dt><RefreshCw /></dt><dd><strong>{repeatLabels[selectedPlan.repeat_mode]}</strong><span>{selectedPlan.repeat_until ? `До ${formatTrackerDate(selectedPlan.repeat_until)}` : "Без даты окончания"}</span></dd></div>
            </dl>
            <div className="tracker-lab-detail-actions">
              {selectedPlan.status !== "done" && <button type="button" onClick={() => void updatePlanStatus(selectedPlan, "done")}><Check />Завершить</button>}
              <button type="button" onClick={() => downloadCalendar(selectedPlan)}><Download />Добавить в календарь</button>
              {selectedPlan.status === "done" && <button type="button" onClick={() => openMemoryComposer(selectedPlan)}><Sparkles />Сделать воспоминанием</button>}
              {selectedPlan.created_by === currentUserId && <button type="button" className="is-danger" onClick={() => void deletePlan(selectedPlan)}><Trash2 />Удалить</button>}
            </div>
            <section className="tracker-lab-comments">
              <div className="tracker-lab-section-heading"><div><span>Вместе</span><h3>Обсуждение</h3></div><MessageCircle /></div>
              <div className="tracker-lab-comment-list">
                {selectedComments.map((comment) => {
                  const person = getPersonMeta(comment.user_id);
                  return (
                    <article key={comment.id}>
                      <span className="tracker-lab-avatar">{person.avatar ? <Image src={person.avatar} alt="" width={32} height={32} unoptimized /> : person.initial}</span>
                      <div><strong>{person.name}</strong>{comment.text && <p>{comment.text}</p>}
                        {comment.attachment_signed_url && comment.attachment_type === "image" && <Image src={comment.attachment_signed_url} alt={comment.attachment_name || "Фото"} width={620} height={420} unoptimized />}
                        {comment.attachment_signed_url && comment.attachment_type === "video" && <video src={comment.attachment_signed_url} controls playsInline />}
                        {comment.attachment_signed_url && comment.attachment_type === "audio" && <AccentAudioPlayer src={comment.attachment_signed_url} accent="#d97706" label={comment.attachment_name || "Голосовая запись"} />}
                        {comment.attachment_signed_url && comment.attachment_type === "file" && <a href={comment.attachment_signed_url} target="_blank" rel="noreferrer"><FileText />{comment.attachment_name || "Файл"}</a>}
                      </div>
                    </article>
                  );
                })}
              </div>
              {selectedPlan.visibility === "couple" && (
                <div className="tracker-lab-comment-composer">
                  <input ref={fileInputRef} type="file" className="sr-only" onChange={(event) => { selectCommentFile(Array.from(event.target.files || [])); event.target.value = ""; }} />
                  <textarea value={commentText} onChange={(event) => setCommentText(event.target.value)} onPaste={handleCommentPaste} placeholder="Напишите или вставьте файл через Ctrl+V…" rows={2} />
                  {commentFile && <span className="tracker-lab-pending-file"><Paperclip />{commentFile.name}<button type="button" onClick={() => setCommentFile(null)}><X /></button></span>}
                  <div>
                    <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Прикрепить файл"><Paperclip /></button>
                    <button type="button" className={isRecording ? "is-recording" : ""} onClick={() => void toggleRecording()} aria-label={isRecording ? "Остановить запись" : "Записать голос"}>{isRecording ? <Square /> : <Mic />}</button>
                    <button type="button" className="is-send" onClick={() => void addComment()} disabled={isSaving || (!commentText.trim() && !commentFile)}><ChevronRight /></button>
                  </div>
                </div>
              )}
            </section>
          </aside>
        </div>
      )}

      {composerMode && (
        <div className="tracker-lab-overlay" onMouseDown={(event) => { if (event.currentTarget === event.target) setComposerMode(null); }}>
          <section className="tracker-lab-composer-sheet" aria-label="Добавить в трекер">
            <div className="tracker-lab-sheet-handle" />
            <button type="button" className="tracker-lab-sheet-close" onClick={() => setComposerMode(null)} aria-label="Закрыть"><X /></button>
            {composerMode === "menu" && (
              <>
                <p>Добавить</p><h2>Что происходит?</h2>
                <div className="tracker-lab-create-menu">
                  <button type="button" onClick={() => setComposerMode("plan")}><CalendarDays /><span><strong>Событие или план</strong><small>Свидание, задача, дата</small></span><ChevronRight /></button>
                  <button type="button" onClick={() => setComposerMode("activity")}><Activity /><span><strong>Быстрая отметка</strong><small>Еда, спорт, игры и другое</small></span><ChevronRight /></button>
                  <button type="button" onClick={() => setComposerMode("checkin")}><Sparkles /><span><strong>Состояние дня</strong><small>Настроение и энергия</small></span><ChevronRight /></button>
                  <button type="button" onClick={() => setComposerMode("goal")}><Target /><span><strong>Новая цель</strong><small>Общий ориентир пары</small></span><ChevronRight /></button>
                </div>
              </>
            )}
            {composerMode === "plan" && (
              <>
                <p>Новый план</p><h2>Добавить в календарь</h2>
                <div className="tracker-lab-form-grid">
                  <label className="is-wide"><span>Название</span><input value={planTitle} onChange={(event) => setPlanTitle(event.target.value)} placeholder="Например, вечерняя прогулка" autoFocus /></label>
                  <label><span>Тип</span><select value={planKind} onChange={(event) => setPlanKind(event.target.value as TrackerPlanKind)}>{Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <label><span>Дата</span><input type="date" value={planDate} onChange={(event) => setPlanDate(event.target.value)} /></label>
                  <label><span>Начало</span><input type="time" value={planTime} onChange={(event) => setPlanTime(event.target.value)} /></label>
                  <label><span>Конец</span><input type="time" value={planEndTime} onChange={(event) => setPlanEndTime(event.target.value)} disabled={!planTime} /></label>
                  <label><span>Для кого</span><select value={planScope} onChange={(event) => setPlanScope(event.target.value as TrackerParticipantScope)} disabled={planVisibility === "private"}><option value="both">Для нас двоих</option><option value="me">Для меня</option><option value="partner">Для партнёра</option></select></label>
                  <label><span>Видимость</span><select value={planVisibility} onChange={(event) => setPlanVisibility(event.target.value as "couple" | "private")}><option value="couple">Общее</option><option value="private">Только мне</option></select></label>
                  <label><span>Повторение</span><select value={planRepeat} onChange={(event) => setPlanRepeat(event.target.value as TrackerPlanRepeat)}>{Object.entries(repeatLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  {planRepeat !== "none" && <label><span>Повторять до</span><input type="date" value={planRepeatUntil} min={planDate} onChange={(event) => setPlanRepeatUntil(event.target.value)} /></label>}
                  <label><span>Напомнить</span><select value={planReminder} onChange={(event) => setPlanReminder(Number(event.target.value))}><option value={0}>В момент события</option><option value={30}>За 30 минут</option><option value={60}>За час</option><option value={1440}>За день</option><option value={10080}>За неделю</option></select></label>
                  <label className="is-wide"><span>Описание</span><textarea value={planDescription} onChange={(event) => setPlanDescription(event.target.value)} placeholder="Детали, адрес или небольшая заметка" rows={3} /></label>
                </div>
                <button type="button" className="tracker-lab-primary-button" disabled={isSaving || !planTitle.trim()} onClick={() => void savePlan()}>{isSaving ? "Сохраняем…" : "Добавить в календарь"}</button>
              </>
            )}
            {composerMode === "checkin" && (
              <>
                <p>Check-in</p><h2>Как проходит день?</h2>
                <div className="tracker-lab-mood-picker">
                  {moods.map((mood) => <button type="button" key={mood.key} className={checkinMood === mood.key ? "is-active" : ""} onClick={() => setCheckinMood(mood.key)}><FluentEmoji emoji={mood.emoji} size={34} decorative /><span>{mood.label}</span></button>)}
                </div>
                <label className="tracker-lab-range-label"><span>Энергия <strong>{checkinEnergy}/5</strong></span><input type="range" min={1} max={5} value={checkinEnergy} onChange={(event) => setCheckinEnergy(Number(event.target.value))} /></label>
                <label className="tracker-lab-range-label"><span>Близость <strong>{checkinRelationship}/5</strong></span><input type="range" min={1} max={5} value={checkinRelationship} onChange={(event) => setCheckinRelationship(Number(event.target.value))} /></label>
                <textarea className="tracker-lab-big-input" value={checkinNote} onChange={(event) => setCheckinNote(event.target.value)} placeholder="Личная заметка о дне" rows={3} />
                <div className="tracker-lab-privacy-options">
                  {(["private","summary","full"] as const).map((visibility) => <button type="button" key={visibility} className={checkinVisibility === visibility ? "is-active" : ""} onClick={() => setCheckinVisibility(visibility)}>{visibility === "private" ? <EyeOff /> : visibility === "summary" ? <Eye /> : <UsersRound />}<span>{visibility === "private" ? "Только мне" : visibility === "summary" ? "Показать статус" : "Показать всё"}</span></button>)}
                </div>
                <label className="tracker-lab-switch"><input type="checkbox" checked={checkinReveal} onChange={(event) => setCheckinReveal(event.target.checked)} /><span /><div><strong>Открыть после ответа обоих</strong><small>Без давления и сравнений</small></div></label>
                <button type="button" className="tracker-lab-primary-button" disabled={isSaving} onClick={() => void saveCheckin()}>Сохранить состояние</button>
              </>
            )}
            {composerMode === "goal" && (
              <>
                <p>Общая цель</p><h2>К чему стремимся?</h2>
                <div className="tracker-lab-form-grid">
                  <label className="is-wide"><span>Категория</span><select value={goalCategoryId} onChange={(event) => setGoalCategoryId(event.target.value)}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                  <label><span>Период</span><select value={goalPeriod} onChange={(event) => setGoalPeriod(event.target.value as TrackerGoal["period"])}><option value="day">День</option><option value="week">Неделя</option><option value="month">Месяц</option><option value="year">Год</option></select></label>
                  <label><span>Количество</span><input type="number" min={1} max={999} value={goalTarget} onChange={(event) => setGoalTarget(Number(event.target.value))} /></label>
                </div>
                <button type="button" className="tracker-lab-primary-button" disabled={isSaving} onClick={() => void createGoal()}>Создать цель</button>
              </>
            )}
            {composerMode === "activity" && (
              <><p>Быстрая отметка</p><h2>{formatTrackerDate(selectedDate)}</h2>{renderActivityCounters()}</>
            )}
          </section>
        </div>
      )}

      {isFreeTimeOpen && (
        <div className="tracker-lab-overlay" onMouseDown={(event) => { if (event.currentTarget === event.target) setIsFreeTimeOpen(false); }}>
          <section className="tracker-lab-composer-sheet">
            <button type="button" className="tracker-lab-sheet-close" onClick={() => setIsFreeTimeOpen(false)} aria-label="Закрыть"><X /></button>
            <p>Наше свободное время</p><h2>{formatTrackerDate(selectedDate)}</h2>
            <span className="tracker-lab-privacy-note"><Lock />Приватные планы учитываются как занятость, но их содержание не раскрывается.</span>
            <div className="tracker-lab-free-slots">
              {freeSlots.length ? freeSlots.slice(0, 12).map((slot) => (
                <button type="button" key={slot.starts_at} onClick={() => {
                  setPlanDate(selectedDate);
                  setPlanTime(new Date(slot.starts_at).toTimeString().slice(0, 5));
                  setPlanEndTime(new Date(slot.ends_at).toTimeString().slice(0, 5));
                  setIsFreeTimeOpen(false);
                  setComposerMode("plan");
                }}>
                  <Clock3 /><strong>{formatClock(slot.starts_at)}–{formatClock(slot.ends_at)}</strong><span>Запланировать</span>
                </button>
              )) : <div className="tracker-lab-empty"><Clock3 /><strong>Свободных часовых окон не найдено</strong><span>Попробуйте другой день.</span></div>}
            </div>
          </section>
        </div>
      )}

      {memoryPlan && (
        <div className="tracker-lab-overlay" onMouseDown={(event) => { if (event.currentTarget === event.target) setMemoryPlan(null); }}>
          <section className="tracker-lab-composer-sheet">
            <button type="button" className="tracker-lab-sheet-close" onClick={() => setMemoryPlan(null)} aria-label="Закрыть"><X /></button>
            <p>Из плана в историю</p><h2>Сохранить воспоминание</h2>
            <span className="tracker-lab-privacy-note"><Sparkles />Фото, файлы и голосовые из обсуждения будут скопированы в воспоминание.</span>
            <div className="tracker-lab-form-grid">
              <label className="is-wide"><span>Название</span><input value={memoryTitle} onChange={(event) => setMemoryTitle(event.target.value)} /></label>
              <label className="is-wide"><span>Описание</span><textarea rows={4} value={memoryCaption} onChange={(event) => setMemoryCaption(event.target.value)} /></label>
            </div>
            <button type="button" className="tracker-lab-primary-button" onClick={() => void createMemoryFromPlan()} disabled={isSaving}>{isSaving ? "Переносим материалы…" : "Создать воспоминание"}</button>
          </section>
        </div>
      )}
    </main>
  );
}
