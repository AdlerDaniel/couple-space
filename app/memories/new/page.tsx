"use client";

import MemoryComposer, { type CreatedMemory } from "@/components/MemoryComposer";
import { signMemoryMediaRow } from "@/lib/memoryStorage";
import { supabase } from "@/lib/supabaseClient";
import { ArrowLeft, Images } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Couple = {
  id: string;
  partner_one_id: string;
  partner_two_id: string | null;
};

export default function NewMemoryPage() {
  const router = useRouter();
  const [couple, setCouple] = useState<Couple | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [initialMemory, setInitialMemory] = useState<CreatedMemory | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let ignore = false;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data, error } = await supabase
        .from("couples")
        .select("id, partner_one_id, partner_two_id")
        .or(`partner_one_id.eq.${user.id},partner_two_id.eq.${user.id}`)
        .limit(1)
        .maybeSingle<Couple>();
      if (ignore) return;
      if (error || !data) {
        setMessage("Сначала подключите кабинет пары.");
        return;
      }
      const editId = new URLSearchParams(window.location.search).get("edit");
      if (editId) {
        setIsEditing(true);
        const { data: memoryData, error: memoryError } = await supabase
          .from("memories")
          .select("id, title, caption, text, image, is_pinned, reactions, user_id, couple_id, created_at")
          .eq("id", editId)
          .eq("couple_id", data.id)
          .maybeSingle<CreatedMemory>();
        if (memoryError || !memoryData) {
          setMessage("Не удалось открыть воспоминание для редактирования.");
          return;
        }
        const signedMemory = await signMemoryMediaRow(memoryData);
        if (ignore) return;
        setInitialMemory(signedMemory);
      }
      setCurrentUserId(user.id);
      setCouple(data);
    }
    void load();
    return () => { ignore = true; };
  }, [router]);

  return (
    <main className="memory-create-page min-h-screen bg-[radial-gradient(circle_at_15%_10%,rgba(37,99,235,0.2),transparent_32%),linear-gradient(145deg,#eff6ff,#dbeafe)] px-3 pb-28 pt-20 text-[#172554] dark:bg-[radial-gradient(circle_at_15%_10%,rgba(37,99,235,0.18),transparent_32%),linear-gradient(145deg,#020617,#0f172a)] dark:text-white sm:px-6 md:pt-28" style={{ ["--scroll-accent" as string]: "#2563eb" }}>
      <section className="mx-auto max-w-3xl">
        <header className="mb-5 flex items-center gap-3">
          <button type="button" onClick={() => router.back()} aria-label="Назад" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-blue-200 bg-white/80 text-[#2563eb] shadow-lg backdrop-blur dark:border-white/10 dark:bg-white/8 dark:text-white"><ArrowLeft size={21} /></button>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#2563eb] text-white shadow-lg"><Images size={21} /></span>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#2563eb]/60 dark:text-blue-200/60">{isEditing ? "Редактирование" : "Новый момент"}</p>
            <h1 className="truncate text-2xl font-black sm:text-3xl">{isEditing ? "Изменить воспоминание" : "Добавить воспоминание"}</h1>
          </div>
        </header>

        {message && <p className="rounded-3xl bg-white/70 p-5 text-center font-black text-[#2563eb] shadow-xl dark:bg-white/8 dark:text-blue-100">{message}</p>}
        {!message && (!couple || !currentUserId) && <div className="h-72 animate-pulse rounded-[2rem] bg-white/55 shadow-xl dark:bg-white/8" />}
        {couple && currentUserId && (!isEditing || initialMemory) && <MemoryComposer couple={couple} currentUserId={currentUserId} initialMemory={initialMemory} onCreated={(memory) => router.replace(`/memories/${memory.id}`)} />}
      </section>
    </main>
  );
}
