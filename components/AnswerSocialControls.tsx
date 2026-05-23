"use client";

import { createPartnerNotification } from "@/lib/notifications";
import { supabase } from "@/lib/supabaseClient";
import Image from "next/image";
import { useEffect, useState } from "react";

const reactions = ["❤️", "😂", "🥺", "👍", "👎", "😡", "😮", "🤢"];

type JsonMap = Record<string, string | boolean | undefined>;

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

type AnswerSocialControlsProps<TRecord extends object> = {
  record: TRecord;
  recordId: string;
  currentUserId: string | null;
  reactionColumn: string;
  likeColumn: string;
  answerKey: "answer_one" | "answer_two";
  disabled?: boolean;
  notificationHref?: string;
  onUpdate: (record: TRecord) => void;
};

function readMap(value: unknown): JsonMap {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonMap)
    : {};
}

export default function AnswerSocialControls<TRecord extends object>({
  record,
  recordId,
  currentUserId,
  reactionColumn,
  likeColumn,
  answerKey,
  disabled = false,
  notificationHref = "/questions/today",
  onUpdate,
}: AnswerSocialControlsProps<TRecord>) {
  const [isSaving, setIsSaving] = useState(false);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [profile, setProfile] = useState<CoupleProfile | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentMessage, setCommentMessage] = useState("");
  const socialRecord = record as Record<string, unknown>;
  const userReaction = currentUserId
    ? readMap(socialRecord[reactionColumn])[currentUserId]
    : undefined;
  const hasLiked = currentUserId
    ? Boolean(readMap(socialRecord[likeColumn])[currentUserId])
    : false;
  const favoriteAnswer = currentUserId
    ? readMap(socialRecord.favorite_answers)[currentUserId]
    : undefined;
  const isFavorite = favoriteAnswer === answerKey;
  const currentReactions = readMap(socialRecord[reactionColumn]);
  const isCurrentUsersAnswer =
    (answerKey === "answer_one" && currentUserId === couple?.partner_one_id) ||
    (answerKey === "answer_two" && currentUserId === couple?.partner_two_id);
  const shouldNotifyPartner = Boolean(couple && currentUserId && !isCurrentUsersAnswer);

  useEffect(() => {
    if (!currentUserId) return;
    let ignore = false;

    async function loadProfile() {
      const { data: coupleData } = await supabase
        .from("couples")
        .select("id, partner_one_id, partner_two_id")
        .or(`partner_one_id.eq.${currentUserId},partner_two_id.eq.${currentUserId}`)
        .limit(1)
        .maybeSingle<Couple>();

      if (!coupleData || ignore) return;
      setCouple(coupleData);

      const { data: profileData } = await supabase
        .from("couple_profiles")
        .select("partner_one, partner_two, avatar, avatar_one, avatar_two")
        .eq("couple_id", coupleData.id)
        .limit(1)
        .maybeSingle<CoupleProfile>();

      if (!ignore && profileData) setProfile(profileData);
    }

    loadProfile();

    return () => {
      ignore = true;
    };
  }, [currentUserId]);

  function getUserMeta(userId: string) {
    if (!couple) return { name: "?", avatar: null as string | null, initial: "?" };
    if (userId === couple.partner_one_id) {
      const name = profile?.partner_one || "A";
      return {
        name,
        avatar: profile?.avatar_one || profile?.avatar || null,
        initial: name.trim().slice(0, 1).toUpperCase() || "A",
      };
    }

    const name = profile?.partner_two || "B";
    return {
      name,
      avatar: profile?.avatar_two || profile?.avatar || null,
      initial: name.trim().slice(0, 1).toUpperCase() || "B",
    };
  }

  function getReactionUsers(reaction: string) {
    return Object.entries(currentReactions)
      .filter(([, value]) => value === reaction)
      .map(([userId]) => userId);
  }

  async function updateSocial(nextPatch: Record<string, JsonMap>) {
    if (!currentUserId || disabled) return false;

    setIsSaving(true);

    const { data, error } = await supabase
      .from("question_answers")
      .update(nextPatch)
      .eq("id", recordId)
      .select()
      .single();

    if (!error && data) {
      onUpdate(data as TRecord);
      setIsSaving(false);
      return true;
    }

    setIsSaving(false);
    return false;
  }

  async function notifyPartner(
    kind: "reaction" | "like" | "favorite" | "comment",
    reaction?: string,
    comment?: string,
  ) {
    if (!couple || !currentUserId || !shouldNotifyPartner) return;

    const bodyByKind = {
      reaction: `Партнёр отреагировал ${reaction || ""} на ваш ответ.`,
      like: "Партнёр отметил ваш ответ.",
      favorite: "Партнёр сохранил ваш ответ в избранное.",
      comment: comment ? `Комментарий к вашему ответу: ${comment}` : "Партнёр оставил комментарий к вашему ответу.",
    };

    await createPartnerNotification(couple, currentUserId, {
      type: kind === "comment" ? "question_comment" : "question_reaction",
      title: kind === "comment" ? "Комментарий к ответу" : "Новая реакция",
      body: bodyByKind[kind],
      href: notificationHref,
    });
  }

  async function toggleReaction(reaction: string) {
    if (!currentUserId) return;

    const nextReactions = {
      ...currentReactions,
      [currentUserId]: userReaction === reaction ? undefined : reaction,
    };

    if (!nextReactions[currentUserId]) {
      delete nextReactions[currentUserId];
    }

    const didUpdate = await updateSocial({ [reactionColumn]: nextReactions });
    if (didUpdate && userReaction !== reaction) {
      await notifyPartner("reaction", reaction);
    }
  }

  async function toggleLike() {
    if (!currentUserId) return;

    const currentLikes = readMap(socialRecord[likeColumn]);
    const nextLikes = {
      ...currentLikes,
      [currentUserId]: hasLiked ? undefined : true,
    };

    if (!nextLikes[currentUserId]) {
      delete nextLikes[currentUserId];
    }

    const didUpdate = await updateSocial({ [likeColumn]: nextLikes });
    if (didUpdate && !hasLiked) {
      await notifyPartner("like");
    }
  }

  async function toggleFavorite() {
    if (!currentUserId) return;

    const currentFavorites = readMap(socialRecord.favorite_answers);
    const nextFavorites = {
      ...currentFavorites,
      [currentUserId]: isFavorite ? undefined : answerKey,
    };

    if (!nextFavorites[currentUserId]) {
      delete nextFavorites[currentUserId];
    }

    const didUpdate = await updateSocial({ favorite_answers: nextFavorites });
    if (didUpdate && !isFavorite) {
      await notifyPartner("favorite");
    }
  }

  async function sendShortComment() {
    if (!currentUserId || !shouldNotifyPartner) return;

    const trimmedComment = commentText.trim();
    if (!trimmedComment) return;

    setIsSaving(true);
    await notifyPartner("comment", undefined, trimmedComment.slice(0, 180));
    setCommentText("");
    setCommentMessage("Комментарий отправлен партнёру");
    setIsSaving(false);
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        {reactions.map((reaction) => {
          const userIds = getReactionUsers(reaction);
          const singleUser = userIds.length === 1 ? getUserMeta(userIds[0]) : null;
          return (
            <button
              key={reaction}
              type="button"
              onClick={() => toggleReaction(reaction)}
              disabled={disabled || isSaving}
              className={`inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-full border px-2 text-lg shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 ${
                userReaction === reaction
                  ? "border-emerald-300 bg-emerald-100 shadow-[0_10px_30px_rgba(21,128,61,0.18)] dark:border-emerald-300/30 dark:bg-emerald-300/18"
                  : "border-white/70 bg-white/62 hover:bg-emerald-50/80 dark:border-white/10 dark:bg-white/8 dark:hover:bg-emerald-500/15"
              }`}
            >
              <span>{reaction}</span>
              {userIds.length > 1 ? (
                <span className="text-xs font-black text-emerald-700 dark:text-emerald-100">{userIds.length}</span>
              ) : singleUser?.avatar ? (
                <Image src={singleUser.avatar} alt={singleUser.name} width={18} height={18} sizes="18px" className="h-[18px] w-[18px] rounded-full object-cover ring-1 ring-white/80" />
              ) : singleUser ? (
                <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-white text-[9px] font-black text-emerald-700 ring-1 ring-white/80 dark:bg-black/25 dark:text-white">{singleUser.initial}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={toggleLike}
          disabled={disabled || isSaving}
          className={`rounded-full px-4 py-2 text-sm font-black shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 ${
            hasLiked
              ? "bg-gradient-to-r from-[#15803d] to-[#14b8a6] text-white"
              : "border border-white/70 bg-white/62 text-emerald-700 dark:border-white/10 dark:bg-white/8 dark:text-emerald-100"
          }`}
        >
          👍 Лайк
        </button>
        <button
          type="button"
          onClick={toggleFavorite}
          disabled={disabled || isSaving}
          className={`rounded-full px-4 py-2 text-sm font-black shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 ${
            isFavorite
              ? "bg-gradient-to-r from-amber-400 to-rose-400 text-white"
              : "border border-white/70 bg-white/62 text-emerald-700 dark:border-white/10 dark:bg-white/8 dark:text-emerald-100"
          }`}
        >
          ⭐ Любимый ответ
        </button>
      </div>

      {shouldNotifyPartner && (
        <div className="rounded-2xl border border-white/70 bg-white/54 p-3 shadow-inner dark:border-white/10 dark:bg-white/8">
          <label className="text-xs font-black uppercase tracking-wide text-emerald-700/60 dark:text-emerald-100/60">
            Короткий комментарий
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              value={commentText}
              onChange={(event) => {
                setCommentText(event.target.value);
                setCommentMessage("");
              }}
              maxLength={180}
              placeholder="Например: мне очень откликнулось"
              className="min-h-11 flex-1 rounded-full border border-emerald-200/70 bg-white/72 px-4 text-sm font-semibold text-emerald-950 outline-none transition placeholder:text-emerald-800/35 focus:border-emerald-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
            <button
              type="button"
              onClick={sendShortComment}
              disabled={disabled || isSaving || !commentText.trim()}
              className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Отправить
            </button>
          </div>
          {commentMessage && (
            <p className="mt-2 text-xs font-black text-emerald-700 dark:text-emerald-100">
              {commentMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
