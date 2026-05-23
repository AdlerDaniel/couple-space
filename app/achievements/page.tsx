"use client";

import { supabase } from "@/lib/supabaseClient";
import { buildCoupleAchievements, type AchievementStats } from "@/lib/achievements";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Couple = {
  id: string;
};

const emptyStats: AchievementStats = {
  memories: 0,
  answers: 0,
  quizzes: 0,
  tracker: 0,
};

export default function AchievementsPage() {
  const [stats, setStats] = useState<AchievementStats>(emptyStats);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCouple, setHasCouple] = useState(false);

  useEffect(() => {
    async function loadAchievements() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data: couple } = await supabase
        .from("couples")
        .select("id")
        .or(`partner_one_id.eq.${user.id},partner_two_id.eq.${user.id}`)
        .limit(1)
        .maybeSingle<Couple>();

      if (!couple) {
        setIsLoading(false);
        return;
      }

      setHasCouple(true);

      const [memories, answers, quizzes, tracker] = await Promise.all([
        supabase.from("memories").select("id", { count: "exact", head: true }).eq("couple_id", couple.id),
        supabase.from("question_answers").select("id", { count: "exact", head: true }).eq("couple_id", couple.id),
        supabase.from("quiz_answers").select("id", { count: "exact", head: true }).eq("couple_id", couple.id),
        supabase.from("tracker_events").select("id", { count: "exact", head: true }).eq("couple_id", couple.id),
      ]);

      setStats({
        memories: memories.count || 0,
        answers: answers.count || 0,
        quizzes: quizzes.count || 0,
        tracker: tracker.count || 0,
      });
      setIsLoading(false);
    }

    loadAchievements();
  }, []);

  const achievements = useMemo(() => buildCoupleAchievements(stats), [stats]);
  const unlocked = achievements.filter((item) => item.value >= item.target);
  const nextAchievements = achievements
    .filter((item) => item.value < item.target)
    .sort((first, second) => second.value / second.target - first.value / first.target);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fff7fb] px-6 text-[#9f1239] dark:bg-[#130711] dark:text-white">
        <div className="rounded-3xl bg-white/60 p-8 font-black shadow-xl dark:bg-white/8">
          Считаем достижения...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fff7fb] px-4 pb-28 pt-24 text-[#9f1239] dark:bg-[#130711] dark:text-white md:px-6 md:pt-28">
      <section className="mx-auto max-w-6xl">
        <div className="rounded-[2rem] border border-white/55 bg-white/58 p-5 shadow-[0_24px_90px_rgba(159,18,57,0.14)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/8 md:p-7">
          <p className="text-sm font-black uppercase tracking-[0.2em] opacity-60">
            Достижения
          </p>
          <h1 className="mt-2 text-4xl font-black md:text-5xl">Прогресс пары</h1>
          <p className="mt-3 max-w-2xl font-bold opacity-65">
            Видно, что уже открыто, что почти готово и какой следующий шаг даст прогресс.
          </p>
        </div>

        {!hasCouple ? (
          <div className="mt-5 rounded-[2rem] bg-white/62 p-6 text-center font-black shadow-inner dark:bg-white/8">
            Создайте пару, чтобы начать открывать достижения.
          </div>
        ) : (
          <>
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              {[
                ["Открыто", `${unlocked.length}/${achievements.length}`],
                ["Воспоминаний", stats.memories],
                ["Ответов", stats.answers],
                ["Викторин", stats.quizzes],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-white/62 p-4 text-center shadow-inner dark:bg-white/8">
                  <p className="text-3xl font-black">{value}</p>
                  <p className="mt-1 text-xs font-black uppercase tracking-wide opacity-55">{label}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              <section className="rounded-[2rem] bg-white/58 p-5 shadow-inner dark:bg-white/8">
                <h2 className="text-2xl font-black">Почти открыто</h2>
                <div className="mt-4 space-y-3">
                  {(nextAchievements.length ? nextAchievements.slice(0, 3) : achievements.slice(0, 3)).map((item) => {
                    const progress = Math.min(100, Math.round((item.value / item.target) * 100));
                    return (
                      <Link key={item.id} href={item.href} className="block rounded-2xl bg-white/65 p-4 shadow-inner transition hover:-translate-y-0.5 dark:bg-white/10">
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">{item.icon}</span>
                          <div className="min-w-0 flex-1">
                            <p className="font-black">{item.title}</p>
                            <p className="mt-1 text-sm font-semibold opacity-65">{item.text}</p>
                            <div className="mt-3 h-2 overflow-hidden rounded-full bg-rose-100 dark:bg-white/10">
                              <div className="h-full rounded-full bg-[#e11d48]" style={{ width: `${progress}%` }} />
                            </div>
                            <p className="mt-1 text-xs font-black opacity-55">{item.value} из {item.target}</p>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>

              <section className="grid gap-3 md:grid-cols-2">
                {achievements.map((item) => {
                  const isUnlocked = item.value >= item.target;
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={`rounded-[1.4rem] border p-4 shadow-inner transition hover:-translate-y-0.5 ${
                        isUnlocked
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-300/20 dark:bg-emerald-500/12 dark:text-emerald-100"
                          : "border-white/55 bg-white/62 dark:border-white/10 dark:bg-white/8"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-3xl">{isUnlocked ? item.icon : "🔒"}</span>
                        <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-black shadow-inner dark:bg-white/10">
                          {isUnlocked ? "открыто" : `${item.value}/${item.target}`}
                        </span>
                      </div>
                      <p className="mt-4 font-black">{item.title}</p>
                      <p className="mt-2 text-sm font-semibold opacity-65">{item.text}</p>
                    </Link>
                  );
                })}
              </section>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
