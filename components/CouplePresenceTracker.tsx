"use client";

import { supabase } from "@/lib/supabaseClient";
import { useEffect } from "react";

type Couple = { id: string };

export default function CouplePresenceTracker() {
  useEffect(() => {
    let disposed = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let heartbeat: number | null = null;

    async function connect() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || disposed) return;
      const { data: couple } = await supabase
        .from("couples")
        .select("id")
        .or(`partner_one_id.eq.${user.id},partner_two_id.eq.${user.id}`)
        .limit(1)
        .maybeSingle<Couple>();
      if (!couple || disposed) return;

      const publish = async () => {
        if (!channel || document.visibilityState === "hidden") return;
        await channel.track({
          user_id: user.id,
          online_at: new Date().toISOString(),
          active_at: new Date().toISOString(),
        });
      };

      // Presence is deliberately kept on its own topic. Reusing the chat topic
      // can return an already subscribed channel, after which Realtime rejects
      // any postgres_changes callbacks added by the chat screen.
      channel = supabase.channel(`couple-presence:${couple.id}:${user.id}`);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") void publish();
      });
      heartbeat = window.setInterval(() => void publish(), 60_000);
      const onFocus = () => void publish();
      window.addEventListener("focus", onFocus);
      document.addEventListener("visibilitychange", onFocus);

      return () => {
        window.removeEventListener("focus", onFocus);
        document.removeEventListener("visibilitychange", onFocus);
      };
    }

    let removeActivityListeners: (() => void) | undefined;
    void connect().then((cleanup) => { removeActivityListeners = cleanup; });
    return () => {
      disposed = true;
      removeActivityListeners?.();
      if (heartbeat) window.clearInterval(heartbeat);
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
