import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { getDailyQuestion, getDailyQuestionDate } from "@/lib/dailyQuestions";
import { sendPushToUser } from "@/lib/pushServer";
import { getAdminClient } from "@/lib/supabaseAdmin";
import { getDailyQuestionReminderRecipients } from "@/lib/today";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Couple = {
  id: string;
  partner_one_id: string | null;
  partner_two_id: string | null;
};

type CoupleProfile = {
  couple_id: string;
  time_zone: string | null;
};

type QuestionAnswer = {
  answer_one: string | null;
  answer_two: string | null;
};

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminSupabase = getAdminClient();
  if (!adminSupabase) {
    return Response.json({ error: "Supabase admin is not configured" }, { status: 500 });
  }

  const { data: couples, error: couplesError } = await adminSupabase
    .from("couples")
    .select("id, partner_one_id, partner_two_id")
    .not("partner_two_id", "is", null)
    .returns<Couple[]>();

  if (couplesError) {
    return Response.json({ error: couplesError.message }, { status: 500 });
  }

  const coupleIds = (couples || []).map((couple) => couple.id);
  const { data: profiles } = coupleIds.length
    ? await adminSupabase
        .from("couple_profiles")
        .select("couple_id, time_zone")
        .in("couple_id", coupleIds)
        .returns<CoupleProfile[]>()
    : { data: [] as CoupleProfile[] };
  const timeZoneByCoupleId = new Map(
    (profiles || []).map((profile) => [profile.couple_id, profile.time_zone || "Europe/Moscow"]),
  );

  const now = new Date();
  let targetedUsers = 0;
  let sentSubscriptions = 0;
  let skippedUsers = 0;

  for (const couple of couples || []) {
    const timeZone = timeZoneByCoupleId.get(couple.id) || "Europe/Moscow";
    const question = getDailyQuestion(now, timeZone);
    const questionDate = getDailyQuestionDate(now, timeZone);

    const { data: answer } = await adminSupabase
      .from("question_answers")
      .select("answer_one, answer_two")
      .eq("couple_id", couple.id)
      .eq("date", questionDate)
      .eq("question", question)
      .limit(1)
      .maybeSingle<QuestionAnswer>();

    const recipients = getDailyQuestionReminderRecipients(couple, answer || null);
    targetedUsers += recipients.length;

    for (const userId of recipients) {
      const result = await sendPushToUser(userId, {
        title: "Сегодняшний вопрос уже ждёт вас",
        body: "Откройте Couple Space и ответьте на вопрос дня.",
        href: "/questions/answer",
        tag: "daily-question",
      });

      sentSubscriptions += result.sent;
      if (result.skipped || result.sent === 0) {
        skippedUsers += 1;
      }
    }
  }

  return Response.json({
    ok: true,
    couplesChecked: couples?.length || 0,
    targetedUsers,
    sentSubscriptions,
    skippedUsers,
  });
}
