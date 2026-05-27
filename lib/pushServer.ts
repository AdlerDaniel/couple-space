import webPush, { type PushSubscription } from "web-push";
import { getAdminClient } from "@/lib/supabaseAdmin";

type StoredPushSubscription = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushPayload = {
  title: string;
  body?: string | null;
  href?: string | null;
  tag?: string;
};

let isConfigured = false;

export function getVapidPublicKey() {
  return process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY || "";
}

export function isPushConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY &&
      process.env.WEB_PUSH_VAPID_PRIVATE_KEY
  );
}

function configureWebPush() {
  if (isConfigured) return;

  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  const subject = process.env.WEB_PUSH_VAPID_SUBJECT || "mailto:notifications@couple-space.local";

  if (!publicKey || !privateKey) {
    throw new Error("Web Push VAPID keys are not configured.");
  }

  webPush.setVapidDetails(subject, publicKey, privateKey);
  isConfigured = true;
}

function toWebPushSubscription(subscription: StoredPushSubscription): PushSubscription {
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!isPushConfigured()) {
    return { sent: 0, skipped: true };
  }

  configureWebPush();
  const adminSupabase = getAdminClient();

  if (!adminSupabase) {
    return { sent: 0, skipped: true };
  }

  const { data: subscriptions, error } = await adminSupabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .eq("user_id", userId)
    .is("disabled_at", null)
    .returns<StoredPushSubscription[]>();

  if (error || !subscriptions?.length) {
    return { sent: 0, skipped: true };
  }

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body || "Новое событие пары",
    href: payload.href || "/notifications",
    tag: payload.tag || "couple-space",
  });

  let sent = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webPush.sendNotification(toWebPushSubscription(subscription), message);
        sent += 1;
      } catch (sendError) {
        const statusCode =
          typeof sendError === "object" && sendError && "statusCode" in sendError
            ? Number((sendError as { statusCode?: number }).statusCode)
            : 0;

        await adminSupabase
          .from("push_subscriptions")
          .update({
            disabled_at: statusCode === 404 || statusCode === 410 ? new Date().toISOString() : null,
            last_error: sendError instanceof Error ? sendError.message : "Push delivery failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", subscription.id);
      }
    })
  );

  return { sent, skipped: false };
}
