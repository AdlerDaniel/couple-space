import { sendPushToUser } from "@/lib/pushServer";
import { getAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type CoupleNotification = {
  id: string;
  couple_id: string;
  recipient_id: string;
  actor_id: string;
  title: string;
  body: string | null;
  href: string | null;
  type: string;
};

type Couple = {
  id: string;
  partner_one_id: string;
  partner_two_id: string | null;
};

type PushSendRequest = {
  notificationId?: string;
  coupleId?: string;
  recipientId?: string;
  type?: string;
  title?: string;
  body?: string | null;
  href?: string | null;
};

async function getUserFromRequest(
  adminSupabase: NonNullable<ReturnType<typeof getAdminClient>>,
  request: Request
) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const {
    data: { user },
  } = await adminSupabase.auth.getUser(token);

  return user;
}

async function sendStoredNotification(
  adminSupabase: NonNullable<ReturnType<typeof getAdminClient>>,
  notificationId: string,
  actorId: string
) {
  const { data: notification, error } = await adminSupabase
    .from("couple_notifications")
    .select("id, couple_id, recipient_id, actor_id, title, body, href, type")
    .eq("id", notificationId)
    .maybeSingle<CoupleNotification>();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!notification) {
    return Response.json({ error: "Notification not found" }, { status: 404 });
  }

  if (notification.actor_id !== actorId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await sendPushToUser(notification.recipient_id, {
    title: notification.title,
    body: notification.body,
    href: notification.href,
    tag: notification.type,
  });

  return Response.json({ ok: true, ...result });
}

async function sendDirectNotification(
  adminSupabase: NonNullable<ReturnType<typeof getAdminClient>>,
  payload: PushSendRequest,
  actorId: string
) {
  if (!payload.coupleId || !payload.recipientId || !payload.title || !payload.type) {
    return Response.json({ error: "Missing push payload" }, { status: 400 });
  }

  const { data: couple, error } = await adminSupabase
    .from("couples")
    .select("id, partner_one_id, partner_two_id")
    .eq("id", payload.coupleId)
    .maybeSingle<Couple>();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const coupleUserIds = [couple?.partner_one_id, couple?.partner_two_id].filter(Boolean);
  const actorBelongsToCouple = coupleUserIds.includes(actorId);
  const recipientBelongsToCouple = coupleUserIds.includes(payload.recipientId);

  if (!couple || !actorBelongsToCouple || !recipientBelongsToCouple) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await sendPushToUser(payload.recipientId, {
    title: payload.title,
    body: payload.body || null,
    href: payload.href || null,
    tag: payload.type,
  });

  return Response.json({ ok: true, ...result });
}

export async function POST(request: Request) {
  const adminSupabase = getAdminClient();
  if (!adminSupabase) {
    return Response.json({ error: "Supabase admin is not configured" }, { status: 500 });
  }

  const user = await getUserFromRequest(adminSupabase, request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as PushSendRequest;

  if (payload.notificationId) {
    return sendStoredNotification(adminSupabase, payload.notificationId, user.id);
  }

  return sendDirectNotification(adminSupabase, payload, user.id);
}
