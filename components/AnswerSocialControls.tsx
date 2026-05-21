"use client";

import { supabase } from "@/lib/supabaseClient";
import { useState } from "react";

const reactions = ["❤️", "😂", "🥺", "👍", "👎", "😡", "😮", "🤢"];

type JsonMap = Record<string, string | boolean | undefined>;

type AnswerSocialControlsProps<TRecord extends object> = {
  record: TRecord;
  recordId: string;
  currentUserId: string | null;
  reactionColumn: string;
  likeColumn: string;
  answerKey: "answer_one" | "answer_two";
  disabled?: boolean;
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
  onUpdate,
}: AnswerSocialControlsProps<TRecord>) {
  const [isSaving, setIsSaving] = useState(false);
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

  async function updateSocial(nextPatch: Record<string, JsonMap>) {
    if (!currentUserId || disabled) return;

    setIsSaving(true);

    const { data, error } = await supabase
      .from("question_answers")
      .update(nextPatch)
      .eq("id", recordId)
      .select()
      .single();

    if (!error && data) {
      onUpdate(data as TRecord);
    }

    setIsSaving(false);
  }

  function toggleReaction(reaction: string) {
    if (!currentUserId) return;

    const currentReactions = readMap(socialRecord[reactionColumn]);
    const nextReactions = {
      ...currentReactions,
      [currentUserId]: userReaction === reaction ? undefined : reaction,
    };

    if (!nextReactions[currentUserId]) {
      delete nextReactions[currentUserId];
    }

    updateSocial({ [reactionColumn]: nextReactions });
  }

  function toggleLike() {
    if (!currentUserId) return;

    const currentLikes = readMap(socialRecord[likeColumn]);
    const nextLikes = {
      ...currentLikes,
      [currentUserId]: hasLiked ? undefined : true,
    };

    if (!nextLikes[currentUserId]) {
      delete nextLikes[currentUserId];
    }

    updateSocial({ [likeColumn]: nextLikes });
  }

  function toggleFavorite() {
    if (!currentUserId) return;

    const currentFavorites = readMap(socialRecord.favorite_answers);
    const nextFavorites = {
      ...currentFavorites,
      [currentUserId]: isFavorite ? undefined : answerKey,
    };

    if (!nextFavorites[currentUserId]) {
      delete nextFavorites[currentUserId];
    }

    updateSocial({ favorite_answers: nextFavorites });
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        {reactions.map((reaction) => (
          <button
            key={reaction}
            type="button"
            onClick={() => toggleReaction(reaction)}
            disabled={disabled || isSaving}
            className={`grid h-10 w-10 place-items-center rounded-full border text-lg shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 ${
              userReaction === reaction
                ? "border-emerald-300 bg-emerald-100 shadow-[0_10px_30px_rgba(21,128,61,0.18)] dark:border-emerald-300/30 dark:bg-emerald-300/18"
                : "border-white/70 bg-white/62 hover:bg-white/82 dark:border-white/10 dark:bg-white/8 dark:hover:bg-white/14"
            }`}
          >
            {reaction}
          </button>
        ))}
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
    </div>
  );
}
