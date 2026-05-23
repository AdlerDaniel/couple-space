"use client";

import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Couple = {
  id: string;
  invite_code: string;
  partner_one_id: string | null;
  partner_two_id: string | null;
};

export default function InvitePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      const params = new URLSearchParams(window.location.search);
      setCode((params.get("code") || "").toUpperCase());
    });
  }, []);

  async function joinCouple() {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) {
      setMessage("Введите invite-код");
      return;
    }

    setIsSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push(`/login?next=/invite?code=${normalizedCode}`);
      return;
    }

    const { data: existingCouple } = await supabase
      .from("couples")
      .select("id")
      .or(`partner_one_id.eq.${user.id},partner_two_id.eq.${user.id}`)
      .limit(1)
      .maybeSingle();

    if (existingCouple) {
      setMessage("Вы уже состоите в паре. Покиньте текущую пару, чтобы присоединиться к другой.");
      setIsSaving(false);
      return;
    }

    const { data: foundCouple } = await supabase
      .from("couples")
      .select("*")
      .eq("invite_code", normalizedCode)
      .is("partner_two_id", null)
      .maybeSingle<Couple>();

    if (!foundCouple) {
      setMessage("Код не найден или уже использован");
      setIsSaving(false);
      return;
    }

    if (foundCouple.partner_one_id === user.id) {
      setMessage("Это ваша пара. Откройте профиль, чтобы поделиться ссылкой.");
      setIsSaving(false);
      return;
    }

    const { error } = await supabase
      .from("couples")
      .update({ partner_two_id: user.id })
      .eq("id", foundCouple.id);

    if (error) {
      setMessage(error.message);
      setIsSaving(false);
      return;
    }

    router.push("/");
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#fff7ed] via-[#fffbf5] to-[#fde7c8] px-6 pb-24 pt-28 text-[#5f2d12] dark:from-[#1c0f08] dark:via-[#0d0704] dark:to-black dark:text-white">
      <section className="mx-auto max-w-2xl rounded-[2rem] border border-white/55 bg-white/58 p-6 text-center shadow-[0_32px_110px_rgba(146,64,14,0.18)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/8 md:p-8">
        <p className="text-sm font-black uppercase tracking-[0.22em] text-[#92400e]/70 dark:text-white/55">
          Приглашение
        </p>
        <h1 className="mt-3 text-4xl font-black">Присоединиться к паре</h1>
        <p className="mx-auto mt-3 max-w-md font-semibold leading-7 text-[#92400e]/65 dark:text-white/58">
          Введите invite-код или откройте ссылку, которую прислал партнёр.
        </p>

        <input
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="INVITE-КОД"
          className="mt-7 h-16 w-full rounded-2xl border border-white/55 bg-white/78 px-5 text-center text-2xl font-black uppercase tracking-[0.35em] outline-none transition focus:border-[#d97706] focus:shadow-[0_0_0_5px_rgba(217,119,6,0.16)] dark:border-white/10 dark:bg-white/10"
        />

        <button
          type="button"
          onClick={joinCouple}
          disabled={isSaving}
          className="mt-5 w-full rounded-2xl bg-[#92400e] px-5 py-4 font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#b45309] disabled:cursor-not-allowed disabled:opacity-55"
        >
          {isSaving ? "Подключаем..." : "Присоединиться"}
        </button>

        {message && (
          <div className="mt-5 rounded-2xl bg-white/65 p-4 font-black text-[#92400e] shadow-inner dark:bg-white/10 dark:text-white">
            {message}
          </div>
        )}

        <Link
          href="/profile"
          className="mt-5 inline-flex rounded-full bg-white/70 px-5 py-3 text-sm font-black text-[#92400e] shadow-inner transition hover:bg-amber-50 dark:bg-white/10 dark:text-white"
        >
          Открыть профиль
        </Link>
      </section>
    </main>
  );
}
