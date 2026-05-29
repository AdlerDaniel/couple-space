"use client";

import { useEffect } from "react";

const recoveryStorageKey = "couple-space:last-route-recovery";

function isRecoverableRouteError(value: unknown) {
  const message =
    value instanceof Error
      ? value.message
      : typeof value === "string"
        ? value
        : value && typeof value === "object" && "message" in value
          ? String((value as { message?: unknown }).message || "")
          : "";

  return /chunk|dynamically imported module|loading css chunk|failed to fetch|rsc|couldn.?t load/i.test(
    message,
  );
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
      if (isRecoverableRouteError(event.error || event.message)) {
        recoverOnce();
      }
    }

    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      if (isRecoverableRouteError(event.reason)) {
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
