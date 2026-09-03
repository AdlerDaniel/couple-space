import { sendPushToUser } from "@/lib/pushServer";
import { getAdminClient } from "@/lib/supabaseAdmin";
import {
  expandTrackerPlanOccurrences,
  getTrackerToday,
  type TrackerOccurrenceOverride,
  type TrackerPlan,
} from "@/lib/trackerPlanDomain";

type Couple = {
  id: string;
  partner_one_id: string | null;
  partner_two_id: string | null;
};

type CoupleProfile = {
  couple_id: string;
  time_zone: string | null;
};

function includesUser(plan: TrackerPlan, userId: string, couple: Couple) {
  if (plan.visibility === "private") return plan.created_by === userId;
  if (plan.participant_scope === "both") return true;
  if (plan.participant_scope === "me") return plan.created_by === userId;
  const partnerId = plan.created_by === couple.partner_one_id
    ? couple.partner_two_id
    : couple.partner_one_id;
  return partnerId === userId;
}

export async function sendTrackerDailyDigest(now = new Date()) {
  const adminSupabase = getAdminClient();
  if (!adminSupabase) {
    return { couplesChecked: 0, targetedUsers: 0, sentSubscriptions: 0, skippedUsers: 0 };
  }

  const { data: couples, error } = await adminSupabase
    .from("couples")
    .select("id, partner_one_id, partner_two_id")
    .not("partner_two_id", "is", null)
    .returns<Couple[]>();
  if (error || !couples?.length) {
    return { couplesChecked: 0, targetedUsers: 0, sentSubscriptions: 0, skippedUsers: 0 };
  }

  const { data: profiles } = await adminSupabase
    .from("couple_profiles")
    .select("couple_id, time_zone")
    .in("couple_id", couples.map((couple) => couple.id))
    .returns<CoupleProfile[]>();
  const zones = new Map(
    (profiles || []).map((profile) => [profile.couple_id, profile.time_zone || "Europe/Moscow"]),
  );

  let targetedUsers = 0;
  let sentSubscriptions = 0;
  let skippedUsers = 0;

  for (const couple of couples) {
    const timeZone = zones.get(couple.id) || "Europe/Moscow";
    const dateKey = getTrackerToday(timeZone, now);
    const { data: planRows } = await adminSupabase
      .from("tracker_plans")
      .select("*")
      .eq("couple_id", couple.id)
      .neq("status", "cancelled")
      .returns<TrackerPlan[]>();
    const { data: overrides, error: overrideError } = await adminSupabase
      .from("tracker_plan_occurrence_overrides")
      .select("*")
      .eq("couple_id", couple.id)
      .returns<TrackerOccurrenceOverride[]>();
    if (overrideError) continue;
    const occurrences = expandTrackerPlanOccurrences(planRows || [], dateKey, dateKey, timeZone, overrides || [])
      .filter((occurrence) => occurrence.status !== "done" && occurrence.status !== "cancelled");

    for (const userId of [couple.partner_one_id, couple.partner_two_id].filter(Boolean) as string[]) {
      const visibleCount = occurrences.filter(({ plan }) => includesUser(plan, userId, couple)).length;
      if (!visibleCount) continue;
      targetedUsers += 1;
      const result = await sendPushToUser(userId, {
        title: "Ваш общий день в Couple Space",
        body: visibleCount === 1
          ? "На сегодня запланировано одно событие."
          : `На сегодня запланировано событий: ${visibleCount}.`,
        href: `/tracker/lab?date=${dateKey}`,
        tag: `tracker-digest-${dateKey}`,
      });
      sentSubscriptions += result.sent;
      if (result.skipped || result.sent === 0) skippedUsers += 1;
    }
  }

  return {
    couplesChecked: couples.length,
    targetedUsers,
    sentSubscriptions,
    skippedUsers,
  };
}
