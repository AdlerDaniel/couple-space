import { supabase } from "@/lib/supabaseClient";
import { resolvePushPermissionState, type PushSupportState } from "@/lib/pushState";

export type { PushSupportState };

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function canUsePushNotifications() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

async function hasBrowserPushSubscription() {
  const registration =
    (await navigator.serviceWorker.getRegistration("/")) ||
    (await navigator.serviceWorker.ready.catch(() => null));
  const subscription = await registration?.pushManager.getSubscription();

  return Boolean(subscription);
}

export async function getPushPermissionState(): Promise<PushSupportState> {
  if (!canUsePushNotifications()) return "unsupported";

  let isConfigured = false;
  try {
    await getVapidPublicKey();
    isConfigured = true;
  } catch {
    isConfigured = false;
  }

  const hasSubscription =
    Notification.permission === "granted" ? await hasBrowserPushSubscription() : false;

  return resolvePushPermissionState({
    isSupported: true,
    isConfigured,
    permission: Notification.permission,
    hasSubscription,
  });
}

async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token || null;
}

async function getVapidPublicKey() {
  const response = await fetch("/api/push/vapid-public-key");
  const data = (await response.json()) as { publicKey?: string; configured?: boolean };

  if (!data.configured || !data.publicKey) {
    throw new Error("Push-уведомления не настроены на сервере.");
  }

  return data.publicKey;
}

export async function subscribeToBrowserPush() {
  if (!canUsePushNotifications()) {
    throw new Error("Этот браузер не поддерживает push-уведомления.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Разрешение на уведомления не выдано.");
  }

  const token = await getAccessToken();
  if (!token) {
    throw new Error("Нужно войти в аккаунт.");
  }

  const publicKey = await getVapidPublicKey();
  const registration = await navigator.serviceWorker.register("/push-worker.js");
  await navigator.serviceWorker.ready;
  const existingSubscription = await registration.pushManager.getSubscription();
  const subscription =
    existingSubscription ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));

  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(subscription),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error || "Не удалось сохранить push-подписку.");
  }

  return subscription;
}

export async function unsubscribeFromBrowserPush() {
  if (!canUsePushNotifications()) return;

  const registration =
    (await navigator.serviceWorker.getRegistration("/")) ||
    (await navigator.serviceWorker.ready.catch(() => null));
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  const token = await getAccessToken();
  await subscription.unsubscribe();

  if (!token) return;

  await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
}
