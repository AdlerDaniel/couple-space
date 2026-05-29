"use client";

import Link from "next/link";
import { useEffect } from "react";

type AppRouteErrorFallbackProps = {
  error: Error & { digest?: string };
  unstable_retry?: () => void;
  reset?: () => void;
  global?: boolean;
};

function reloadPage() {
  window.location.reload();
}

export default function AppRouteErrorFallback({
  error,
  unstable_retry,
  reset,
  global = false,
}: AppRouteErrorFallbackProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const retry = unstable_retry || reset;

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
          Обычно это происходит после обновления сайта, когда открытая вкладка ещё держит старую версию интерфейса.
        </p>

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
        </div>

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
