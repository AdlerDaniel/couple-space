"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isRecoverableRouteError } from "@/lib/routeRecovery";
import {
  formatNetworkDiagnosticReport,
  getDiagnosticSummary,
  lastRouteErrorStorageKey,
  type NetworkDiagnosticReport,
  runNetworkDiagnostics,
} from "@/lib/networkDiagnostics";

type AppRouteErrorFallbackProps = {
  error: Error & { digest?: string };
  unstable_retry?: () => void;
  reset?: () => void;
  global?: boolean;
};

function reloadPage() {
  window.location.reload();
}

function getErrorCode(error: Error & { digest?: string }) {
  return (
    error.digest ||
    error.message ||
    error.name ||
    "client-runtime-error"
  ).slice(0, 160);
}

function rememberFallbackError(error: Error & { digest?: string }) {
  try {
    sessionStorage.setItem(lastRouteErrorStorageKey, `${error.name}: ${error.message}`);
  } catch {}
}

function reloadRecoverableErrorOnce(error: Error & { digest?: string }) {
  if (!isRecoverableRouteError(error)) return false;

  const storageKey = "couple-space:error-fallback-recovery";
  const now = Date.now();
  const lastRecovery = Number(sessionStorage.getItem(storageKey) || 0);

  if (now - lastRecovery < 15000) return false;

  sessionStorage.setItem(storageKey, String(now));
  window.location.reload();
  return true;
}

export default function AppRouteErrorFallback({
  error,
  unstable_retry,
  reset,
  global = false,
}: AppRouteErrorFallbackProps) {
  const [report, setReport] = useState<NetworkDiagnosticReport | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const isRecoverable = isRecoverableRouteError(error);

  async function checkConnection() {
    setIsChecking(true);
    setCopyMessage("");
    try {
      setReport(await runNetworkDiagnostics(`${error.name}: ${error.message}`));
    } finally {
      setIsChecking(false);
    }
  }

  async function copyReport() {
    const activeReport = report || (await runNetworkDiagnostics(`${error.name}: ${error.message}`));
    const text = formatNetworkDiagnosticReport(activeReport);
    setReport(activeReport);
    await navigator.clipboard.writeText(text);
    setCopyMessage("Отчёт скопирован.");
  }

  useEffect(() => {
    console.error(error);
    rememberFallbackError(error);
    const didReload = reloadRecoverableErrorOnce(error);
    if (!didReload && isRecoverableRouteError(error)) {
      runNetworkDiagnostics(`${error.name}: ${error.message}`).then(setReport).catch(() => {});
    }
  }, [error]);

  const retry = unstable_retry || reset;
  const errorCode = getErrorCode(error);
  const helperText = isRecoverable
    ? "Похоже, браузер или VPN не загрузил часть интерфейса, Supabase или realtime-соединение. Если автообновление не помогло, запустите проверку соединения и скопируйте отчёт."
    : "Обычно это происходит после обновления сайта, когда открытая вкладка ещё держит старую версию интерфейса.";

  const content = (
    <main className="flex min-h-screen items-center justify-center bg-[#fff8ed] px-5 py-12 text-[#7c2d12] dark:bg-[#140b05] dark:text-[#ffedd5]">
      <section className="w-full max-w-xl rounded-[2rem] border border-orange-200/70 bg-white/82 p-6 text-center shadow-[0_28px_90px_rgba(194,65,12,0.18)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/8 md:p-8">
        <p className="text-sm font-black uppercase tracking-[0.18em] text-[#ea580c]/70">
          Couple Space
        </p>
        <h1 className="mt-3 text-3xl font-black text-[#c2410c] dark:text-white md:text-4xl">
          Страница не загрузилась
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm font-semibold leading-6 opacity-70 md:text-base">
          {helperText}
        </p>
        <p className="mx-auto mt-4 max-w-md break-words rounded-2xl bg-orange-50 px-4 py-3 text-xs font-bold text-[#9a3412] shadow-inner dark:bg-white/10 dark:text-orange-100">
          Код ошибки: {errorCode}
        </p>
        {report && (
          <div className="mx-auto mt-4 max-w-md rounded-2xl bg-white/70 px-4 py-3 text-left text-xs font-bold leading-5 text-[#7c2d12] shadow-inner dark:bg-white/10 dark:text-orange-100">
            <p className="font-black">Проверка: {report.classification}</p>
            <p className="mt-1 opacity-75">{getDiagnosticSummary(report.classification)}</p>
          </div>
        )}

        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={reloadPage}
            className="rounded-full bg-[#ea580c] px-5 py-3 font-black text-white shadow-lg transition hover:bg-[#f97316]"
          >
            Обновить сайт
          </button>
          <button
            type="button"
            onClick={() => retry?.()}
            className="rounded-full bg-orange-50 px-5 py-3 font-black text-[#c2410c] shadow-inner transition hover:bg-orange-100 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
          >
            Повторить
          </button>
          <button
            type="button"
            onClick={checkConnection}
            disabled={isChecking}
            className="rounded-full bg-white px-5 py-3 font-black text-[#c2410c] shadow-inner transition hover:bg-orange-50 disabled:opacity-60 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
          >
            {isChecking ? "Проверяем..." : "Проверить соединение"}
          </button>
          <button
            type="button"
            onClick={() => {
              copyReport().catch(() => setCopyMessage("Не удалось скопировать отчёт."));
            }}
            className="rounded-full bg-[#7c2d12] px-5 py-3 font-black text-white shadow-lg transition hover:bg-[#9a3412]"
          >
            Скопировать отчёт
          </button>
        </div>
        {copyMessage && (
          <p className="mt-3 text-xs font-bold opacity-70">{copyMessage}</p>
        )}

        <Link
          href="/"
          className="mt-3 inline-flex rounded-full px-5 py-3 text-sm font-black text-[#c2410c] underline underline-offset-4 dark:text-orange-100"
        >
          На главную
        </Link>
      </section>
    </main>
  );

  if (!global) return content;

  return (
    <html lang="ru">
      <body>{content}</body>
    </html>
  );
}
