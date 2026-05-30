"use client";

import {
  getPushPermissionState,
  getPushUnavailableMessage,
  sendTestBrowserPush,
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
  if (state === "checking") return "Проверяем push...";
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
  const [state, setState] = useState<PushSupportState>("checking");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const timerId = window.setTimeout(() => {
      getPushPermissionState().then((nextState) => {
        if (isMounted) setState(nextState);
      });
    }, 0);

    return () => {
      isMounted = false;
      window.clearTimeout(timerId);
    };
  }, []);

  async function handleClick() {
    if (state === "checking") {
      setState(await getPushPermissionState());
      return;
    }

    if (state === "unsupported" || state === "blocked" || state === "not-configured") {
      showAppToast({
        title:
          state === "blocked"
            ? "Уведомления заблокированы"
            : state === "not-configured"
              ? "Push не настроены"
              : "Push недоступны",
        text:
          state === "blocked"
            ? "Разрешите уведомления в настройках браузера."
            : state === "not-configured"
              ? "На сервере ещё не применились push-ключи."
              : getPushUnavailableMessage(),
        accent,
      });
      return;
    }

    setIsBusy(true);
    try {
      if (state === "enabled") {
        await unsubscribeFromBrowserPush();
        setState(await getPushPermissionState());
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
      setState(await getPushPermissionState());
      showAppToast({
        title: "Не удалось включить push",
        text: error instanceof Error ? error.message : "Попробуйте ещё раз.",
        accent,
      });
    } finally {
      setIsBusy(false);
    }
  }

  async function handleTestClick() {
    setIsBusy(true);
    try {
      const result = await sendTestBrowserPush();
      showAppToast({
        title: "Тест отправлен",
        text: `Сервер отправил push на устройств: ${result.sent}.`,
        accent,
      });
    } catch (error) {
      setState(await getPushPermissionState());
      showAppToast({
        title: "Тест не отправился",
        text: error instanceof Error ? error.message : "Попробуйте ещё раз.",
        accent,
      });
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isBusy || state === "checking"}
        className={
          className ||
          "w-full rounded-2xl bg-white/70 px-4 py-3 text-left font-black shadow-inner transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-55 dark:bg-white/10 dark:hover:bg-white/15"
        }
      >
        {getButtonText(state, isBusy)}
      </button>
      {state === "enabled" && (
        <button
          type="button"
          onClick={handleTestClick}
          disabled={isBusy}
          className="w-full rounded-2xl bg-white/70 px-4 py-3 text-left text-sm font-black shadow-inner transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-55 dark:bg-white/10 dark:hover:bg-white/15"
        >
          Отправить тест
        </button>
      )}
    </div>
  );
}
