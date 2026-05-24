"use client";

import { useEffect, useState } from "react";

export const appToastEventName = "couple-space:toast";

type ToastPayload = {
  title: string;
  text?: string;
  accent?: string;
};

export function showAppToast(payload: ToastPayload) {
  window.dispatchEvent(new CustomEvent<ToastPayload>(appToastEventName, { detail: payload }));
}

export default function AppToast() {
  const [toast, setToast] = useState<ToastPayload | null>(null);

  useEffect(() => {
    let timer: number | undefined;

    function handleToast(event: Event) {
      const detail = (event as CustomEvent<ToastPayload>).detail;
      setToast(detail);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setToast(null), 2600);
    }

    window.addEventListener(appToastEventName, handleToast);

    return () => {
      window.removeEventListener(appToastEventName, handleToast);
      window.clearTimeout(timer);
    };
  }, []);

  if (!toast) {
    return null;
  }

  return (
    <div
      className="app-toast app-glass fixed right-4 top-24 z-50 max-w-sm rounded-3xl p-4 text-sm font-bold max-sm:inset-x-4 max-sm:top-4"
      style={{ color: toast.accent || "#be123c" }}
      role="status"
    >
      <p className="font-black">{toast.title}</p>
      {toast.text && <p className="mt-1 opacity-70">{toast.text}</p>}
    </div>
  );
}
