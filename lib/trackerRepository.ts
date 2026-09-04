import { supabase } from "@/lib/supabaseClient";
import { collectTrackerPages } from "@/lib/trackerPagination";
import type { TrackerPlan } from "@/lib/trackerPlanDomain";

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

export function fetchTrackerEvents(coupleId: string, from: string, to: string) {
  return collectTrackerPages((first, last) => supabase.from("tracker_events")
    .select("*").eq("couple_id", coupleId).gte("date", from).lte("date", to)
    .order("date", { ascending: false }).order("created_at", { ascending: false }).order("id").range(first, last));
}

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
    fetchTrackerEvents(coupleId, `${year - 1}-12-01`, to),
    collectTrackerPages((first, last) => supabase.from("tracker_goals").select("*").eq("couple_id", coupleId).order("created_at", { ascending: false }).order("id").range(first, last)),
    collectTrackerPages((first, last) => supabase.from("tracker_plans").select("*").eq("couple_id", coupleId).order("created_at", { ascending: false }).order("id").range(first, last)),
    collectTrackerPages((first, last) => supabase.from("tracker_plan_participants").select("*").eq("couple_id", coupleId).order("id").range(first, last)),
    collectTrackerPages((first, last) => supabase.from("tracker_plan_occurrence_overrides").select("*").eq("couple_id", coupleId).order("id").range(first, last)),
    supabase.rpc("get_tracker_checkins", { p_couple_id: coupleId, p_from: from, p_to: to }),
    supabase.from("couple_profiles").select("partner_one,partner_two,avatar,avatar_one,avatar_two,time_zone").eq("couple_id", coupleId).limit(1).maybeSingle(),
    collectTrackerPages((first, last) => supabase.from("tracker_plan_comments").select("*").eq("couple_id", coupleId).order("created_at").order("id").range(first, last)),
    collectTrackerPages((first, last) => supabase.from("tracker_plan_reminders").select("id,plan_id,user_id,offset_minutes,delivery").eq("couple_id", coupleId).order("created_at", { ascending: false }).order("id").range(first, last)),
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
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  const scheduleRefresh = () => {
    if (disposed) return;
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      if (!disposed) onChange();
    }, 120);
  };
  const channel = supabase
    .channel(`tracker:${coupleId}`, { config: { private: true } })
    .on("broadcast", { event: "changed" }, scheduleRefresh);

  // Private Broadcast is pair-scoped by realtime.messages RLS. Unlike filtered
  // Postgres DELETE events it carries no row payload, so privacy revocations and
  // deletions can safely invalidate every open tab.
  void supabase.realtime.setAuth()
    .then(() => {
      if (disposed) return;
      channel.subscribe((status) => {
        // A refresh after the private channel has actually joined closes the
        // small window between the initial snapshot and Realtime readiness.
        if (status === "SUBSCRIBED" && !disposed) scheduleRefresh();
      });
    })
    .catch(() => undefined);

  return () => {
    disposed = true;
    if (refreshTimer) clearTimeout(refreshTimer);
    void supabase.removeChannel(channel);
  };
}

export async function completeTrackerAssignedTask(planId: string, occurrenceDate: string | null) {
  return supabase.rpc("complete_tracker_assigned_task", {
    p_plan_id: planId,
    p_occurrence_date: occurrenceDate || undefined,
  });
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

export async function synchronizeTrackerParticipants(
  plan: TrackerPlan,
  currentUserId: string,
  partnerId: string | null,
) {
  if (plan.created_by !== currentUserId) return;
  const { data: existing, error: loadError } = await supabase.from("tracker_plan_participants")
    .select("id,user_id,role,response").eq("plan_id", plan.id).eq("couple_id", plan.couple_id);
  if (loadError) throw new Error(loadError.message);
  const desired = new Set<string>(plan.visibility === "private" || plan.participant_scope === "me"
    ? [currentUserId]
    : plan.participant_scope === "partner"
      ? partnerId ? [partnerId] : [currentUserId]
      : [currentUserId, ...(partnerId ? [partnerId] : [])]);
  if (plan.assignee_id && plan.visibility !== "private") desired.add(plan.assignee_id);
  for (const userId of desired) {
    const participant = existing?.find((item) => item.user_id === userId);
    const role = userId === plan.assignee_id ? "responsible" : "participant";
    if (!participant) {
      const { error } = await supabase.from("tracker_plan_participants").insert({
        plan_id: plan.id, couple_id: plan.couple_id, user_id: userId, role,
        response: userId === currentUserId ? "accepted" : "pending",
      });
      if (error) throw new Error(error.message);
    } else if (participant.role !== role) {
      const { error } = await supabase.from("tracker_plan_participants").update({ role }).eq("id", participant.id);
      if (error) throw new Error(error.message);
    }
  }
  const removed = (existing || []).filter((item) => !desired.has(item.user_id)).map((item) => item.id);
  if (removed.length) {
    const { error } = await supabase.from("tracker_plan_participants").delete().eq("plan_id", plan.id).in("id", removed);
    if (error) throw new Error(error.message);
  }
}
