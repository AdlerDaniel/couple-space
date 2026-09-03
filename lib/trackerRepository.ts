import { supabase } from "@/lib/supabaseClient";

export type TrackerLabSnapshot = {
  categories: unknown[];
  preferences: unknown[];
  events: unknown[];
  goals: unknown[];
  plans: unknown[];
  participants: unknown[];
  occurrenceOverrides: unknown[];
  checkins: unknown[];
  profile: unknown | null;
  comments: unknown[];
  reminders: unknown[];
};

export async function fetchTrackerLabData(coupleId: string, year: number): Promise<TrackerLabSnapshot> {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const [
    categoryResult,
    preferenceResult,
    eventResult,
    goalResult,
    planResult,
    participantResult,
    overrideResult,
    checkinResult,
    profileResult,
    commentResult,
    reminderResult,
  ] = await Promise.all([
    supabase.from("tracker_categories").select("*").order("sort_order"),
    supabase.from("tracker_category_preferences").select("*").eq("couple_id", coupleId),
    supabase.from("tracker_events").select("*").eq("couple_id", coupleId).gte("date", from).lte("date", to).order("date"),
    supabase.from("tracker_goals").select("*").eq("couple_id", coupleId).order("created_at", { ascending: false }),
    supabase.from("tracker_plans").select("*").eq("couple_id", coupleId).order("created_at", { ascending: false }),
    supabase.from("tracker_plan_participants").select("*").eq("couple_id", coupleId),
    supabase.from("tracker_plan_occurrence_overrides").select("*").eq("couple_id", coupleId),
    supabase.rpc("get_tracker_checkins", { p_couple_id: coupleId, p_from: from, p_to: to }),
    supabase.from("couple_profiles").select("partner_one,partner_two,avatar,avatar_one,avatar_two,time_zone").eq("couple_id", coupleId).limit(1).maybeSingle(),
    supabase.from("tracker_plan_comments").select("*").eq("couple_id", coupleId).order("created_at"),
    supabase.from("tracker_plan_reminders").select("id,plan_id,user_id,offset_minutes,delivery").eq("couple_id", coupleId).order("created_at", { ascending: false }),
  ]);

  const firstError = [
    categoryResult.error,
    preferenceResult.error,
    eventResult.error,
    goalResult.error,
    planResult.error,
    participantResult.error,
    overrideResult.error,
    checkinResult.error,
    profileResult.error,
    commentResult.error,
    reminderResult.error,
  ].find((error): error is NonNullable<typeof categoryResult.error> => Boolean(error));
  if (firstError) throw firstError;

  const comments = await Promise.all((commentResult.data || []).map(async (comment) => {
    if (!comment.attachment_url) return comment;
    const { data } = await supabase.storage
      .from("tracker-media")
      .createSignedUrl(comment.attachment_url, 3600);
    return { ...comment, attachment_signed_url: data?.signedUrl || null };
  }));

  return {
    categories: categoryResult.data || [],
    preferences: preferenceResult.data || [],
    events: eventResult.data || [],
    goals: goalResult.data || [],
    plans: planResult.data || [],
    participants: participantResult.data || [],
    occurrenceOverrides: overrideResult.data || [],
    checkins: checkinResult.data || [],
    profile: profileResult.data || null,
    comments,
    reminders: reminderResult.data || [],
  };
}

export function subscribeTrackerData(coupleId: string, onChange: () => void) {
  const filter = `couple_id=eq.${coupleId}`;
  const channel = supabase
    .channel(`tracker-data:${coupleId}:${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "tracker_events", filter }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "tracker_goals", filter }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "tracker_plans", filter }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "tracker_plan_participants", filter }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "tracker_plan_occurrence_overrides", filter }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "tracker_checkins", filter }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "tracker_plan_comments", filter }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "tracker_category_preferences", filter }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "tracker_plan_reminders", filter }, onChange)
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function adjustTrackerEventCount(input: {
  coupleId: string;
  categoryId: string;
  date: string;
  delta: -1 | 1;
}) {
  return supabase.rpc("adjust_tracker_event_count", {
    p_couple_id: input.coupleId,
    p_category_id: input.categoryId,
    p_date: input.date,
    p_delta: input.delta,
  });
}

export async function saveTrackerCheckin(input: {
  coupleId: string;
  date: string;
  mood: string;
  energy: number;
  relationship: number;
  visibility: "private" | "summary" | "full";
  note: string | null;
  revealAfterBoth: boolean;
}) {
  return supabase.rpc("save_tracker_checkin", {
    p_couple_id: input.coupleId,
    p_date: input.date,
    p_mood: input.mood,
    p_energy: input.energy,
    p_relationship: input.relationship,
    p_visibility: input.visibility,
    p_note: input.note,
    p_reveal_after_both: input.revealAfterBoth,
  });
}

export async function fetchTrackerFreeSlots(coupleId: string, query: {
  from: string; to: string; duration: number; dayStart: string; dayEnd: string;
}) {
  const from = Date.parse(query.from + "T00:00:00Z");
  const to = Date.parse(query.to + "T00:00:00Z");
  const days = Math.round((to - from) / 86_400_000) + 1;
  if (!Number.isFinite(days) || days < 1 || days > 14) throw new Error("Выберите диапазон от 1 до 14 дней.");
  if (!query.dayStart || !query.dayEnd || query.dayEnd <= query.dayStart) throw new Error("Конец свободного времени должен быть позже начала.");
  if (!Number.isInteger(query.duration) || query.duration < 15 || query.duration > 720) throw new Error("Проверьте длительность встречи.");
  const results = await Promise.all(Array.from({ length: days }, (_, index) => {
    const date = new Date(from + index * 86_400_000).toISOString().slice(0, 10);
    return supabase.rpc("find_tracker_common_free_slots", {
      p_couple_id: coupleId, p_date: date, p_duration_minutes: query.duration,
      p_day_start: query.dayStart, p_day_end: query.dayEnd,
    });
  }));
  const error = results.find((result) => result.error)?.error;
  if (error) throw new Error(error.message);
  return results.flatMap((result) => (result.data || []) as Array<{ starts_at: string; ends_at: string }>);
}
