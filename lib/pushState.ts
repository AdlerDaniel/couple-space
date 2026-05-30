export type PushSupportState =
  | "unsupported"
  | "not-configured"
  | "default"
  | "blocked"
  | "enabled";

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
