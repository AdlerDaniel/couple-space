"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type Couple = {
  id: string;
  invite_code: string;
  partner_one_id: string;
  partner_two_id: string | null;
};

export default function CouplePage() {
  const router = useRouter();

  const [couple, setCouple] = useState<Couple | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [message, setMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    async function checkUserAndLoadCouple() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }
      setCurrentUserId(user.id);

      const { data, error } = await supabase
        .from("couples")
        .select("*")
        .or(`partner_one_id.eq.${user.id},partner_two_id.eq.${user.id}`)
        .limit(1)
        .single();

      if (error) {
        console.log(error);
        return;
      }

      if (data) {
        setCouple(data);
      }
    }

    checkUserAndLoadCouple();
  }, [router]);

  function generateInviteCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  async function createCouple() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const code = generateInviteCode();

    const { data, error } = await supabase
      .from("couples")
      .insert([
        {
          invite_code: code,
          partner_one_id: user.id,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Ошибка создания пары:", error);
      setMessage("Ошибка создания пары");
      return;
    }

    setCouple(data);
    setMessage("Пара создана ❤️");
  }

  async function joinCouple() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: foundCouple, error: findError } = await supabase
      .from("couples")
      .select("*")
      .eq("invite_code", inviteCode.trim().toUpperCase())
      .is("partner_two_id", null)
      .single();

    if (findError || !foundCouple) {
      setMessage("Код не найден или уже использован");
      return;
    }

    const { data, error } = await supabase
      .from("couples")
      .update({
        partner_two_id: user.id,
      })
      .eq("id", foundCouple.id)
      .select()
      .single();

    if (error) {
      console.error("Ошибка присоединения:", error);
      setMessage("Ошибка присоединения");
      return;
    }

    setCouple(data);
    setMessage("Вы присоединились к паре ❤️");
  }
async function leaveCouple() {
  if (!couple || !currentUserId) return;

  const updates =
    couple.partner_one_id === currentUserId
      ? { partner_one_id: null }
      : { partner_two_id: null };

  const { error } = await supabase
    .from("couples")
    .update(updates)
    .eq("id", couple.id);

  if (error) {
    console.error("Ошибка выхода из пары:", error);
    setMessage(error.message);
    return;
  }

  setCouple(null);
  setMessage("Вы покинули пару");
}
  return (
    <main className="min-h-screen bg-rose-50 px-6 pb-10 pt-28">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-8 text-5xl font-bold text-rose-600">
          ❤️ Наша пара
        </h1>

        {couple ? (
          <div className="rounded-3xl bg-white p-8 shadow-lg">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-rose-400">
              Invite-код
            </p>

            <p className="mb-6 text-5xl font-bold tracking-widest text-gray-800">
              {couple.invite_code}
            </p>

            <p className="text-gray-600">
              Отправь этот код партнёру, чтобы он присоединился к вашей паре.
            </p>
            <button
  onClick={leaveCouple}
  className="mt-6 rounded-full bg-gray-100 px-6 py-3 font-semibold text-gray-700 transition hover:bg-gray-200"
>
  Покинуть пару
</button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-3xl bg-white p-8 shadow-lg">
              <h2 className="mb-4 text-2xl font-bold text-gray-800">
                Создать пару
              </h2>

              <button
                onClick={createCouple}
                className="rounded-full bg-rose-500 px-6 py-3 font-semibold text-white transition hover:bg-rose-600"
              >
                Создать пару
              </button>
            </div>

            <div className="rounded-3xl bg-white p-8 shadow-lg">
              <h2 className="mb-4 text-2xl font-bold text-gray-800">
                Присоединиться по коду
              </h2>

              <input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Введите invite-код"
                className="mb-4 w-full rounded-2xl border border-rose-200 p-4 uppercase outline-none"
              />

              <button
                onClick={joinCouple}
                className="rounded-full bg-rose-500 px-6 py-3 font-semibold text-white transition hover:bg-rose-600"
              >
                Присоединиться
              </button>
            </div>
          </div>
        )}

        {message && (
          <p className="mt-6 text-center text-lg font-semibold text-rose-500">
            {message}
          </p>
        )}
      </div>
    </main>
  );
}