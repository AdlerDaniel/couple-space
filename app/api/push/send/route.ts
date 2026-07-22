import { sendPushToUser } from "@/lib/pushServer";
import { enforceRateLimit, isSameOriginRequest, readJsonObject } from "@/lib/apiSecurity";
import { getAdminClient, getAuthenticatedUser } from "@/lib/supabaseAdmin";

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

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminSupabase = getAdminClient();
  if (!adminSupabase) {
    return Response.json({ error: "Supabase admin is not configured" }, { status: 500 });
  }

  const user = await getAuthenticatedUser(adminSupabase, request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = await enforceRateLimit(adminSupabase, request, {
    route: "push-send",
    identity: user.id,
    limit: 20,
    windowMs: 60_000,
  });
  if (rateLimitResponse) return rateLimitResponse;

  const parsed = await readJsonObject(request, 4 * 1024);
  if (parsed.error) return parsed.error;
  const notificationId =
    typeof parsed.data.notificationId === "string" ? parsed.data.notificationId : "";

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(notificationId)) {
    return Response.json({ error: "Invalid notification" }, { status: 400 });
  }

  return sendStoredNotification(adminSupabase, notificationId, user.id);
}
