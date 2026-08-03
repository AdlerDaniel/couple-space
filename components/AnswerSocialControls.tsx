"use client";

import { PulseBurst } from "@/components/AnimeWidgets";
import EmojiPicker from "@/components/EmojiPicker";
import { FluentEmoji } from "@/components/FluentEmoji";
import { createPartnerNotification } from "@/lib/notifications";
import { supabase } from "@/lib/supabaseClient";
import { SmilePlus } from "lucide-react";
import { useEffect, useState } from "react";

type JsonMap = Record<string, string | undefined>;

type Couple = {
  id: string;
  partner_one_id: string;
  partner_two_id: string | null;
};

type AnswerSocialControlsProps<TRecord extends object> = {
  record: TRecord;
  recordId: string;
  currentUserId: string | null;
  reactionColumn: string;
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
  disabled = false,
  notificationHref = "/questions/today",
  onUpdate,
}: AnswerSocialControlsProps<TRecord>) {
  const [isSaving, setIsSaving] = useState(false);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [isReactionPickerOpen, setIsReactionPickerOpen] = useState(false);
  const [reactionBurst, setReactionBurst] = useState<{ emoji: string; key: number } | null>(null);
  const socialRecord = record as Record<string, unknown>;
  const currentReactions = readMap(socialRecord[reactionColumn]);
  const userReaction = currentUserId ? currentReactions[currentUserId] : undefined;
  const visibleReactions = Array.from(
    new Set(Object.values(currentReactions).filter((reaction): reaction is string => Boolean(reaction))),
  );

  useEffect(() => {
    if (!currentUserId) return;
    let ignore = false;

    async function loadCouple() {
      const { data } = await supabase
        .from("couples")
        .select("id, partner_one_id, partner_two_id")
        .or(`partner_one_id.eq.${currentUserId},partner_two_id.eq.${currentUserId}`)
        .limit(1)
        .maybeSingle<Couple>();

      if (!ignore && data) setCouple(data);
    }

    void loadCouple();
    return () => {
      ignore = true;
    };
  }, [currentUserId]);

  function getReactionCount(reaction: string) {
    return Object.values(currentReactions).filter((value) => value === reaction).length;
  }

  async function toggleReaction(reaction: string) {
    if (!currentUserId || disabled || isSaving) return;

    const nextReactions = {
      ...currentReactions,
      [currentUserId]: userReaction === reaction ? undefined : reaction,
    };
    if (!nextReactions[currentUserId]) delete nextReactions[currentUserId];

    setIsSaving(true);
    const { data, error } = await supabase
      .from("question_answers")
      .update({ [reactionColumn]: nextReactions })
      .eq("id", recordId)
      .select()
      .single();

    if (!error && data) {
      onUpdate(data as TRecord);
      if (userReaction !== reaction) {
        setReactionBurst((current) => ({ emoji: reaction, key: (current?.key || 0) + 1 }));
        if (couple) {
          await createPartnerNotification(couple, currentUserId, {
            type: "question_reaction",
            title: "Новая реакция",
            body: `Партнёр отреагировал ${reaction} на ваш ответ.`,
            href: notificationHref,
          });
        }
      }
    }

    setIsSaving(false);
    setIsReactionPickerOpen(false);
  }

  return (
    <div className="answer-reactions">
      <div className="answer-reactions-visible" aria-label="Реакции на ответ">
        {visibleReactions.map((reaction) => (
          <span key={reaction} className={userReaction === reaction ? "is-mine" : ""}>
            <PulseBurst trigger={reactionBurst?.emoji === reaction ? reactionBurst.key : 0} glyph="✦" />
            <FluentEmoji emoji={reaction} size={22} decorative />
            {getReactionCount(reaction) > 1 && <small>{getReactionCount(reaction)}</small>}
          </span>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setIsReactionPickerOpen((current) => !current)}
        disabled={disabled || isSaving}
        aria-label={userReaction ? "Изменить реакцию" : "Добавить реакцию"}
        aria-expanded={isReactionPickerOpen}
        title={userReaction ? "Изменить реакцию" : "Добавить реакцию"}
      >
        <SmilePlus aria-hidden="true" size={18} />
      </button>
      {isReactionPickerOpen && (
        <div className="answer-reaction-popover">
          <EmojiPicker
            selectedEmoji={userReaction}
            onSelect={(reaction) => void toggleReaction(reaction)}
            tone="emerald"
            compact
          />
        </div>
      )}
    </div>
  );
}
