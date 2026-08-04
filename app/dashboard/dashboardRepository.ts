"use client";

import { supabase } from "@/lib/supabaseClient";
import type { Couple, CoupleProfile } from "./dashboardTypes";

export type DashboardSession =
  | { status: "unauthenticated" }
  | { status: "no-couple" }
  | { status: "ready"; userId: string; couple: Couple; profile: CoupleProfile };

export async function fetchDashboardSession(): Promise<DashboardSession> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "unauthenticated" };

  const { data: couple, error: coupleError } = await supabase
    .from("couples")
    .select("id, partner_one_id, partner_two_id")
    .or(`partner_one_id.eq.${user.id},partner_two_id.eq.${user.id}`)
    .limit(1)
    .maybeSingle<Couple>();
  if (coupleError || !couple) return { status: "no-couple" };

  const { data: storedProfile } = await supabase
    .from("couple_profiles")
    .select("id, partner_one, partner_two, start_date, avatar, avatar_one, avatar_two, status_one_text, status_one_emoji, status_two_text, status_two_emoji, status_updates_one, status_updates_two")
    .eq("couple_id", couple.id)
    .limit(1)
    .maybeSingle<CoupleProfile>();

  let profile = storedProfile;
  if (!profile) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const response = await fetch("/api/couple/profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ coupleId: couple.id }),
    });
    const result = (await response.json()) as { profile?: CoupleProfile; error?: string };
    if (!response.ok || !result.profile) {
      throw new Error(result.error || "Профиль ещё не создан");
    }
    profile = result.profile;
  }

  return { status: "ready", userId: user.id, couple, profile };
}
