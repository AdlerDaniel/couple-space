"use client";

import { useSyncExternalStore } from "react";
import {
  dashboardAccentEventName,
  dashboardAccentStorageKey,
  dashboardThemeAccents,
} from "@/lib/dashboardTheme";

function getDashboardAccentSnapshot() {
  if (typeof window === "undefined") {
    return dashboardThemeAccents.rose;
  }

  return (
    localStorage.getItem(dashboardAccentStorageKey) || dashboardThemeAccents.rose
  );
}

function subscribeToDashboardAccent(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener(dashboardAccentEventName, onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener(dashboardAccentEventName, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function useDashboardAccent() {
  return useSyncExternalStore(
    subscribeToDashboardAccent,
    getDashboardAccentSnapshot,
    () => dashboardThemeAccents.rose
  );
}
