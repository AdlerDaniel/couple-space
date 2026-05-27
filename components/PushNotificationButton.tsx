"use client";

import {
  getPushPermissionState,
  subscribeToBrowserPush,
  unsubscribeFromBrowserPush,
  type PushSupportState,
} from "@/lib/pushClient";
import { useEffect, useState } from "react";
import { showAppToast } from "./AppToast";

type PushNotificationButtonProps = {
  accent: string;
  className?: string;
};

function getButtonText(state: PushSupportState, isBusy: boolean) {
  if (isBusy) return "Настраиваем...";
  if (state === "enabled") return "Push включены";
  if (state === "blocked") return "Push заблокированы";
  if (state === "unsupported") return "Push недоступны";
  if (state === "not-configured") return "Push не настроены";
  return "Включить push";
}

export default function PushNotificationButton({
  accent,
  className,
}: PushNotificationButtonProps) {
  const [state, setState] = useState<PushSupportState>("unsupported");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setState(getPushPermissionState());
    }, 0);

    return () => window.clearTimeout(timerId);
  }, []);

  async function handleClick() {
    if (state === "unsupported" || state === "blocked" || state === "not-configured") {
      showAppToast({
        title: state === "blocked" ? "Уведомления заблокированы" : "Push недоступны",
        text:
          state === "blocked"
            ? "Разрешите уведомления в настройках браузера."
            : "Этот браузер не может получать push-уведомления.",
        accent,
      });
      return;
    }

    setIsBusy(true);
    try {
      if (state === "enabled") {
        await unsubscribeFromBrowserPush();
        setState(getPushPermissionState());
        showAppToast({
          title: "Push выключены",
          text: "Этот браузер больше не будет получать системные уведомления.",
          accent,
        });
      } else {
        await subscribeToBrowserPush();
        setState("enabled");
        showAppToast({
          title: "Push включены",
          text: "Теперь важные события пары могут приходить в браузер.",
          accent,
        });
      }
    } catch (error) {
      setState(getPushPermissionState());
      showAppToast({
        title: "Не удалось включить push",
        text: error instanceof Error ? error.message : "Попробуйте ещё раз.",
        accent,
      });
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isBusy || state === "unsupported"}
      className={
        className ||
        "w-full rounded-2xl bg-white/70 px-4 py-3 text-left font-black shadow-inner transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-55 dark:bg-white/10 dark:hover:bg-white/15"
      }
    >
      {getButtonText(state, isBusy)}
    </button>
  );
}
