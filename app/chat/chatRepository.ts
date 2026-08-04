"use client";

import { supabase } from "@/lib/supabaseClient";
import type { ChatMessage, Couple, CoupleProfile } from "./chatTypes";
import { CHAT_PAGE_SIZE, chatSelect } from "./chatUtils";

export type ChatSession =
  | { status: "unauthenticated" }
  | { status: "no-couple"; userId: string }
  | {
      status: "ready";
      userId: string;
      couple: Couple;
      profile: CoupleProfile | null;
      messages: ChatMessage[];
      hasOlderMessages: boolean;
    };

export async function fetchChatSession(): Promise<ChatSession> {
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
  if (coupleError) throw new Error(coupleError.message);
  if (!couple) return { status: "no-couple", userId: user.id };

  const [{ data: profile }, { data: messageData, error: messagesError }] = await Promise.all([
    supabase
      .from("couple_profiles")
      .select("partner_one, partner_two, avatar, avatar_one, avatar_two")
      .eq("couple_id", couple.id)
      .limit(1)
      .maybeSingle<CoupleProfile>(),
    supabase
      .from("couple_chat_messages")
      .select(chatSelect)
      .eq("couple_id", couple.id)
      .order("created_at", { ascending: false })
      .limit(CHAT_PAGE_SIZE),
  ]);
  if (messagesError) {
    throw new Error(
      `${messagesError.message}. Запустите обновлённый supabase-chat-messages.sql в Supabase.`
    );
  }

  const messages = ((messageData || []) as ChatMessage[]).reverse();
  return {
    status: "ready",
    userId: user.id,
    couple,
    profile: profile || null,
    messages,
    hasOlderMessages: messages.length === CHAT_PAGE_SIZE,
  };
}

export async function fetchOlderChatMessages(
  coupleId: string,
  before: string
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("couple_chat_messages")
    .select(chatSelect)
    .eq("couple_id", coupleId)
    .lt("created_at", before)
    .order("created_at", { ascending: false })
    .limit(CHAT_PAGE_SIZE);
  if (error) throw new Error(error.message);
  return ((data || []) as ChatMessage[]).reverse();
}

export async function markChatMessagesRead(coupleId: string, messageIds: string[]) {
  if (messageIds.length === 0) return;
  const { error } = await supabase
    .from("couple_chat_messages")
    .update({ read_at: new Date().toISOString() })
    .in("id", messageIds)
    .eq("couple_id", coupleId);
  if (error) throw new Error(error.message);
}
