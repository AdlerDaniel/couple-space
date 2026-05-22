"use client";

import { createPartnerNotification } from "@/lib/notifications";
import { supabase } from "@/lib/supabaseClient";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

type Couple = {
  id: string;
  partner_one_id: string;
  partner_two_id: string | null;
};

type CoupleProfile = {
  partner_one: string;
  partner_two: string;
  avatar?: string | null;
  avatar_one?: string | null;
  avatar_two?: string | null;
};

type ChatMessage = {
  id: string;
  couple_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getInitial(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "♡";
}

export default function ChatPage() {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [profile, setProfile] = useState<CoupleProfile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const partnerId = useMemo(() => {
    if (!couple || !currentUserId) return null;
    return currentUserId === couple.partner_one_id
      ? couple.partner_two_id
      : couple.partner_one_id;
  }, [couple, currentUserId]);

  const myProfile = useMemo(() => {
    if (!couple || !currentUserId || !profile) {
      return { name: "Вы", avatar: null as string | null };
    }

    const isPartnerOne = currentUserId === couple.partner_one_id;
    return {
      name: isPartnerOne ? profile.partner_one : profile.partner_two,
      avatar: isPartnerOne
        ? profile.avatar_one || profile.avatar || null
        : profile.avatar_two || profile.avatar || null,
    };
  }, [couple, currentUserId, profile]);

  const partnerProfile = useMemo(() => {
    if (!couple || !currentUserId || !profile) {
      return { name: "Партнёр", avatar: null as string | null };
    }

    const isPartnerOne = currentUserId === couple.partner_one_id;
    return {
      name: isPartnerOne ? profile.partner_two || "Партнёр" : profile.partner_one || "Партнёр",
      avatar: isPartnerOne
        ? profile.avatar_two || profile.avatar || null
        : profile.avatar_one || profile.avatar || null,
    };
  }, [couple, currentUserId, profile]);

  useEffect(() => {
    async function loadChat() {
      setIsLoading(true);
      setErrorMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setCurrentUserId(user.id);

      const { data: coupleData, error: coupleError } = await supabase
        .from("couples")
        .select("id, partner_one_id, partner_two_id")
        .or(`partner_one_id.eq.${user.id},partner_two_id.eq.${user.id}`)
        .limit(1)
        .maybeSingle<Couple>();

      if (coupleError) {
        setErrorMessage(coupleError.message);
        setIsLoading(false);
        return;
      }

      if (!coupleData) {
        setCouple(null);
        setMessages([]);
        setIsLoading(false);
        return;
      }

      setCouple(coupleData);

      const { data: profileData } = await supabase
        .from("couple_profiles")
        .select("partner_one, partner_two, avatar, avatar_one, avatar_two")
        .eq("couple_id", coupleData.id)
        .limit(1)
        .maybeSingle<CoupleProfile>();

      if (profileData) {
        setProfile(profileData);
      }

      const { data: messageData, error: messagesError } = await supabase
        .from("couple_chat_messages")
        .select("id, couple_id, sender_id, body, created_at")
        .eq("couple_id", coupleData.id)
        .order("created_at", { ascending: true })
        .limit(100);

      if (messagesError) {
        setErrorMessage(
          `${messagesError.message}. Если таблица чата ещё не создана, запустите SQL-файл supabase-chat-messages.sql в Supabase.`
        );
      } else {
        setMessages((messageData || []) as ChatMessage[]);
      }

      setIsLoading(false);
    }

    loadChat();
  }, [router]);

  useEffect(() => {
    if (!couple?.id) return;

    const channel = supabase
      .channel(`couple-chat:${couple.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "couple_chat_messages",
          filter: `couple_id=eq.${couple.id}`,
        },
        (payload) => {
          const nextMessage = payload.new as ChatMessage;
          setMessages((current) => {
            if (current.some((message) => message.id === nextMessage.id)) {
              return current;
            }

            return [...current, nextMessage].sort(
              (a, b) =>
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [couple?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  async function sendMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (!couple || !currentUserId || isSending) return;

    const body = draft.trim();
    if (!body) return;

    setIsSending(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("couple_chat_messages")
      .insert([
        {
          couple_id: couple.id,
          sender_id: currentUserId,
          body,
        },
      ])
      .select("id, couple_id, sender_id, body, created_at")
      .single<ChatMessage>();

    if (error || !data) {
      setErrorMessage(error?.message || "Не удалось отправить сообщение");
      setIsSending(false);
      return;
    }

    setMessages((current) =>
      current.some((message) => message.id === data.id) ? current : [...current, data]
    );
    setDraft("");
    setIsSending(false);

    await createPartnerNotification(couple, currentUserId, {
      type: "chat_message",
      title: "Новое сообщение",
      body: body.length > 80 ? `${body.slice(0, 80)}...` : body,
      href: "/chat",
    });
  }

  function handleDraftKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#fff1f5] via-[#fff7fb] to-[#fce7f3] px-6 pt-28 text-[#be123c] dark:from-[#19050d] dark:via-[#12040b] dark:to-black dark:text-white">
        <div className="rounded-[2rem] bg-white/55 p-8 font-black shadow-2xl backdrop-blur-xl dark:bg-white/10">
          Загружаем чат...
        </div>
      </main>
    );
  }

  if (!couple) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-[#fff1f5] via-[#fff7fb] to-[#fce7f3] px-6 pb-24 pt-28 text-[#9f1239] dark:from-[#19050d] dark:via-[#12040b] dark:to-black dark:text-white">
        <section className="mx-auto max-w-2xl rounded-[2rem] border border-white/60 bg-white/55 p-8 text-center shadow-[0_32px_110px_rgba(190,18,60,0.18)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/8">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-rose-500/70">
            Чат
          </p>
          <h1 className="mt-3 text-4xl font-black">Сначала создайте пару</h1>
          <p className="mt-4 font-semibold text-[#9f1239]/68 dark:text-white/60">
            Чат работает только для двух пользователей, которые уже находятся в одной паре.
          </p>
          <button
            onClick={() => router.push("/profile")}
            className="mt-7 rounded-full bg-[#be123c] px-7 py-4 font-black text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-[#e11d48]"
          >
            Перейти в профиль
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#fff1f5] via-[#fff7fb] to-[#fce7f3] px-4 pb-28 pt-24 text-[#831843] dark:from-[#19050d] dark:via-[#12040b] dark:to-black dark:text-white md:px-6 md:pb-10 md:pt-28">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8rem] top-24 h-80 w-80 rounded-full bg-rose-300/35 blur-3xl dark:bg-rose-500/12" />
        <div className="absolute right-[-9rem] top-48 h-96 w-96 rounded-full bg-fuchsia-300/30 blur-3xl dark:bg-fuchsia-500/12" />
      </div>

      <section className="relative mx-auto flex h-[calc(100vh-8rem)] max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-white/60 bg-white/44 shadow-[0_32px_110px_rgba(190,18,60,0.2)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/8 md:h-[calc(100vh-9rem)]">
        <header className="flex items-center justify-between gap-4 border-b border-white/50 bg-white/35 px-4 py-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/5 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative flex -space-x-3">
              {myProfile.avatar ? (
                <Image
                  src={myProfile.avatar}
                  alt={myProfile.name}
                  width={48}
                  height={48}
                  sizes="48px"
                  className="h-12 w-12 rounded-full object-cover ring-2 ring-white/80"
                />
              ) : (
                <span className="grid h-12 w-12 place-items-center rounded-full bg-rose-100 text-lg font-black shadow-inner ring-2 ring-white/80 dark:bg-white/10">
                  {getInitial(myProfile.name)}
                </span>
              )}
              {partnerProfile.avatar ? (
                <Image
                  src={partnerProfile.avatar}
                  alt={partnerProfile.name}
                  width={48}
                  height={48}
                  sizes="48px"
                  className="h-12 w-12 rounded-full object-cover ring-2 ring-white/80"
                />
              ) : (
                <span className="grid h-12 w-12 place-items-center rounded-full bg-fuchsia-100 text-lg font-black shadow-inner ring-2 ring-white/80 dark:bg-white/10">
                  {getInitial(partnerProfile.name)}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-500/70">
                Чат пары
              </p>
              <h1 className="truncate text-xl font-black md:text-2xl">
                {myProfile.name} + {partnerProfile.name}
              </h1>
            </div>
          </div>
          <span className="hidden rounded-full bg-rose-100/80 px-4 py-2 text-sm font-black text-rose-600 shadow-inner dark:bg-white/10 dark:text-rose-100 sm:block">
            Только для вас двоих
          </span>
        </header>

        {errorMessage && (
          <div className="mx-4 mt-4 rounded-2xl bg-red-100/85 px-4 py-3 text-sm font-black text-red-700 shadow-inner dark:bg-red-500/15 dark:text-red-100 md:mx-6">
            {errorMessage}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6">
          {messages.length === 0 ? (
            <div className="grid h-full place-items-center text-center">
              <div className="max-w-sm rounded-[2rem] bg-white/55 p-7 shadow-inner backdrop-blur dark:bg-white/8">
                <p className="text-5xl">💬</p>
                <h2 className="mt-4 text-2xl font-black">Начните ваш чат</h2>
                <p className="mt-3 font-semibold text-[#9f1239]/60 dark:text-white/55">
                  Первое сообщение появится здесь и сразу отобразится у партнёра.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message) => {
                const isMine = message.sender_id === currentUserId;
                return (
                  <div
                    key={message.id}
                    className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[82%] rounded-[1.35rem] px-4 py-3 shadow-lg md:max-w-[68%] ${
                        isMine
                          ? "rounded-br-md bg-gradient-to-br from-[#be123c] to-[#db2777] text-white shadow-rose-500/22"
                          : "rounded-bl-md bg-white/78 text-[#831843] shadow-rose-900/8 dark:bg-white/12 dark:text-white"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words text-base font-semibold leading-7">
                        {message.body}
                      </p>
                      <p
                        className={`mt-2 text-right text-xs font-black ${
                          isMine ? "text-white/58" : "text-[#9f1239]/45 dark:text-white/40"
                        }`}
                      >
                        {formatMessageTime(message.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <form
          onSubmit={sendMessage}
          className="border-t border-white/50 bg-white/42 p-3 backdrop-blur-xl dark:border-white/10 dark:bg-black/18 md:p-4"
        >
          {!partnerId && (
            <div className="mb-3 rounded-2xl bg-amber-100/85 px-4 py-3 text-sm font-black text-amber-800 shadow-inner dark:bg-amber-500/15 dark:text-amber-100">
              У пары пока нет второго участника. Сообщения можно написать, но партнёр увидит их после присоединения.
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleDraftKeyDown}
              placeholder="Напишите сообщение..."
              rows={1}
              maxLength={1000}
              className="max-h-36 min-h-14 flex-1 resize-none rounded-[1.35rem] border border-rose-200/70 bg-white/82 px-4 py-4 font-semibold text-[#831843] outline-none shadow-inner transition placeholder:text-rose-400/70 focus:border-[#e11d48] focus:shadow-[0_0_0_5px_rgba(225,29,72,0.14)] dark:border-white/10 dark:bg-white/10 dark:text-white dark:placeholder:text-white/38"
            />
            <button
              type="submit"
              disabled={isSending || !draft.trim()}
              className="grid h-14 w-14 shrink-0 place-items-center rounded-[1.25rem] bg-gradient-to-br from-[#be123c] to-[#db2777] text-2xl font-black text-white shadow-[0_16px_42px_rgba(190,18,60,0.34)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
              aria-label="Отправить сообщение"
            >
              ↑
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
