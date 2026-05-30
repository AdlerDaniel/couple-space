"use client";

import { useEffect } from "react";
import { isRecoverableRouteError } from "@/lib/routeRecovery";
import { failedResourcesStorageKey, lastRouteErrorStorageKey } from "@/lib/networkDiagnostics";

const recoveryStorageKey = "couple-space:last-route-recovery";

function rememberFailedResource(url: string | null | undefined) {
  if (!url) return;

  try {
    const current = JSON.parse(sessionStorage.getItem(failedResourcesStorageKey) || "[]");
    const next = [...new Set([...(Array.isArray(current) ? current : []), url])].slice(-30);
    sessionStorage.setItem(failedResourcesStorageKey, JSON.stringify(next));
  } catch {}
}

function rememberRouteError(value: unknown) {
  const message =
    value instanceof Error
      ? `${value.name}: ${value.message}`
      : typeof value === "string"
        ? value
        : value && typeof value === "object" && "message" in value
          ? String((value as { message?: unknown }).message || "")
          : "unknown route error";

  try {
    sessionStorage.setItem(lastRouteErrorStorageKey, message);
  } catch {}
}

function getResourceUrl(target: EventTarget | null) {
  if (!target || !(target instanceof HTMLElement)) return null;
  return target.getAttribute("src") || target.getAttribute("href");
}

function recoverOnce() {
  const now = Date.now();
  const lastRecovery = Number(sessionStorage.getItem(recoveryStorageKey) || 0);

  if (now - lastRecovery < 15000) return;

  sessionStorage.setItem(recoveryStorageKey, String(now));
  window.location.reload();
}

export default function ClientRouteRecovery() {
  useEffect(() => {
    function handleError(event: ErrorEvent) {
      rememberFailedResource(getResourceUrl(event.target));

      if (isRecoverableRouteError(event.error || event.message)) {
        rememberRouteError(event.error || event.message);
        recoverOnce();
      }
    }

    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      if (isRecoverableRouteError(event.reason)) {
        rememberRouteError(event.reason);
        recoverOnce();
      }
    }

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null;
}
