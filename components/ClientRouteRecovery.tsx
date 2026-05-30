"use client";

import { useEffect } from "react";
import { isRecoverableRouteError } from "@/lib/routeRecovery";

const recoveryStorageKey = "couple-space:last-route-recovery";

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
