"use client";

import AccentAudioPlayer from "@/components/AccentAudioPlayer";
import EmojiPicker from "@/components/EmojiPicker";
import { FluentEmoji, FluentEmojiText } from "@/components/FluentEmoji";
import { decodeMemoryMedia } from "@/lib/memoryMedia";
import { createPartnerNotification } from "@/lib/notifications";
import { supabase } from "@/lib/supabaseClient";
import { toBrowserSupabaseUrl } from "@/lib/supabaseUrls";
import { ArrowLeft, FileText, MessageCircle, Send, SmilePlus } from "lucide-react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Couple = { id: string; partner_one_id: string; partner_two_id: string | null };
type Profile = { partner_one: string | null; partner_two: string | null; avatar: string | null; avatar_one: string | null; avatar_two: string | null };
type Memory = { id: string; title: string | null; caption: string | null; text: string | null; image: string | null; is_pinned: boolean; reactions?: Record<string, string>; user_id: string; couple_id: string; created_at: string };
type Comment = { id: string; memory_id: string; user_id: string; text: string; created_at: string };

function cleanTitle(value?: string | null) {
  const title = value?.trim() || "";
  return /^(без|нет) названия$/i.test(title) ? "" : title;
}

function cleanDescription(memory?: Memory | null) {
  const description = memory?.caption?.trim() || memory?.text?.trim() || "";
  return /^без описания$/i.test(description) ? "" : description;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export default function MemoryPostPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const commentsEndRef = useRef<HTMLDivElement | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memory, setMemory] = useState<Memory | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isReactionPickerOpen, setIsReactionPickerOpen] = useState(false);
  const [message, setMessage] = useState("");
  const memoryId = Array.isArray(params.id) ? params.id[0] : params.id;

  useEffect(() => {
    let ignore = false;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      const { data: coupleData } = await supabase.from("couples").select("id, partner_one_id, partner_two_id").or(`partner_one_id.eq.${user.id},partner_two_id.eq.${user.id}`).limit(1).maybeSingle<Couple>();
      if (!coupleData) { router.replace("/couple"); return; }
      const [{ data: memoryData, error }, { data: commentData }, { data: profileData }] = await Promise.all([
        supabase.from("memories").select("id, title, caption, text, image, is_pinned, reactions, user_id, couple_id, created_at").eq("id", memoryId).eq("couple_id", coupleData.id).maybeSingle<Memory>(),
        supabase.from("memory_comments").select("id, memory_id, user_id, text, created_at").eq("memory_id", memoryId).eq("couple_id", coupleData.id).order("created_at", { ascending: true }),
        supabase.from("couple_profiles").select("partner_one, partner_two, avatar, avatar_one, avatar_two").eq("couple_id", coupleData.id).maybeSingle<Profile>(),
      ]);
      if (ignore) return;
      setCurrentUserId(user.id);
      setCouple(coupleData);
      setProfile(profileData || null);
      setMemory(memoryData || null);
      setComments((commentData || []) as Comment[]);
      if (error || !memoryData) setMessage("Воспоминание не найдено или недоступно.");
    }
    void load();
    return () => { ignore = true; };
  }, [memoryId, router]);

  useEffect(() => {
    if (!memoryId || !couple?.id) return;
    const channel = supabase
      .channel(`memory-comments:${memoryId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "memory_comments", filter: `memory_id=eq.${memoryId}` }, (payload) => {
        if (payload.eventType === "INSERT") {
          const next = payload.new as Comment;
          setComments((current) => current.some((item) => item.id === next.id) ? current : [...current, next]);
        } else if (payload.eventType === "UPDATE") {
          const next = payload.new as Comment;
          setComments((current) => current.map((item) => item.id === next.id ? next : item));
        } else if (payload.eventType === "DELETE") {
          setComments((current) => current.filter((item) => item.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [couple?.id, memoryId]);

  useEffect(() => { commentsEndRef.current?.scrollIntoView({ block: "nearest" }); }, [comments.length]);

  const media = useMemo(() => decodeMemoryMedia(memory?.image), [memory?.image]);
  const title = cleanTitle(memory?.title);
  const description = cleanDescription(memory);

  function userMeta(userId: string) {
    const isFirst = userId === couple?.partner_one_id;
    const name = (isFirst ? profile?.partner_one : profile?.partner_two) || (userId === currentUserId ? "Вы" : "Партнёр");
    const avatar = toBrowserSupabaseUrl((isFirst ? profile?.avatar_one : profile?.avatar_two) || profile?.avatar);
    return { name, avatar, initial: name.trim().slice(0, 1).toUpperCase() || "♡" };
  }

  async function toggleReaction(reaction: string) {
    if (!memory || !currentUserId) return;
    const previous = memory.reactions || {};
    const next = { ...previous };
    if (next[currentUserId] === reaction) delete next[currentUserId]; else next[currentUserId] = reaction;
    setMemory({ ...memory, reactions: next });
    setIsReactionPickerOpen(false);
    const { error } = await supabase.from("memories").update({ reactions: next }).eq("id", memory.id).eq("couple_id", memory.couple_id);
    if (error) { setMemory({ ...memory, reactions: previous }); setMessage("Не удалось сохранить реакцию."); }
  }

  async function sendComment(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim().slice(0, 1000);
    if (!text || !memory || !couple || !currentUserId || isSending) return;
    setIsSending(true);
    const { data, error } = await supabase.from("memory_comments").insert([{ memory_id: memory.id, couple_id: couple.id, user_id: currentUserId, text }]).select("id, memory_id, user_id, text, created_at").single<Comment>();
    if (error || !data) setMessage("Не удалось отправить комментарий.");
    else {
      setComments((current) => current.some((item) => item.id === data.id) ? current : [...current, data]);
      setDraft("");
      await createPartnerNotification(couple, currentUserId, { type: "memory_comment", title: "Комментарий к воспоминанию", body: text, href: `/memories/${memory.id}` }).catch(() => undefined);
    }
    setIsSending(false);
  }

  if (!memory) {
    return <main className="memory-post-page min-h-screen bg-[#eff6ff] px-4 pb-24 pt-24 text-[#172554] dark:bg-[#020617] dark:text-white"><div className="mx-auto max-w-5xl rounded-[2rem] bg-white/70 p-8 text-center font-black shadow-xl dark:bg-white/8">{message || "Загружаем воспоминание…"}</div></main>;
  }

  const author = userMeta(memory.user_id);
  const reactions = Array.from(new Set(Object.values(memory.reactions || {})));

  return (
    <main className="memory-post-page min-h-screen bg-[radial-gradient(circle_at_15%_8%,rgba(37,99,235,0.17),transparent_34%),#eff6ff] px-3 pb-24 pt-20 text-[#172554] dark:bg-[radial-gradient(circle_at_15%_8%,rgba(37,99,235,0.14),transparent_34%),#020617] dark:text-white md:px-6 md:pt-28">
      <div className="mx-auto max-w-6xl">
        <button type="button" onClick={() => router.back()} className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-200/70 bg-white/80 px-4 py-2 text-sm font-black text-[#2563eb] shadow-sm dark:border-white/10 dark:bg-white/8 dark:text-blue-100"><ArrowLeft size={18} />Назад</button>
        <section className="memory-post-layout overflow-hidden rounded-[1.6rem] border border-blue-100/80 bg-white/88 shadow-[0_30px_90px_rgba(30,64,175,0.17)] backdrop-blur-xl dark:border-white/10 dark:bg-[#101c36]/96 lg:grid lg:min-h-[36rem] lg:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.75fr)]">
          <article className="memory-post-media flex min-h-[20rem] min-w-0 flex-col justify-center bg-[#e7efff] dark:bg-[#071124]">
            {media.photoUrl && <Image src={media.photoUrl} alt={title || "Воспоминание"} width={1400} height={1200} sizes="(min-width: 1024px) 65vw, 100vw" className="max-h-[70dvh] w-full object-contain" unoptimized />}
            {media.voiceUrl && <div className="w-full p-5 sm:p-8"><AccentAudioPlayer src={media.voiceUrl} accent="#2563eb" label="Голосовое воспоминание" className="memory-post-audio" /></div>}
            {(media.attachments || []).map((attachment, index) => attachment.type === "image" ? <Image key={`${attachment.url}-${index}`} src={attachment.url} alt={attachment.name} width={1200} height={900} className="max-h-[60dvh] w-full object-contain" unoptimized /> : attachment.type === "video" ? <video key={`${attachment.url}-${index}`} src={attachment.url} controls playsInline className="max-h-[60dvh] w-full bg-black" /> : attachment.type === "audio" ? <div key={`${attachment.url}-${index}`} className="p-5"><AccentAudioPlayer src={attachment.url} accent="#2563eb" label={attachment.name} /></div> : <a key={`${attachment.url}-${index}`} href={attachment.url} target="_blank" rel="noreferrer" className="m-5 flex items-center gap-2 rounded-2xl bg-white/80 p-4 font-black text-[#2563eb] dark:bg-white/8 dark:text-blue-100"><FileText size={20} />{attachment.name}</a>)}
            {!media.photoUrl && !media.voiceUrl && !(media.attachments || []).length && <div className="grid min-h-[22rem] place-items-center p-8 text-center text-[#2563eb]/45"><MessageCircle size={48} /></div>}
          </article>

          <aside className="memory-post-comments flex min-h-[28rem] min-w-0 flex-col border-t border-blue-100/80 dark:border-white/10 lg:border-l lg:border-t-0">
            <header className="flex items-center gap-3 border-b border-blue-100/80 p-4 dark:border-white/10">
              {author.avatar ? <Image src={author.avatar} alt={author.name} width={42} height={42} className="h-10 w-10 rounded-full object-cover" unoptimized /> : <span className="grid h-10 w-10 place-items-center rounded-full bg-[#2563eb] font-black text-white">{author.initial}</span>}
              <div className="min-w-0"><p className="truncate font-black">{author.name}</p><p className="text-xs font-bold opacity-45">{formatDate(memory.created_at)}</p></div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {(title || description) && <div className="mb-5 flex gap-3">{author.avatar ? <Image src={author.avatar} alt="" width={34} height={34} className="h-8 w-8 rounded-full object-cover" unoptimized /> : <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-100 text-xs font-black text-[#2563eb] dark:bg-white/10 dark:text-white">{author.initial}</span>}<div className="min-w-0"><p className="text-sm"><span className="mr-2 font-black">{author.name}</span>{title && <span className="font-black"><FluentEmojiText>{title}</FluentEmojiText></span>}</p>{description && <p className="mt-1 whitespace-pre-wrap break-words text-sm font-semibold leading-5 opacity-68"><FluentEmojiText>{description}</FluentEmojiText></p>}</div></div>}
              <div className="space-y-4">
                {comments.map((comment) => { const meta = userMeta(comment.user_id); return <div key={comment.id} className="flex gap-3">{meta.avatar ? <Image src={meta.avatar} alt={meta.name} width={34} height={34} className="h-8 w-8 rounded-full object-cover" unoptimized /> : <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-100 text-xs font-black text-[#2563eb] dark:bg-white/10 dark:text-white">{meta.initial}</span>}<div className="min-w-0"><p className="break-words text-sm"><span className="mr-2 font-black">{meta.name}</span><FluentEmojiText>{comment.text}</FluentEmojiText></p><p className="mt-1 text-[10px] font-bold opacity-38">{formatDate(comment.created_at)}</p></div></div>; })}
                {!comments.length && <p className="py-8 text-center text-sm font-bold opacity-42">Комментариев пока нет</p>}
                <div ref={commentsEndRef} />
              </div>
            </div>

            <div className="relative border-t border-blue-100/80 p-3 dark:border-white/10">
              <div className="mb-2 flex min-h-8 flex-wrap items-center gap-1.5">
                {reactions.map((reaction) => <button key={reaction} type="button" onClick={() => void toggleReaction(reaction)} className={`inline-flex h-8 items-center gap-1 rounded-full border px-2 ${memory.reactions?.[currentUserId || ""] === reaction ? "border-blue-300 bg-blue-100 dark:bg-blue-500/22" : "border-blue-100 bg-blue-50 dark:border-white/10 dark:bg-white/8"}`}><FluentEmoji emoji={reaction} size={20} decorative /><span className="text-[10px] font-black">{Object.values(memory.reactions || {}).filter((item) => item === reaction).length}</span></button>)}
                <button type="button" onPointerDown={(event) => event.preventDefault()} onClick={() => setIsReactionPickerOpen((current) => !current)} className="grid h-8 w-8 place-items-center rounded-full border border-blue-200 bg-blue-50 text-[#2563eb] dark:border-white/10 dark:bg-white/8 dark:text-blue-100" aria-label="Добавить реакцию"><SmilePlus size={17} /></button>
              </div>
              {isReactionPickerOpen && <EmojiPicker tone="blue" compact selectedEmoji={memory.reactions?.[currentUserId || ""]} onSelect={(reaction) => void toggleReaction(reaction)} className="absolute bottom-[5.8rem] left-2 right-2 z-30" />}
              <form onSubmit={sendComment} className="flex items-center gap-2">
                <input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1000} placeholder="Добавьте комментарий…" className="h-11 min-w-0 flex-1 rounded-full border border-blue-100 bg-blue-50/65 px-4 text-sm font-semibold outline-none focus:border-blue-400 dark:border-white/10 dark:bg-white/8" />
                <button type="submit" disabled={!draft.trim() || isSending} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#2563eb] text-white shadow-md disabled:opacity-35" aria-label="Отправить комментарий"><Send size={18} /></button>
              </form>
              {message && <p className="mt-2 text-center text-xs font-black text-rose-500">{message}</p>}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
