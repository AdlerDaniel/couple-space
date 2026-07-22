import { randomBytes } from "node:crypto";
import { enforceRateLimit, isSameOriginRequest, readJsonObject } from "@/lib/apiSecurity";
import { getAdminClient, getAuthenticatedUser } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Couple = {
  id: string;
  invite_code: string;
  partner_one_id: string | null;
  partner_two_id: string | null;
};

const inviteCodePattern = /^[A-Z0-9]{6,12}$/;

async function getCurrentCouple(
  adminSupabase: NonNullable<ReturnType<typeof getAdminClient>>,
  userId: string,
) {
  return adminSupabase
    .from("couples")
    .select("id, invite_code, partner_one_id, partner_two_id")
    .or(`partner_one_id.eq.${userId},partner_two_id.eq.${userId}`)
    .limit(1)
    .maybeSingle<Couple>();
}

async function createCouple(
  adminSupabase: NonNullable<ReturnType<typeof getAdminClient>>,
  userId: string,
) {
  const existing = await getCurrentCouple(adminSupabase, userId);
  if (existing.data) {
    return Response.json({ error: "Вы уже состоите в паре" }, { status: 409 });
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const inviteCode = randomBytes(5).toString("hex").slice(0, 8).toUpperCase();
    const { data, error } = await adminSupabase
      .from("couples")
      .insert({ invite_code: inviteCode, partner_one_id: userId })
      .select("id, invite_code, partner_one_id, partner_two_id")
      .single<Couple>();

    if (data) return Response.json({ couple: data });
    if (error?.code !== "23505") {
      return Response.json({ error: "Не удалось создать пару" }, { status: 400 });
    }
  }

  return Response.json({ error: "Не удалось создать уникальный invite-код" }, { status: 503 });
}

async function joinCouple(
  adminSupabase: NonNullable<ReturnType<typeof getAdminClient>>,
  userId: string,
  inviteCode: string,
) {
  const existing = await getCurrentCouple(adminSupabase, userId);
  if (existing.data) {
    return Response.json(
      { error: "Вы уже состоите в паре. Сначала покиньте текущую пару." },
      { status: 409 },
    );
  }

  const { data: candidate } = await adminSupabase
    .from("couples")
    .select("id, invite_code, partner_one_id, partner_two_id")
    .eq("invite_code", inviteCode)
    .is("partner_two_id", null)
    .maybeSingle<Couple>();

  if (!candidate || candidate.partner_one_id === userId) {
    return Response.json({ error: "Код не найден или уже использован" }, { status: 404 });
  }

  const { data, error } = await adminSupabase
    .from("couples")
    .update({ partner_two_id: userId })
    .eq("id", candidate.id)
    .is("partner_two_id", null)
    .select("id, invite_code, partner_one_id, partner_two_id")
    .maybeSingle<Couple>();

  if (error || !data) {
    return Response.json({ error: "Код уже использован другим пользователем" }, { status: 409 });
  }

  return Response.json({ couple: data });
}

async function leaveCouple(
  adminSupabase: NonNullable<ReturnType<typeof getAdminClient>>,
  userId: string,
  coupleId: string,
) {
  const { data: couple } = await adminSupabase
    .from("couples")
    .select("id, invite_code, partner_one_id, partner_two_id")
    .eq("id", coupleId)
    .maybeSingle<Couple>();

  if (!couple || ![couple.partner_one_id, couple.partner_two_id].includes(userId)) {
    return Response.json({ error: "Нет доступа к этой паре" }, { status: 403 });
  }

  const updates =
    couple.partner_one_id === userId
      ? couple.partner_two_id
        ? { partner_one_id: couple.partner_two_id, partner_two_id: null }
        : { partner_one_id: null, partner_two_id: null }
      : { partner_two_id: null };

  const { error } = await adminSupabase.from("couples").update(updates).eq("id", couple.id);
  if (error) {
    return Response.json({ error: "Не удалось покинуть пару" }, { status: 400 });
  }

  return Response.json({ ok: true });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  }

  const adminSupabase = getAdminClient();
  if (!adminSupabase) {
    return Response.json({ error: "Supabase admin не настроен" }, { status: 500 });
  }

  const user = await getAuthenticatedUser(adminSupabase, request);
  if (!user) return Response.json({ error: "Не выполнен вход" }, { status: 401 });

  const rateLimitResponse = await enforceRateLimit(adminSupabase, request, {
    route: "couple-membership",
    identity: user.id,
    limit: 12,
    windowMs: 60_000,
  });
  if (rateLimitResponse) return rateLimitResponse;

  const parsed = await readJsonObject(request, 4 * 1024);
  if (parsed.error) return parsed.error;

  const action = typeof parsed.data.action === "string" ? parsed.data.action : "";
  if (action === "create") return createCouple(adminSupabase, user.id);

  if (action === "join") {
    const inviteCode =
      typeof parsed.data.inviteCode === "string"
        ? parsed.data.inviteCode.trim().toUpperCase()
        : "";
    if (!inviteCodePattern.test(inviteCode)) {
      return Response.json({ error: "Некорректный invite-код" }, { status: 400 });
    }
    return joinCouple(adminSupabase, user.id, inviteCode);
  }

  if (action === "leave") {
    const coupleId = typeof parsed.data.coupleId === "string" ? parsed.data.coupleId : "";
    if (!coupleId) {
      return Response.json({ error: "Не передана пара" }, { status: 400 });
    }
    return leaveCouple(adminSupabase, user.id, coupleId);
  }

  return Response.json({ error: "Неизвестное действие" }, { status: 400 });
}
