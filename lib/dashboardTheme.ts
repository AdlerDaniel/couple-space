export const dashboardThemeAccents = {
  rose: "#dc2626",
  emerald: "#15803d",
  ocean: "#1a73e8",
  midnight: "#5b21b6",
} as const;

export type DashboardThemeKey = keyof typeof dashboardThemeAccents;

export const dashboardAccentStorageKey = "couple-space:dashboard:active-accent";
export const dashboardAccentEventName = "couple-space:dashboard-accent-change";
