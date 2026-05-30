export type PushSupportState =
  | "unsupported"
  | "not-configured"
  | "default"
  | "blocked"
  | "enabled";

export type PushUnsupportedReason =
  | "ios-browser-tab"
  | "insecure-context"
  | "service-worker-missing"
  | "push-manager-missing"
  | "notification-missing"
  | "unknown";

export type PushPermissionInput = {
  isSupported: boolean;
  isConfigured: boolean;
  permission: NotificationPermission;
  hasSubscription: boolean;
};

export function resolvePushPermissionState({
  isSupported,
  isConfigured,
  permission,
  hasSubscription,
}: PushPermissionInput): PushSupportState {
  if (!isSupported) return "unsupported";
  if (!isConfigured) return "not-configured";
  if (permission === "denied") return "blocked";
  if (permission === "granted" && hasSubscription) return "enabled";
  return "default";
}

export function getPushUnsupportedMessage(reason: PushUnsupportedReason) {
  if (reason === "ios-browser-tab") {
    return "На iPhone push работает только у сайта, добавленного на экран Домой. Откройте сайт в Safari, нажмите Поделиться, затем На экран Домой, и запускайте сайт с иконки.";
  }

  if (reason === "insecure-context") {
    return "Push работает только на защищённом HTTPS-сайте.";
  }

  if (reason === "service-worker-missing") {
    return "В этом браузере недоступен service worker, который нужен для push.";
  }

  if (reason === "push-manager-missing") {
    return "Этот браузер не поддерживает Web Push.";
  }

  if (reason === "notification-missing") {
    return "Этот браузер не поддерживает системные уведомления для сайта.";
  }

  return "Этот браузер не может получать push-уведомления.";
}
