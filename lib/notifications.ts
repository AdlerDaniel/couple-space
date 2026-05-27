import { supabase } from "@/lib/supabaseClient";

export const notificationsUpdatedEventName = "couple-space:notifications-updated";

type CoupleLike = {
  id: string;
  partner_one_id: string;
  partner_two_id: string | null;
};

type NotificationPayload = {
  type: string;
  title: string;
  body?: string;
  href?: string;
};

type BrowserPushPayload = NotificationPayload & {
  coupleId: string;
  recipientId: string;
};

function emitNotificationsUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(notificationsUpdatedEventName));
  }
}

async function sendBrowserPush(payload: BrowserPushPayload) {
  if (typeof window === "undefined") return;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) return;

  await fetch("/api/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
  }).catch(() => undefined);
}

export function getPartnerId(couple: CoupleLike, currentUserId: string) {
  return currentUserId === couple.partner_one_id
    ? couple.partner_two_id
    : couple.partner_one_id;
}

export async function createNotification({
  coupleId,
  recipientId,
  actorId,
  type,
  title,
  body,
  href,
}: NotificationPayload & {
  coupleId: string;
  recipientId: string;
  actorId: string;
}) {
  const { error } = await supabase.from("couple_notifications").insert([
    {
      couple_id: coupleId,
      recipient_id: recipientId,
      actor_id: actorId,
      type,
      title,
      body: body || null,
      href: href || null,
    },
  ]);

  if (!error) {
    emitNotificationsUpdated();
    await sendBrowserPush({
      coupleId,
      recipientId,
      type,
      title,
      body,
      href,
    });
  }
}

export async function createPartnerNotification(
  couple: CoupleLike,
  currentUserId: string,
  payload: NotificationPayload
) {
  const partnerId = getPartnerId(couple, currentUserId);
  if (!partnerId || partnerId === currentUserId) return;

  await createNotification({
    coupleId: couple.id,
    recipientId: partnerId,
    actorId: currentUserId,
    ...payload,
  });
}

export async function createOwnNotification(
  coupleId: string,
  currentUserId: string,
  payload: NotificationPayload
) {
  await createNotification({
    coupleId,
    recipientId: currentUserId,
    actorId: currentUserId,
    ...payload,
  });
}
