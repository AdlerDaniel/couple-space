"use client";

import { useCallback, useEffect, useState } from "react";
import {
  formatNetworkDiagnosticReport,
  getDiagnosticSummary,
  type NetworkDiagnosticCheck,
  type NetworkDiagnosticReport,
  runNetworkDiagnostics,
} from "@/lib/networkDiagnostics";

function statusText(status: NetworkDiagnosticCheck["status"]) {
  if (status === "ok") return "Работает";
  if (status === "failed") return "Ошибка";
  return "Пропущено";
}

function statusClassName(status: NetworkDiagnosticCheck["status"]) {
  if (status === "ok") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-100";
  if (status === "failed") return "bg-red-100 text-red-700 dark:bg-red-400/15 dark:text-red-100";
  return "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-200";
}

export default function DiagnosticsPage() {
  const [report, setReport] = useState<NetworkDiagnosticReport | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [message, setMessage] = useState("");

  const checkConnection = useCallback(async () => {
    setIsChecking(true);
    setMessage("");
    try {
      setReport(await runNetworkDiagnostics());
    } finally {
      setIsChecking(false);
    }
  }, []);

  async function copyReport() {
    if (!report) return;
    await navigator.clipboard.writeText(formatNetworkDiagnosticReport(report));
    setMessage("Отчёт скопирован.");
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      checkConnection();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [checkConnection]);

  const checks = report ? Object.values(report.checks) : [];

  return (
    <main className="min-h-screen bg-[#fff8ed] px-5 pb-28 pt-24 text-[#7c2d12] dark:bg-[#140b05] dark:text-[#ffedd5]">
      <section className="mx-auto max-w-5xl">
        <div className="rounded-[1.5rem] border border-orange-200/70 bg-white/82 p-5 shadow-[0_28px_90px_rgba(194,65,12,0.14)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/8 md:p-7">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ea580c]/70">
            Couple Space
          </p>
          <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-black text-[#c2410c] dark:text-white md:text-4xl">
                Проверка соединения
              </h1>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 opacity-70 md:text-base">
                Эта страница проверяет, что браузер с текущим VPN может загрузить интерфейс, Supabase и realtime-соединение.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={checkConnection}
                disabled={isChecking}
                className="rounded-full bg-[#ea580c] px-5 py-3 font-black text-white shadow-lg transition hover:bg-[#f97316] disabled:opacity-60"
              >
                {isChecking ? "Проверяем..." : "Проверить снова"}
              </button>
              <button
                type="button"
                onClick={() => {
                  copyReport().catch(() => setMessage("Не удалось скопировать отчёт."));
                }}
                disabled={!report}
                className="rounded-full bg-orange-50 px-5 py-3 font-black text-[#c2410c] shadow-inner transition hover:bg-orange-100 disabled:opacity-60 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
              >
                Скопировать отчёт
              </button>
            </div>
          </div>
        </div>

        {report && (
          <>
            <div className="mt-5 rounded-[1.25rem] bg-white/82 p-5 shadow-inner dark:bg-white/8">
              <p className="text-sm font-black uppercase tracking-wide opacity-55">
                Итог: {report.classification}
              </p>
              <p className="mt-2 text-lg font-black text-[#c2410c] dark:text-white">
                {getDiagnosticSummary(report.classification)}
              </p>
              <div className="mt-4 grid gap-2 text-xs font-bold opacity-70 md:grid-cols-3">
                <span>Online: {report.online ? "да" : "нет"}</span>
                <span>Сеть: {report.effectiveType || "неизвестно"}</span>
                <span>Время: {new Date(report.createdAt).toLocaleString("ru-RU")}</span>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {checks.map((check) => (
                <article key={check.label} className="rounded-[1.25rem] bg-white/82 p-4 shadow-inner dark:bg-white/8">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-black text-[#7c2d12] dark:text-white">{check.label}</h2>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClassName(check.status)}`}>
                      {statusText(check.status)}
                    </span>
                  </div>
                  {check.url && <p className="mt-2 break-all text-xs font-bold opacity-55">{check.url}</p>}
                  {check.message && <p className="mt-2 text-sm font-bold text-red-700 dark:text-red-100">{check.message}</p>}
                  {typeof check.durationMs === "number" && (
                    <p className="mt-2 text-xs font-black opacity-45">{check.durationMs} мс</p>
                  )}
                </article>
              ))}
            </div>

            {report.failedResources.length > 0 && (
              <div className="mt-5 rounded-[1.25rem] bg-white/82 p-5 shadow-inner dark:bg-white/8">
                <h2 className="font-black text-[#7c2d12] dark:text-white">Проблемные ресурсы</h2>
                <div className="mt-3 grid gap-2">
                  {report.failedResources.map((resource) => (
                    <p key={resource} className="break-all rounded-xl bg-orange-50 px-3 py-2 text-xs font-bold text-[#9a3412] dark:bg-white/10 dark:text-orange-100">
                      {resource}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {message && <p className="mt-4 text-sm font-bold opacity-70">{message}</p>}
      </section>
    </main>
  );
}
