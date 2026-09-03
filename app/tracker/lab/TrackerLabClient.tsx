"use client";

import { FluentEmoji } from "@/components/FluentEmoji";
import { getSafeStoragePath } from "@/lib/mediaFiles";
import { encodeMemoryMedia, type MemoryAttachment } from "@/lib/memoryMedia";
import { createPartnerNotification } from "@/lib/notifications";
import { supabase } from "@/lib/supabaseClient";
import {
  adjustTrackerEventCount,
  saveTrackerCheckin,
  synchronizeTrackerParticipants,
  type TrackerLabSnapshot,
} from "@/lib/trackerRepository";
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
  Gamepad2,
  Heart,
  LayoutDashboard,
  ListFilter,
  Lock,
  Minus,
  Palette,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
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
  formatTrackerClock,
  getTrackerToday,
  trackerDateTimeToIso,
  shiftTrackerViewDate,
  getPlanBaseDate,
  getTrackerViewRange,
  getWeekStrip,
  parseTrackerDateKey,
  toTrackerDateKey,
  type TrackerOccurrence,
  type TrackerOccurrenceOverride,
  type TrackerParticipantScope,
  type TrackerPlan,
  type TrackerPlanKind,
  type TrackerPlanRepeat,
} from "@/lib/trackerPlanDomain";
import { useTrackerData } from "../useTrackerData";
import TrackerLabDialog from "./TrackerLabDialog";
import TrackerLabDiscussion, { type TrackerComment } from "./TrackerLabDiscussion";
import TrackerLabFreeTimeDialog from "./TrackerLabFreeTimeDialog";
import TrackerLabPlanComposer, { type TrackerPlanDraft } from "./TrackerLabPlanComposer";

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

type TrackerParticipant = {
  id: string;
  plan_id: string;
  couple_id: string;
  user_id: string;
  role: "participant" | "responsible";
  response: "pending" | "accepted" | "declined";
  created_at: string;
};

type TrackerReminder = { id: string; plan_id: string; user_id: string; offset_minutes: number; delivery: string };

type LocalTab = "today" | "calendar" | "activity";
type CalendarMode = "day" | "week" | "month" | "year";
type ScopeFilter = "all" | "me" | "partner" | "both";
type ComposerMode = "menu" | "plan" | "occurrence" | "checkin" | "goal" | "activity";
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

export default function TrackerLabClient({ initialDate, initialNow }: { initialDate: string | null; initialNow: string }) {
  const router = useRouter();
  const agendaRef = useRef<HTMLDivElement | null>(null);
  const pendingMutations = useRef(new Set<string>());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [categories, setCategories] = useState<TrackerCategory[]>([]);
  const [events, setEvents] = useState<TrackerEvent[]>([]);
  const [goals, setGoals] = useState<TrackerGoal[]>([]);
  const [plans, setPlans] = useState<TrackerPlan[]>([]);
  const [participants, setParticipants] = useState<TrackerParticipant[]>([]);
  const [occurrenceOverrides, setOccurrenceOverrides] = useState<TrackerOccurrenceOverride[]>([]);
  const [checkins, setCheckins] = useState<TrackerCheckin[]>([]);
  const [comments, setComments] = useState<TrackerComment[]>([]);
  const [reminders, setReminders] = useState<TrackerReminder[]>([]);
  const [activeTab, setActiveTab] = useState<LocalTab>("today");
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("month");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const timeZone = profile?.time_zone || "Europe/Moscow";
  const [chosenDate, setChosenDate] = useState<string | null>(initialDate);
  const selectedDate = chosenDate || getTrackerToday(timeZone, new Date(initialNow));
  const setSelectedDate = useCallback((next: string | ((current: string) => string)) => {
    setChosenDate((current) => typeof next === "function"
      ? next(current || getTrackerToday(timeZone, new Date(initialNow)))
      : next);
  }, [initialNow, timeZone]);
  const formatClock = (value: string | null) => value ? formatTrackerClock(value, timeZone) : "Весь день";
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedOccurrenceDate, setSelectedOccurrenceDate] = useState<string | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [composerMode, setComposerMode] = useState<ComposerMode | null>(null);
  const [isSaving, setIsSaving] = useState(false);
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
  const [planRepeatInterval, setPlanRepeatInterval] = useState(1);
  const [planRepeatWeekdays, setPlanRepeatWeekdays] = useState<number[]>([]);
  const [planStatus, setPlanStatus] = useState<TrackerPlan["status"]>("planned");
  const [planEditScope, setPlanEditScope] = useState<TrackerPlan["edit_scope"]>("participants");
  const [planAssigneeId, setPlanAssigneeId] = useState("");
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

  const [isFreeTimeOpen, setIsFreeTimeOpen] = useState(false);

  const [memoryPlan, setMemoryPlan] = useState<TrackerPlan | null>(null);
  const [memoryTitle, setMemoryTitle] = useState("");
  const [memoryDate, setMemoryDate] = useState(selectedDate);
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

  const applyTrackerSnapshot = useCallback((snapshot: TrackerLabSnapshot) => {
    const rawCategories = snapshot.categories as TrackerCategory[];
    const preferences = snapshot.preferences as TrackerCategoryPreference[];
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

    setCategories(mergedCategories);
    setCategoryDrafts(Object.fromEntries(mergedCategories.map((item) => [item.id, item.name])));
    setEvents(snapshot.events as TrackerEvent[]);
    setGoals(snapshot.goals as TrackerGoal[]);
    setPlans(snapshot.plans as TrackerPlan[]);
    setParticipants(snapshot.participants as TrackerParticipant[]);
    setOccurrenceOverrides(snapshot.occurrenceOverrides as TrackerOccurrenceOverride[]);
    setCheckins(snapshot.checkins as TrackerCheckin[]);
    setProfile(snapshot.profile as Profile | null);
    setComments(snapshot.comments as TrackerComment[]);
    setReminders(snapshot.reminders as TrackerReminder[]);
    setGoalCategoryId((current) => current || mergedCategories[0]?.id || "");
  }, []);

  const {
    isLoading,
    error: trackerLoadError,
    reload: reloadTrackerData,
  } = useTrackerData({
    coupleId: couple?.id || null,
    year: selectedYear,
    onData: applyTrackerSnapshot,
  });

  const visibleMessage = trackerLoadError
    ? `Не всё удалось загрузить: ${trackerLoadError}`
    : message;

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
    if (!agendaRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cards = agendaRef.current.querySelectorAll("[data-plan-card]");
    if (!cards.length) return;
    const animation = animate(cards, {
      opacity: [0, 1],
      translateY: [12, 0],
      duration: 420,
      delay: (_element: unknown, index: number) => index * 45,
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
      if (document.querySelector('[role="dialog"]') || target?.matches("input,textarea,select,[contenteditable='true']")) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key.toLowerCase() === "t") setSelectedDate(getTrackerToday(timeZone));
      if (event.key.toLowerCase() === "n") setComposerMode("menu");
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
  }, [selectedDate, setSelectedDate, timeZone]);



  const viewRange = useMemo(
    () => getTrackerViewRange(selectedDate, calendarMode),
    [calendarMode, selectedDate],
  );
  const occurrences = useMemo(
    () => expandTrackerPlanOccurrences(
      plans, `${selectedYear}-01-01`, `${selectedYear}-12-31`, timeZone, occurrenceOverrides,
    ),
    [occurrenceOverrides, plans, selectedYear, timeZone],
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
  const selectedOccurrence = occurrences.find((item) =>
    item.plan.id === selectedPlanId && item.originalDateKey === selectedOccurrenceDate,
  ) || null;
  const selectedStatus = selectedOccurrence?.status || selectedPlan?.status;
  const selectedReminder = reminders.find((item) => item.plan_id === selectedPlanId && item.user_id === currentUserId);
  const selectedParticipant = participants.find((item) =>
    item.plan_id === selectedPlanId && item.user_id === currentUserId,
  ) || null;
  const canEditSelectedPlan = Boolean(
    selectedPlan && currentUserId && (
      selectedPlan.created_by === currentUserId ||
      (selectedPlan.edit_scope === "participants" && selectedParticipant?.response === "accepted")
    ),
  );
  const selectedComments = comments.filter((item) => item.plan_id === selectedPlanId);
  const week = useMemo(() => getWeekStrip(selectedDate, timeZone), [selectedDate, timeZone]);
  const cells = useMemo(() => monthCells(selectedDate), [selectedDate]);
  const activeEvents = events.filter((event) => event.count > 0);
  const selectedDayEvents = activeEvents.filter((event) => event.date === selectedDate);
  const nextOccurrence = useMemo(() => {
    const nowKey = getTrackerToday(timeZone);
    const now = Date.now();
    return filteredOccurrences.find((item) => item.dateKey >= nowKey && item.status !== "done" &&
      (!item.startsAt || Date.parse(item.endsAt || item.startsAt) >= now)) || null;
  }, [filteredOccurrences, timeZone]);
  const selectedDateCheckins = checkins.filter((item) => item.date === selectedDate);
  for (const userId of [currentUserId, partnerId]) {
    if (!userId || selectedDateCheckins.some((item) => item.user_id === userId)) continue;
    const legacy = events.filter((event) => event.date === selectedDate && event.created_by === userId &&
      event.note?.startsWith("[[day-mood]]")).sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
    if (legacy) selectedDateCheckins.push({
      id: legacy.id, couple_id: legacy.couple_id, user_id: userId, date: legacy.date,
      mood: legacy.mood, energy: null, relationship: null, visibility: "summary", note: null,
      reveal_after_both: false, is_own: userId === currentUserId, created_at: legacy.created_at, updated_at: legacy.updated_at,
    });
  }

  const periodEvents = activeEvents.filter((event) => event.date >= viewRange.from && event.date <= viewRange.to);
  const stats = {
    marks: periodEvents.reduce((sum, event) => sum + event.count, 0),
    days: new Set(periodEvents.map((event) => event.date)).size,
    together: filteredOccurrences.filter((item) => item.dateKey >= viewRange.from && item.dateKey <= viewRange.to && item.plan.participant_scope === "both").length,
    done: filteredOccurrences.filter((item) => item.dateKey >= viewRange.from && item.dateKey <= viewRange.to && item.status === "done").length,
  };

  function openComposer(mode: ComposerMode) {
    setPlanDate(selectedDate);
    if (mode === "plan") resetPlanComposer();
    if (mode === "checkin") {
      const own = checkins.find((item) => item.date === selectedDate && item.is_own);
      setCheckinMood(own?.mood || selectedDateCheckins.find((item) => item.is_own)?.mood || "good");
      setCheckinEnergy(own?.energy ?? 3);
      setCheckinRelationship(own?.relationship ?? 3);
      setCheckinVisibility(own?.visibility || "private");
      setCheckinNote(own?.note || "");
      setCheckinReveal(own?.reveal_after_both || false);
    }
    setComposerMode(mode);
  }

  function resetPlanComposer() {
    setPlanTitle("");
    setPlanDescription("");
    setPlanTime("");
    setPlanEndTime("");
    setPlanRepeat("none");
    setPlanRepeatUntil("");
    setPlanRepeatInterval(1);
    setPlanRepeatWeekdays([parseTrackerDateKey(selectedDate).getDay() || 7]);
    setPlanStatus("planned");
    setPlanEditScope("participants");
    setPlanAssigneeId("");
    setPlanKind("event");
    setPlanScope("both");
    setPlanVisibility("couple");
    setPlanReminder(60);
    setEditingPlanId(null);
  }

  function openPlanEditor(plan: TrackerPlan) {
    const dateKey = getPlanBaseDate(plan, timeZone);
    setEditingPlanId(plan.id);
    setPlanTitle(plan.title);
    setPlanDescription(plan.description || "");
    setPlanKind(plan.kind);
    setPlanDate(dateKey);
    setPlanTime(plan.starts_at ? formatTrackerClock(plan.starts_at, timeZone) : "");
    setPlanEndTime(plan.ends_at ? formatTrackerClock(plan.ends_at, timeZone) : "");
    setPlanScope(plan.participant_scope);
    setPlanVisibility(plan.visibility);
    setPlanRepeat(plan.repeat_mode);
    setPlanRepeatUntil(plan.repeat_until || "");
    setPlanRepeatInterval(plan.repeat_interval);
    setPlanRepeatWeekdays(plan.repeat_weekdays.length ? plan.repeat_weekdays : [parseTrackerDateKey(dateKey).getDay() || 7]);
    setPlanStatus(plan.status);
    setPlanEditScope(plan.edit_scope);
    setPlanAssigneeId(plan.assignee_id || "");
    setPlanReminder(reminders.find((item) => item.plan_id === plan.id && item.user_id === currentUserId)?.offset_minutes ?? 60);
    setSelectedPlanId(null);
    setComposerMode("plan");
  }

  function openOccurrenceEditor(plan: TrackerPlan) {
    const occurrence = selectedOccurrence;
    setPlanDate(occurrence?.dateKey || getPlanBaseDate(plan, timeZone));
    setPlanTime(occurrence?.startsAt ? formatTrackerClock(occurrence.startsAt, timeZone) : "");
    setPlanEndTime(occurrence?.endsAt ? formatTrackerClock(occurrence.endsAt, timeZone) : "");
    setComposerMode("occurrence");
  }

  async function runGuardedMutation(key: string, action: () => Promise<void>) {
    if (pendingMutations.current.has(key)) return;
    pendingMutations.current.add(key);
    try {
      await action();
    } catch {
      setMessage("Не удалось завершить сохранение. Проверьте соединение и повторите.");
      reloadTrackerData();
    } finally {
      pendingMutations.current.delete(key);
      setIsSaving(false);
    }
  }

  async function adjustCategory(category: TrackerCategory, delta: 1 | -1) {
    await runGuardedMutation(`counter:${selectedDate}:${category.id}`, () => performAdjustCategory(category, delta));
  }

  async function performAdjustCategory(category: TrackerCategory, delta: 1 | -1) {
    if (!couple || isSaving) return;
    setIsSaving(true);
    const previous = events;
    const own = events.find((event) =>
      event.date === selectedDate &&
      event.category_id === category.id &&
      event.created_by === currentUserId &&
      event.count > 0,
    );
    if (own) {
      const nextCount = own.count + delta;
      setEvents((items) => nextCount <= 0
        ? items.filter((item) => item.id !== own.id)
        : items.map((item) => item.id === own.id ? { ...item, count: nextCount } : item));
    }
    try {
      const { error } = await adjustTrackerEventCount({
        coupleId: couple.id,
        categoryId: category.id,
        date: selectedDate,
        delta,
      });
      if (error) throw error;
      reloadTrackerData();
    } catch (error) {
      setEvents(previous);
      setMessage(`Не удалось изменить отметку: ${getErrorMessage(error, "повторите ещё раз")}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function saveCheckin() {
    await runGuardedMutation(`checkin:${selectedDate}`, () => performSaveCheckin());
  }

  async function performSaveCheckin() {
    if (!couple) return;
    setIsSaving(true);
    const { error } = await saveTrackerCheckin({
      coupleId: couple.id,
      date: selectedDate,
      mood: checkinMood,
      energy: checkinEnergy,
      relationship: checkinRelationship,
      visibility: checkinVisibility,
      note: checkinNote.trim() || null,
      revealAfterBoth: checkinReveal,
    });
    if (error) setMessage(`Не удалось сохранить check-in: ${error.message}`);
    else {
      setMessage("Состояние дня сохранено");
      setComposerMode(null);
      reloadTrackerData();
    }
    setIsSaving(false);
  }

  function changePlanDraft(patch: Partial<TrackerPlanDraft>) {
    if (patch.title !== undefined) setPlanTitle(patch.title);
    if (patch.description !== undefined) setPlanDescription(patch.description);
    if (patch.kind !== undefined) setPlanKind(patch.kind);
    if (patch.date !== undefined) setPlanDate(patch.date);
    if (patch.time !== undefined) setPlanTime(patch.time);
    if (patch.endTime !== undefined) setPlanEndTime(patch.endTime);
    if (patch.scope !== undefined) setPlanScope(patch.scope);
    if (patch.visibility !== undefined) setPlanVisibility(patch.visibility);
    if (patch.repeat !== undefined) setPlanRepeat(patch.repeat);
    if (patch.repeatInterval !== undefined) setPlanRepeatInterval(patch.repeatInterval);
    if (patch.repeatWeekdays !== undefined) setPlanRepeatWeekdays(patch.repeatWeekdays);
    if (patch.repeatUntil !== undefined) setPlanRepeatUntil(patch.repeatUntil);
    if (patch.reminder !== undefined) setPlanReminder(patch.reminder);
    if (patch.status !== undefined) setPlanStatus(patch.status);
    if (patch.editScope !== undefined) setPlanEditScope(patch.editScope);
    if (patch.assigneeId !== undefined) setPlanAssigneeId(patch.assigneeId);
  }

  async function savePlan() {
    await runGuardedMutation("save-plan", () => performSavePlan());
  }

  async function performSavePlan() {
    if (!couple || !currentUserId || !planTitle.trim() || !planDate || isSaving) return;
    setIsSaving(true);
    const allDay = !planTime;
    let startsAt: string | null = null;
    let endsAt: string | null = null;
    try {
      startsAt = allDay ? null : trackerDateTimeToIso(planDate, planTime, timeZone);
      endsAt = startsAt
        ? planEndTime ? trackerDateTimeToIso(planDate, planEndTime, timeZone) : new Date(Date.parse(startsAt) + 3_600_000).toISOString()
        : null;
    } catch {
      setMessage("Проверьте дату и время: в часовом поясе пары это время недоступно.");
      setIsSaving(false);
      return;
    }
    if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) {
      setMessage("Время окончания должно быть позже начала.");
      setIsSaving(false);
      return;
    }

    if (editingPlanId) {
      const existing = plans.find((item) => item.id === editingPlanId);
      if (!existing) {
        setMessage("План уже недоступен.");
        setIsSaving(false);
        return;
      }
      const patch: Partial<TrackerPlan> = {
        title: planTitle.trim(),
        description: planDescription.trim() || null,
        kind: planKind,
        start_date: allDay ? planDate : null,
        starts_at: startsAt,
        ends_at: endsAt,
        all_day: allDay,
        ...(existing.created_by === currentUserId ? {
          participant_scope: planVisibility === "private" ? "me" as const : planScope,
          assignee_id: planVisibility === "private" ? currentUserId : planAssigneeId || null,
          visibility: planVisibility,
          edit_scope: planEditScope,
        } : {}),
        status: planStatus,
        repeat_mode: planRepeat,
        repeat_interval: planRepeatInterval,
        repeat_weekdays: planRepeat === "weekly" ? planRepeatWeekdays : [],
        repeat_until: planRepeat === "none" ? null : planRepeatUntil || null,
        updated_by: currentUserId,
        updated_at: new Date().toISOString(),
      };
      const previous = plans;
      setPlans((items) => items.map((item) => item.id === editingPlanId ? { ...item, ...patch } : item));
      const { error } = await supabase.from("tracker_plans").update(patch).eq("id", editingPlanId);
      if (error) {
        setPlans(previous);
        setMessage(`Не удалось изменить серию: ${error.message}`);
      } else {
        try {
          await synchronizeTrackerParticipants({ ...existing, ...patch }, currentUserId, partnerId);
        } catch {
          setMessage("План сохранён, но состав участников обновился не полностью. Повторите сохранение — уже принятые приглашения сохранятся.");
          reloadTrackerData();
          setIsSaving(false);
          return;
        }
        void Promise.resolve(supabase.from("tracker_plan_activity").insert({
          plan_id: editingPlanId,
          couple_id: couple.id,
          actor_id: currentUserId,
          activity_type: "updated",
        })).catch(() => undefined);
        if (existing.visibility === "couple" && planVisibility === "couple") {
          await createPartnerNotification(couple, currentUserId, {
            type: "tracker_plan_updated",
            title: "Совместный план изменён",
            body: planTitle.trim(),
            href: "/tracker/lab",
          }).catch(() => undefined);
        }
        await savePersonalReminder(existing, planReminder);
        resetPlanComposer();
        setComposerMode(null);
        setSelectedPlanId(existing.id);
        reloadTrackerData();
      }
      setIsSaving(false);
      return;
    }

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
      assignee_id: planVisibility === "private" ? currentUserId : planAssigneeId || null,
      visibility: planVisibility,
      status: planStatus,
      repeat_mode: planRepeat,
      repeat_interval: planRepeatInterval,
      repeat_weekdays: planRepeat === "weekly" ? planRepeatWeekdays : [],
      repeat_until: planRepeat === "none" ? null : planRepeatUntil || null,
      category_id: null,
      color: null,
      edit_scope: planEditScope,
      created_by: currentUserId,
      updated_by: currentUserId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setPlans((items) => [optimistic, ...items]);
    let createdPlanId: string | null = null;

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
      createdPlanId = data.id;

      await synchronizeTrackerParticipants(data, currentUserId, partnerId);
      const { error: reminderError } = await supabase.from("tracker_plan_reminders").insert({
        plan_id: data.id,
        couple_id: couple.id,
        user_id: currentUserId,
        offset_minutes: planReminder,
        delivery: "ics",
      });
      if (reminderError) throw reminderError;
      void Promise.resolve(supabase.from("tracker_plan_activity").insert({
        plan_id: data.id,
        couple_id: couple.id,
        actor_id: currentUserId,
        activity_type: "created",
      })).catch(() => undefined);

      setPlans((items) => items.map((item) => item.id === optimistic.id ? data : item));
      resetPlanComposer();
      setComposerMode(null);
      setSelectedPlanId(data.id);
      if (data.visibility === "couple") {
        await createPartnerNotification(couple, currentUserId, {
          type: "tracker_plan_created",
          title: "Новый совместный план",
          body: data.title,
          href: "/tracker/lab",
        }).catch(() => undefined);
      }
    } catch (error) {
      if (createdPlanId) {
        const { error: rollbackError } = await supabase.from("tracker_plans").delete().eq("id", createdPlanId).eq("created_by", currentUserId);
        if (rollbackError) {
          setMessage("План создан, но не все настройки сохранились. Обновите трекер и откройте план для проверки.");
          reloadTrackerData();
          return;
        }
      }
      setPlans((items) => items.filter((item) => item.id !== optimistic.id));
      setMessage(`Не удалось создать событие: ${getErrorMessage(error, "попробуйте снова")}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function saveOccurrenceOverride() {
    await runGuardedMutation("save-occurrence", () => performSaveOccurrenceOverride());
  }

  async function performSaveOccurrenceOverride() {
    if (!couple || !currentUserId || !selectedPlan || !selectedOccurrenceDate) return;
    setIsSaving(true);
    const occurrenceDate = selectedOccurrenceDate;
    const allDay = selectedPlan.all_day || !planTime;
    let overrideStartsAt: string | null = null;
    let overrideEndsAt: string | null = null;
    try {
      overrideStartsAt = allDay ? null : trackerDateTimeToIso(planDate, planTime, timeZone);
      overrideEndsAt = overrideStartsAt
        ? planEndTime ? trackerDateTimeToIso(planDate, planEndTime, timeZone) : new Date(Date.parse(overrideStartsAt) + 3_600_000).toISOString()
        : null;
    } catch {
      setMessage("Проверьте дату и время в часовом поясе пары.");
      setIsSaving(false);
      return;
    }
    if (overrideStartsAt && overrideEndsAt && Date.parse(overrideEndsAt) <= Date.parse(overrideStartsAt)) {
      setMessage("Время окончания должно быть позже начала.");
      setIsSaving(false);
      return;
    }
    const { error } = await supabase.from("tracker_plan_occurrence_overrides").upsert({
      plan_id: selectedPlan.id,
      couple_id: couple.id,
      occurrence_date: occurrenceDate,
      override_start_date: planDate,
      override_starts_at: overrideStartsAt,
      override_ends_at: overrideEndsAt,
      status: "planned",
      updated_by: currentUserId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "plan_id,occurrence_date" });
    if (error) setMessage(`Не удалось перенести событие: ${error.message}`);
    else {
      void Promise.resolve(supabase.from("tracker_plan_activity").insert({
        plan_id: selectedPlan.id,
        couple_id: couple.id,
        actor_id: currentUserId,
        activity_type: "occurrence_updated",
      })).catch(() => undefined);
      setComposerMode(null);
      setSelectedPlanId(null);
      setSelectedOccurrenceDate(null);
      reloadTrackerData();
    }
    setIsSaving(false);
  }

  async function cancelOccurrence(plan: TrackerPlan) {
    if (!couple || !currentUserId || !selectedOccurrenceDate) return;
    if (!window.confirm("Отменить только это повторение? Остальная серия сохранится.")) return;
    const occurrenceDate = selectedOccurrenceDate;
    const { error } = await supabase.from("tracker_plan_occurrence_overrides").upsert({
      plan_id: plan.id,
      couple_id: couple.id,
      occurrence_date: occurrenceDate,
      status: "cancelled",
      updated_by: currentUserId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "plan_id,occurrence_date" });
    if (error) setMessage(`Не удалось отменить повторение: ${error.message}`);
    else {
      setSelectedPlanId(null);
      setSelectedOccurrenceDate(null);
      reloadTrackerData();
    }
  }

  async function respondToPlan(response: "accepted" | "declined") {
    if (!selectedParticipant || !currentUserId) return;
    const previous = participants;
    setParticipants((items) => items.map((item) =>
      item.id === selectedParticipant.id ? { ...item, response } : item,
    ));
    const { error } = await supabase.from("tracker_plan_participants")
      .update({ response })
      .eq("id", selectedParticipant.id)
      .eq("user_id", currentUserId);
    if (error) {
      setParticipants(previous);
      setMessage(`Не удалось сохранить ответ: ${error.message}`);
    } else {
      setMessage(response === "accepted" ? "План принят" : "План отклонён");
      if (selectedPlan && couple) {
        void Promise.resolve(supabase.from("tracker_plan_activity").insert({
          plan_id: selectedPlan.id,
          couple_id: couple.id,
          actor_id: currentUserId,
          activity_type: "responded",
          metadata: { response },
        })).catch(() => undefined);
        await createPartnerNotification(couple, currentUserId, {
          type: "tracker_plan_response",
          title: response === "accepted" ? "План принят" : "План отклонён",
          body: selectedPlan.title,
          href: "/tracker/lab",
        }).catch(() => undefined);
      }
    }
  }

  async function completeOccurrence(occurrence: TrackerOccurrence) {
    if (!currentUserId) return;
    const plan = occurrence.plan;
    const mutationKey = `complete:${plan.id}:${occurrence.originalDateKey}`;
    if (pendingMutations.current.has(mutationKey)) return;
    pendingMutations.current.add(mutationKey);
    try {
      if (plan.repeat_mode === "none") {
        await updatePlanStatus(plan, "done");
        return;
      }
      const previous = occurrenceOverrides;
      const existing = previous.find((item) =>
        item.plan_id === plan.id && item.occurrence_date === occurrence.originalDateKey);
      const optimistic: TrackerOccurrenceOverride = {
        id: existing?.id || crypto.randomUUID(),
        plan_id: plan.id,
        couple_id: plan.couple_id,
        occurrence_date: occurrence.originalDateKey,
        override_start_date: existing?.override_start_date || null,
        override_starts_at: existing?.override_starts_at || null,
        override_ends_at: existing?.override_ends_at || null,
        status: "done",
        updated_by: currentUserId,
        updated_at: new Date().toISOString(),
      };
      setOccurrenceOverrides((items) => [...items.filter((item) =>
        !(item.plan_id === plan.id && item.occurrence_date === occurrence.originalDateKey)), optimistic]);
      const { error } = await supabase.from("tracker_plan_occurrence_overrides").upsert({
        plan_id: optimistic.plan_id,
        couple_id: optimistic.couple_id,
        occurrence_date: optimistic.occurrence_date,
        override_start_date: optimistic.override_start_date,
        override_starts_at: optimistic.override_starts_at,
        override_ends_at: optimistic.override_ends_at,
        status: "done",
        updated_by: currentUserId,
        updated_at: optimistic.updated_at,
      }, { onConflict: "plan_id,occurrence_date" });
      if (error) {
        setOccurrenceOverrides(previous);
        setMessage(`Не удалось завершить этот день: ${error.message}`);
        return;
      }
      void Promise.resolve(supabase.from("tracker_plan_activity").insert({
        plan_id: plan.id, couple_id: plan.couple_id, actor_id: currentUserId, activity_type: "completed",
      })).catch(() => undefined);
      reloadTrackerData();
    } finally {
      pendingMutations.current.delete(mutationKey);
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
      void Promise.resolve(supabase.from("tracker_plan_activity").insert({
        plan_id: plan.id,
        couple_id: plan.couple_id,
        actor_id: currentUserId,
        activity_type: "completed",
      })).catch(() => undefined);
    }
  }

  async function deletePlan(plan: TrackerPlan) {
    if (!couple || !currentUserId || plan.created_by !== currentUserId) return;
    const key = `delete-plan:${plan.id}`;
    if (pendingMutations.current.has(key) || !window.confirm("Удалить этот план и его обсуждение с файлами? Уже созданные воспоминания останутся.")) return;
    pendingMutations.current.add(key);
    let removedMedia = false;
    try {
      const [attachments, planComments] = await Promise.all([
        supabase.from("tracker_plan_attachments").select("storage_path").eq("plan_id", plan.id).eq("couple_id", couple.id),
        supabase.from("tracker_plan_comments").select("attachment_url").eq("plan_id", plan.id).eq("couple_id", couple.id),
      ]);
      if (attachments.error || planComments.error) throw attachments.error || planComments.error;
      const paths = [...new Set([
        ...(attachments.data || []).map((row) => row.storage_path),
        ...(planComments.data || []).map((row) => row.attachment_url).filter((path): path is string => Boolean(path)),
      ])];
      const prefix = `${couple.id}/${plan.id}/`;
      if (paths.some((path) => !path.startsWith(prefix) || path.includes(".."))) {
        throw new Error("Не удалось безопасно проверить пути вложений");
      }
      // Author access to the partner's files requires the plan to still exist.
      for (let offset = 0; offset < paths.length; offset += 100) {
        const { error } = await supabase.storage.from("tracker-media").remove(paths.slice(offset, offset + 100));
        if (error) throw error;
        removedMedia = true;
      }
      const { data, error } = await supabase.from("tracker_plans").delete()
        .eq("id", plan.id).eq("couple_id", couple.id).eq("created_by", currentUserId).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("План уже удалён или недоступен");
      setPlans((items) => items.filter((item) => item.id !== plan.id));
      setSelectedPlanId(null);
      setMessage("План, обсуждение и вложения удалены. Созданные воспоминания сохранены.");
    } catch {
      reloadTrackerData();
      setMessage(removedMedia
        ? "Вложения удалены, но удаление самого плана не завершилось. Повторите удаление."
        : "Не удалось удалить план и вложения. Проверьте соединение и повторите.");
    } finally {
      pendingMutations.current.delete(key);
    }
  }

  async function createGoal() {
    await runGuardedMutation("create-goal", () => performCreateGoal());
  }

  async function performCreateGoal() {
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
      reloadTrackerData();
      await createPartnerNotification(couple, currentUserId, {
        type: "tracker_goal_created",
        title: "Новая цель пары",
        body: `${category.name}: ${goalTarget}`,
        href: "/tracker/lab",
      }).catch(() => undefined);
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
      reloadTrackerData();
    }
  }

  async function savePersonalReminder(plan: TrackerPlan, offsetMinutes: number) {
    if (!currentUserId) return;
    const key = `reminder:${plan.id}`;
    if (pendingMutations.current.has(key)) return;
    pendingMutations.current.add(key);
    try {
      const existing = reminders.find((item) => item.plan_id === plan.id && item.user_id === currentUserId);
      const values = { plan_id: plan.id, couple_id: plan.couple_id, user_id: currentUserId, offset_minutes: offsetMinutes, delivery: "ics" };
      const query = existing
        ? supabase.from("tracker_plan_reminders").update(values).eq("id", existing.id).eq("user_id", currentUserId)
        : supabase.from("tracker_plan_reminders").insert(values);
      const { data, error } = await query.select("id,plan_id,user_id,offset_minutes,delivery").single<TrackerReminder>();
      if (error || !data) {
        setMessage("Не удалось сохранить личное напоминание. Попробуйте ещё раз.");
        return;
      }
      setReminders((items) => [data, ...items.filter((item) => item.id !== data.id)]);
      setMessage("Напоминание сохранено. Экспортируйте событие в системный календарь, чтобы оно сработало точно.");
    } finally {
      pendingMutations.current.delete(key);
    }
  }

  function downloadCalendar(plan: TrackerPlan) {
    const blob = new Blob([buildTrackerPlanIcs(plan, reminders.find((item) => item.plan_id === plan.id && item.user_id === currentUserId)?.offset_minutes ?? 60, timeZone, occurrenceOverrides)], { type: "text/calendar;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `${plan.title.replace(/[^a-zа-яё0-9]+/gi, "-").toLowerCase() || "couple-space"}.ics`;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  function openMemoryComposer(plan: TrackerPlan, date = selectedOccurrence?.dateKey || getPlanBaseDate(plan, timeZone)) {
    setMemoryDate(date);
    setMemoryPlan(plan);
    setMemoryTitle(plan.title);
    setMemoryCaption(plan.description || "");
  }

  async function createMemoryFromPlan() {
    if (!memoryPlan || !couple || !currentUserId) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(memoryDate) || toTrackerDateKey(parseTrackerDateKey(memoryDate)) !== memoryDate) {
      setMessage("Выберите корректную дату воспоминания");
      return;
    }
    const key = `memory:${memoryPlan.id}:${memoryDate}`;
    if (pendingMutations.current.has(key)) return;
    pendingMutations.current.add(key);
    setIsSaving(true);
    const uploadedPaths: string[] = [];
    const memoryId = crypto.randomUUID();
    let memoryWriteAttempted = false;
    let memorySaved = false;
    try {
      const { data: attachmentRows, error: attachmentLoadError } = await supabase
        .from("tracker_plan_attachments")
        .select("storage_path,name,mime_type,media_type,size_bytes")
        .eq("plan_id", memoryPlan.id)
        .order("created_at");
      if (attachmentLoadError) throw attachmentLoadError;
      let photoUrl: string | null = null;
      let voiceUrl: string | null = null;
      const memoryAttachments: MemoryAttachment[] = [];

      for (const attachment of attachmentRows || []) {
        const { data: blob, error: downloadError } = await supabase.storage
          .from("tracker-media")
          .download(attachment.storage_path);
        if (downloadError || !blob) throw downloadError || new Error("Не удалось прочитать вложение");
        const file = new File([blob], attachment.name, { type: attachment.mime_type || blob.type });
        const targetPath = getSafeStoragePath(couple.id, file);
        const { error: uploadError } = await supabase.storage.from("memory-images").upload(targetPath, file);
        if (uploadError) throw uploadError;
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

      memoryWriteAttempted = true;
      const { data: memory, error } = await supabase.from("memories").insert({
        id: memoryId,
        couple_id: couple.id,
        user_id: currentUserId,
        title: memoryTitle.trim() || memoryPlan.title,
        caption: memoryCaption.trim() || null,
        text: memoryCaption.trim() || null,
        event_date: memoryDate,
        image: encodeMemoryMedia({ photoUrl, voiceUrl, attachments: memoryAttachments }),
      }).select("id").single<{ id: string }>();
      if (error || !memory) throw error || new Error("Воспоминание не создано");
      memorySaved = true;
      const { error: linkError } = await supabase.from("tracker_plan_memory_links").insert({
        plan_id: memoryPlan.id,
        memory_id: memory.id,
        couple_id: couple.id,
        created_by: currentUserId,
      });
      // The memory is committed: a failed optional link or notification must never
      // remove files which are already referenced by a real memory.
      if (!linkError) {
        void Promise.resolve(supabase.from("tracker_plan_activity").insert({
          plan_id: memoryPlan.id,
          couple_id: couple.id,
          actor_id: currentUserId,
          activity_type: "memory_created",
        })).catch(() => undefined);
      }
      setMemoryPlan(null);
      setMessage(linkError ? "Воспоминание сохранено, но связать его с планом не удалось." : "Воспоминание сохранено");
      router.push(`/memories/${memory.id}`);
    } catch (error) {
      let canRemoveUploads = !memoryWriteAttempted;
      if (memoryWriteAttempted && !memorySaved) {
        // A network failure can arrive after INSERT committed. Probe the stable ID
        // before cleanup; if its outcome is uncertain, retain the uploaded media.
        try {
          const { data: existing, error: probeError } = await supabase.from("memories")
            .select("id").eq("id", memoryId).eq("couple_id", couple.id).maybeSingle();
          memorySaved = Boolean(existing);
          canRemoveUploads = !probeError && !existing;
        } catch {
          canRemoveUploads = false;
        }
      }
      if (memorySaved) {
        setMemoryPlan(null);
        router.push(`/memories/${memoryId}`);
      } else if (!canRemoveUploads) {
        setMemoryPlan(null);
        setMessage("Не удалось подтвердить сохранение. Проверьте раздел «Воспоминания» перед повторной попыткой. Загруженные материалы не удалены.");
      } else {
        if (uploadedPaths.length) {
          await supabase.storage.from("memory-images").remove(uploadedPaths).catch(() => undefined);
        }
        setMessage(`Не удалось создать воспоминание: ${getErrorMessage(error, "попробуйте снова")}`);
      }
    } finally {
      setIsSaving(false);
      pendingMutations.current.delete(key);
    }
  }

  function navigateDate(amount: number) {
    setSelectedDate(shiftTrackerViewDate(selectedDate, calendarMode, amount));
  }

  function renderPlanCard(occurrence: TrackerOccurrence, compact = false) {
    const plan = occurrence.plan;
    const person = getPersonMeta(plan.created_by);
    const scope = currentUserId ? relativeScope(plan, currentUserId) : "both";
    const participant = participants.find((item) => item.plan_id === plan.id && item.user_id === currentUserId);
    const canAct = plan.created_by === currentUserId ||
      (plan.edit_scope === "participants" && participant?.response === "accepted");
    return (
      <article
        key={`${plan.id}-${occurrence.originalDateKey}`}
        className={`tracker-lab-plan-card is-${plan.kind} ${occurrence.status === "done" ? "is-done" : ""} ${compact ? "is-compact" : ""}`}
        data-plan-card
        data-plan-id={plan.id}
      >
        <button type="button" className="tracker-lab-plan-main" onClick={() => { setSelectedPlanId(plan.id); setSelectedOccurrenceDate(occurrence.originalDateKey); }}>
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
          {occurrence.status !== "done" && canAct && (
            <button type="button" onClick={() => void completeOccurrence(occurrence)}><Check size={15} />Готово</button>
          )}
          <button type="button" onClick={() => downloadCalendar(plan)}><Download size={15} />В календарь</button>
          {occurrence.status === "done" && (
            <button type="button" onClick={() => openMemoryComposer(plan, occurrence.dateKey)}><Sparkles size={15} />В воспоминания</button>
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
            <button type="button" onClick={() => setSelectedDate(getTrackerToday(timeZone))}>Сегодня</button>
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
                  cell.key === getTrackerToday(timeZone) ? "is-today" : "",
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

        {visibleMessage && (
          <div className="tracker-lab-toast" role="status">
            <span>{visibleMessage}</span>
            {trackerLoadError
              ? <button type="button" onClick={reloadTrackerData} aria-label="Повторить загрузку"><RefreshCw /></button>
              : <button type="button" onClick={() => setMessage("")} aria-label="Закрыть"><X /></button>}
          </div>
        )}

        <section className="tracker-lab-toolbar">
          <div className="tracker-lab-week-strip">
            {week.map((item) => (
              <button type="button" key={item.dateKey} className={selectedDate === item.dateKey ? "is-active" : ""} onClick={() => setSelectedDate(item.dateKey)}>
                <small>{item.weekday}</small><strong>{item.day}</strong>{item.dateKey === getTrackerToday(timeZone) && <i />}
              </button>
            ))}
          </div>
          <label className="tracker-lab-search">
            <Search aria-hidden="true" />
            <input data-tracker-search value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Найти в календаре" />
          </label>
          <button type="button" className="tracker-lab-refresh" onClick={() => reloadTrackerData()} aria-label="Обновить"><RefreshCw /></button>
        </section>

        {activeTab === "today" && (
          <section className="tracker-lab-desktop-grid">
            <aside className="tracker-lab-left-column">
              {renderMonthCalendar()}
              <button type="button" className="tracker-lab-free-button" onClick={() => setIsFreeTimeOpen(true)}>
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
              <button type="button" onClick={() => setSelectedDate(getTrackerToday(timeZone))}>Сегодня</button>
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

      {selectedPlan && !composerMode && !memoryPlan && !isFreeTimeOpen && (
        <TrackerLabDialog className="tracker-lab-detail-sheet" label="Подробности события" onClose={() => setSelectedPlanId(null)}>
            <button type="button" className="tracker-lab-sheet-close" onClick={() => setSelectedPlanId(null)} aria-label="Закрыть"><X /></button>
            <span className="tracker-lab-detail-icon">{getPlanIcon(selectedPlan.kind, 24)}</span>
            <p>{kindLabels[selectedPlan.kind]} · {selectedPlan.visibility === "private" ? "Только вам" : "Для пары"}</p>
            <h2>{selectedPlan.title}</h2>
            {selectedPlan.description && <div className="tracker-lab-detail-description">{selectedPlan.description}</div>}
            <dl className="tracker-lab-detail-list">
              <div><dt><CalendarDays /></dt><dd><strong>{formatTrackerDate(selectedOccurrence?.dateKey || getPlanBaseDate(selectedPlan, timeZone))}</strong><span>{formatClock(selectedOccurrence?.startsAt || selectedPlan.starts_at)} · {timeZone}</span></dd></div>
              <div><dt><UsersRound /></dt><dd><strong>{selectedPlan.participant_scope === "both" ? "Вместе" : selectedPlan.participant_scope === "me" ? "Автор" : "Партнёр"}</strong><span>{selectedPlan.edit_scope === "participants" ? "Можно редактировать вместе" : "Редактирует автор"}</span></dd></div>
              <div><dt><RefreshCw /></dt><dd><strong>{repeatLabels[selectedPlan.repeat_mode]}</strong><span>{selectedPlan.repeat_until ? `До ${formatTrackerDate(selectedPlan.repeat_until)}` : "Без даты окончания"}</span></dd></div>
            </dl>
            {selectedParticipant?.response === "pending" && (
              <section className="tracker-lab-invitation">
                <span><UsersRound /><strong>Вас пригласили в этот план</strong></span>
                <div>
                  <button type="button" onClick={() => void respondToPlan("accepted")}><Check />Принять</button>
                  <button type="button" onClick={() => void respondToPlan("declined")}><X />Отклонить</button>
                </div>
              </section>
            )}
            {selectedParticipant?.response === "declined" && (
              <div className="tracker-lab-privacy-note"><EyeOff />Вы отклонили участие. План остаётся видимым в общем календаре.</div>
            )}
            <label className="tracker-lab-personal-reminder"><span><Bell size={16} />Моё напоминание</span><select aria-label="Моё напоминание" value={selectedReminder?.offset_minutes ?? 60} onChange={(event) => void savePersonalReminder(selectedPlan, Number(event.target.value))}><option value={0}>В момент события</option><option value={30}>За 30 минут</option><option value={60}>За час</option><option value={1440}>За день</option><option value={10080}>За неделю</option></select><small>Точное время — после экспорта в календарь. Настройка видна только вам.</small></label>
            <div className="tracker-lab-detail-actions">
              {canEditSelectedPlan && (
                <button type="button" onClick={() => openPlanEditor(selectedPlan)}><Pencil />Изменить всю серию</button>
              )}
              {canEditSelectedPlan && selectedPlan.repeat_mode !== "none" && selectedOccurrenceDate && (
                <button type="button" onClick={() => openOccurrenceEditor(selectedPlan)}><CalendarRange />Перенести этот день</button>
              )}
              {canEditSelectedPlan && selectedPlan.repeat_mode !== "none" && selectedOccurrenceDate && (
                <button type="button" onClick={() => void cancelOccurrence(selectedPlan)}><X />Отменить этот день</button>
              )}
              {selectedStatus !== "done" && canEditSelectedPlan && <button type="button" onClick={() => void (selectedOccurrence ? completeOccurrence(selectedOccurrence) : updatePlanStatus(selectedPlan, "done"))}><Check />Завершить</button>}
              <button type="button" onClick={() => downloadCalendar(selectedPlan)}><Download />Добавить в календарь</button>
              {selectedStatus === "done" && <button type="button" onClick={() => openMemoryComposer(selectedPlan)}><Sparkles />Сделать воспоминанием</button>}
              {selectedPlan.created_by === currentUserId && <button type="button" className="is-danger" onClick={() => void deletePlan(selectedPlan)}><Trash2 />Удалить</button>}
            </div>
            {couple && currentUserId && <TrackerLabDiscussion
              key={selectedPlan.id}
              plan={selectedPlan}
              couple={couple}
              currentUserId={currentUserId}
              comments={selectedComments}
              getPersonMeta={getPersonMeta}
              onReload={reloadTrackerData}
              onMessage={setMessage}
            />}
        </TrackerLabDialog>
      )}

      {composerMode && (
        <TrackerLabDialog className="tracker-lab-composer-sheet" label="Добавить в трекер" onClose={() => { setComposerMode(null); setEditingPlanId(null); }}>
            <div className="tracker-lab-sheet-handle" />
            <button type="button" className="tracker-lab-sheet-close" onClick={() => { setComposerMode(null); setEditingPlanId(null); }} aria-label="Закрыть"><X /></button>
            {composerMode === "menu" && (
              <>
                <p>Добавить</p><h2>Что происходит?</h2>
                <div className="tracker-lab-create-menu">
                  <button type="button" onClick={() => openComposer("plan")}><CalendarDays /><span><strong>Событие или план</strong><small>Свидание, задача, дата</small></span><ChevronRight /></button>
                  <button type="button" onClick={() => setComposerMode("activity")}><Activity /><span><strong>Быстрая отметка</strong><small>Еда, спорт, игры и другое</small></span><ChevronRight /></button>
                  <button type="button" onClick={() => openComposer("checkin")}><Sparkles /><span><strong>Состояние дня</strong><small>Настроение и энергия</small></span><ChevronRight /></button>
                  <button type="button" onClick={() => setComposerMode("goal")}><Target /><span><strong>Новая цель</strong><small>Общий ориентир пары</small></span><ChevronRight /></button>
                </div>
              </>
            )}
            {composerMode === "plan" && (
              <TrackerLabPlanComposer
                value={{
                  title: planTitle, description: planDescription, kind: planKind, date: planDate,
                  time: planTime, endTime: planEndTime, scope: planScope, visibility: planVisibility,
                  repeat: planRepeat, repeatInterval: planRepeatInterval, repeatWeekdays: planRepeatWeekdays,
                  repeatUntil: planRepeatUntil, reminder: planReminder, status: planStatus,
                  editScope: planEditScope, assigneeId: planAssigneeId,
                }}
                onChange={changePlanDraft}
                onSubmit={() => void savePlan()}
                saving={isSaving}
                editing={Boolean(editingPlanId)}
                ownsPlan={!editingPlanId || plans.find((item) => item.id === editingPlanId)?.created_by === currentUserId}
                timeZone={timeZone}
                people={[currentUserId, partnerId].filter((id): id is string => Boolean(id)).map((id) => ({ id, label: getPersonMeta(id).name }))}
              />
            )}
            {composerMode === "occurrence" && selectedPlan && (
              <>
                <p>Одно повторение</p><h2>Перенести этот день</h2>
                <span className="tracker-lab-privacy-note"><CalendarRange />Остальные даты серии не изменятся.</span>
                <div className="tracker-lab-form-grid">
                  <label className="is-wide"><span>Новая дата</span><input type="date" value={planDate} onChange={(event) => setPlanDate(event.target.value)} /></label>
                  {!selectedPlan.all_day && <label><span>Начало</span><input type="time" value={planTime} onChange={(event) => setPlanTime(event.target.value)} /></label>}
                  {!selectedPlan.all_day && <label><span>Конец</span><input type="time" value={planEndTime} onChange={(event) => setPlanEndTime(event.target.value)} /></label>}
                </div>
                <button type="button" className="tracker-lab-primary-button" disabled={isSaving} onClick={() => void saveOccurrenceOverride()}>{isSaving ? "Сохраняем…" : "Перенести только этот день"}</button>
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
        </TrackerLabDialog>
      )}

      {isFreeTimeOpen && couple && (
        <TrackerLabFreeTimeDialog
          coupleId={couple.id}
          date={selectedDate}
          timeZone={timeZone}
          onClose={() => setIsFreeTimeOpen(false)}
          onChoose={(slot) => {
            resetPlanComposer();
            setPlanDate(getTrackerToday(timeZone, new Date(slot.starts_at)));
            setPlanTime(formatTrackerClock(slot.starts_at, timeZone));
            setPlanEndTime(formatTrackerClock(slot.ends_at, timeZone));
            setIsFreeTimeOpen(false);
            setComposerMode("plan");
          }}
        />
      )}

      {memoryPlan && (
        <TrackerLabDialog className="tracker-lab-composer-sheet" label="Сохранить воспоминание" onClose={() => setMemoryPlan(null)}>
            <button type="button" className="tracker-lab-sheet-close" onClick={() => setMemoryPlan(null)} aria-label="Закрыть"><X /></button>
            <p>Из плана в историю</p><h2>Сохранить воспоминание</h2>
            <span className="tracker-lab-privacy-note"><Sparkles />Фото, файлы и голосовые из обсуждения будут скопированы. Воспоминание будет доступно обоим партнёрам.</span>
            <div className="tracker-lab-form-grid">
              <label><span>Дата воспоминания</span><input type="date" value={memoryDate} onChange={(event) => setMemoryDate(event.target.value)} /></label>
              <label className="is-wide"><span>Название</span><input value={memoryTitle} onChange={(event) => setMemoryTitle(event.target.value)} /></label>
              <label className="is-wide"><span>Описание</span><textarea rows={4} value={memoryCaption} onChange={(event) => setMemoryCaption(event.target.value)} /></label>
            </div>
            <button type="button" className="tracker-lab-primary-button" onClick={() => void createMemoryFromPlan()} disabled={isSaving}>{isSaving ? "Переносим материалы…" : "Создать воспоминание"}</button>
        </TrackerLabDialog>
      )}
    </main>
  );
}
