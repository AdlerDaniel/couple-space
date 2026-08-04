"use client";

import { supabase } from "@/lib/supabaseClient";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { ChatMessage } from "./chatTypes";

type UseChatRealtimeOptions = {
  coupleId?: string;
  currentUserId: string | null;
  partnerId: string | null;
  channelRef: MutableRefObject<RealtimeChannel | null>;
  typingTimeoutRef: MutableRefObject<number | null>;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setIsPartnerTyping: Dispatch<SetStateAction<boolean>>;
  setPartnerLastSeen: Dispatch<SetStateAction<string | null>>;
};

export function useChatRealtime({
  coupleId,
  currentUserId,
  partnerId,
  channelRef,
  typingTimeoutRef,
  setMessages,
  setIsPartnerTyping,
  setPartnerLastSeen,
}: UseChatRealtimeOptions) {
  useEffect(() => {
    if (!coupleId || !currentUserId) return;

    const lastSeenKey = partnerId
      ? `couple-space:last-seen:${coupleId}:${partnerId}`
      : null;
    const cachedSeenFrame = lastSeenKey
      ? window.requestAnimationFrame(() => setPartnerLastSeen(localStorage.getItem(lastSeenKey)))
      : null;

    const channel = supabase
      .channel(`couple-chat:${coupleId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "couple_chat_messages",
          filter: `couple_id=eq.${coupleId}`,
        },
        (payload) => {
          const nextMessage = payload.new as ChatMessage;
          setMessages((current) => {
            if (payload.eventType === "DELETE") {
              return current.filter((message) => message.id !== payload.old.id);
            }

            const exists = current.some((message) => message.id === nextMessage.id);
            const next = exists
              ? current.map((message) =>
                  message.id === nextMessage.id ? nextMessage : message
                )
              : [...current, nextMessage];

            return next.sort(
              (a, b) =>
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
          });
        }
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload.userId === currentUserId) return;
        setIsPartnerTyping(true);
        if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = window.setTimeout(() => setIsPartnerTyping(false), 2200);
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{
          user_id: string;
          online_at: string;
          active_at?: string;
        }>();
        const partnerPresence = Object.values(state)
          .flat()
          .find((presence) => presence.user_id === partnerId);
        const seenAt = partnerPresence?.active_at || partnerPresence?.online_at;
        if (!seenAt) return;
        setPartnerLastSeen(seenAt);
        if (lastSeenKey) localStorage.setItem(lastSeenKey, seenAt);
      })
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        const partnerLeft = leftPresences.some(
          (presence) => (presence as { user_id?: string }).user_id === partnerId
        );
        if (!partnerLeft) return;
        const seenAt = new Date().toISOString();
        setPartnerLastSeen(seenAt);
        if (lastSeenKey) localStorage.setItem(lastSeenKey, seenAt);
      })
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;
        channelRef.current = channel;
        await channel.track({
          user_id: currentUserId,
          online_at: new Date().toISOString(),
          active_at: new Date().toISOString(),
        });
      });

    return () => {
      if (cachedSeenFrame) window.cancelAnimationFrame(cachedSeenFrame);
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [
    channelRef,
    coupleId,
    currentUserId,
    partnerId,
    setIsPartnerTyping,
    setMessages,
    setPartnerLastSeen,
    typingTimeoutRef,
  ]);
}
