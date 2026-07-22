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

function emitNotificationsUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(notificationsUpdatedEventName));
  }
}

async function sendBrowserPush(notificationId: string) {
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
    body: JSON.stringify({ notificationId }),
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
  type,
  title,
  body,
  href,
}: NotificationPayload & {
  coupleId: string;
  recipientId: string;
}) {
  const { data: notificationId, error } = await supabase.rpc(
    "create_couple_notification",
    {
      p_couple_id: coupleId,
      p_recipient_id: recipientId,
      p_type: type,
      p_title: title,
      p_body: body || null,
      p_href: href || null,
    }
  );

  if (!error && typeof notificationId === "string") {
    emitNotificationsUpdated();
    await sendBrowserPush(notificationId);
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
    ...payload,
  });
}
