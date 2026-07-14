"use client";

import { signOutAndRedirect } from "@/lib/authSession";
import { useEffect } from "react";

export default function LogoutPage() {
  useEffect(() => {
    void signOutAndRedirect();
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-[#fff1f5] via-[#fff7fb] to-[#fce7f3] px-6 text-[#be123c] dark:from-[#19050d] dark:via-[#12040b] dark:to-black dark:text-white">
      <section className="w-full max-w-sm rounded-[2rem] border border-white/55 bg-white/62 p-7 text-center shadow-[0_28px_90px_rgba(190,18,60,0.2)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/8">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#be123c] text-2xl text-white shadow-xl">
          ↗
        </div>
        <h1 className="mt-5 text-2xl font-black">Выходим из аккаунта</h1>
        <p className="mt-2 text-sm font-semibold opacity-65">
          Сейчас перенаправим на страницу входа.
        </p>
      </section>
    </main>
  );
}
