"use client";

import { createPartnerNotification } from "@/lib/notifications";
import { supabase } from "@/lib/supabaseClient";
import { useCallback, useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";

type Couple = {
  id: string;
  partner_one_id: string;
  partner_two_id: string | null;
};

type CoupleProfile = {
  partner_one: string | null;
  partner_two: string | null;
};

type QuestionComment = {
  id: string;
  user_id: string;
  text: string;
  created_at: string;
  updated_at: string | null;
};

function getReadableName(value?: string | null, fallback = "Партнёр") {
  const name = value?.trim();
  if (!name) return fallback;
  if (/^\d{5,}$/.test(name)) return fallback;
  return name;
}

function formatCommentTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function QuestionComments({
  answerId,
  couple,
  currentUserId,
  profile,
}: {
  answerId: string;
  couple: Couple | null;
  currentUserId: string | null;
  profile?: CoupleProfile | null;
}) {
  const [comments, setComments] = useState<QuestionComment[]>([]);
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [newCommentCount, setNewCommentCount] = useState(0);
  const [partnerTypingName, setPartnerTypingName] = useState("");
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getName = useCallback(
    (userId: string) => {
      if (!couple || !currentUserId) return "Партнёр";
      if (userId === currentUserId) return "Вы";
      if (userId === couple.partner_one_id) {
        return getReadableName(profile?.partner_one, "Партнёр");
      }
      return getReadableName(profile?.partner_two, "Партнёр");
    },
    [couple, currentUserId, profile?.partner_one, profile?.partner_two],
  );

  useEffect(() => {
    let ignore = false;

    async function loadComments() {
      const { data, error } = await supabase
        .from("question_comments")
        .select("id, user_id, text, created_at, updated_at")
        .eq("question_answer_id", answerId)
        .order("created_at", { ascending: true });

      if (ignore) return;

      if (error) {
        setMessage("Запустите supabase-question-comments.sql, чтобы включить историю комментариев.");
        return;
      }

      setComments((data || []) as QuestionComment[]);
    }

    loadComments();

    const channel = supabase
      .channel(`question-comments:${answerId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "question_comments",
          filter: `question_answer_id=eq.${answerId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const next = payload.new as QuestionComment;
            setComments((current) => {
              if (current.some((comment) => comment.id === next.id)) return current;
              return [...current, next].sort(
                (first, second) =>
                  new Date(first.created_at).getTime() - new Date(second.created_at).getTime(),
              );
            });
            if (next.user_id !== currentUserId) setNewCommentCount((count) => count + 1);
          }

          if (payload.eventType === "UPDATE") {
            const next = payload.new as QuestionComment;
            setComments((current) =>
              current.map((comment) => (comment.id === next.id ? next : comment)),
            );
          }

          if (payload.eventType === "DELETE") {
            const removed = payload.old as Pick<QuestionComment, "id">;
            setComments((current) => current.filter((comment) => comment.id !== removed.id));
          }
        },
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (!payload || payload.userId === currentUserId) return;
        setPartnerTypingName(getName(payload.userId));
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setPartnerTypingName(""), 2200);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      ignore = true;
      channelRef.current = null;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      supabase.removeChannel(channel);
    };
  }, [answerId, currentUserId, getName]);

  function updateDraft(value: string) {
    setDraft(value);
    if (!currentUserId || !value.trim()) return;
    channelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: currentUserId },
    });
  }

  async function addComment() {
    if (!couple || !currentUserId || !draft.trim()) return;

    const text = draft.trim().slice(0, 500);
    const optimisticComment: QuestionComment = {
      id: crypto.randomUUID(),
      user_id: currentUserId,
      text,
      created_at: new Date().toISOString(),
      updated_at: null,
    };

    setIsSaving(true);
    setComments((current) => [...current, optimisticComment]);
    setDraft("");

    const { data, error } = await supabase
      .from("question_comments")
      .insert([
        {
          question_answer_id: answerId,
          couple_id: couple.id,
          user_id: currentUserId,
          text,
        },
      ])
      .select("id, user_id, text, created_at, updated_at")
      .single();

    if (error || !data) {
      setComments((current) => current.filter((comment) => comment.id !== optimisticComment.id));
      setMessage("Не удалось сохранить комментарий. Проверьте таблицу question_comments.");
      setIsSaving(false);
      return;
    }

    setComments((current) =>
      current.map((comment) => (comment.id === optimisticComment.id ? data : comment)),
    );

    await createPartnerNotification(couple, currentUserId, {
      type: "question_comment",
      title: "Комментарий к ответу",
      body: text,
      href: "/questions/today",
    });

    setMessage("");
    setIsSaving(false);
  }

  function startEditing(comment: QuestionComment) {
    setEditingId(comment.id);
    setEditingText(comment.text);
  }

  async function saveEdit(commentId: string) {
    if (!currentUserId || !editingText.trim()) return;

    const text = editingText.trim().slice(0, 500);
    const updatedAt = new Date().toISOString();
    const previous = comments;
    setComments((current) =>
      current.map((comment) =>
        comment.id === commentId ? { ...comment, text, updated_at: updatedAt } : comment,
      ),
    );
    setEditingId(null);
    setEditingText("");

    const { error } = await supabase
      .from("question_comments")
      .update({ text, updated_at: updatedAt })
      .eq("id", commentId)
      .eq("user_id", currentUserId);

    if (error) {
      setComments(previous);
      setMessage("Не удалось обновить комментарий.");
    }
  }

  async function deleteComment(commentId: string) {
    if (!currentUserId) return;
    const target = comments.find((comment) => comment.id === commentId);
    if (!target || target.user_id !== currentUserId) return;

    const previous = comments;
    setComments((current) => current.filter((comment) => comment.id !== commentId));
    const { error } = await supabase
      .from("question_comments")
      .delete()
      .eq("id", commentId)
      .eq("user_id", currentUserId);

    if (error) {
      setComments(previous);
      setMessage("Не удалось удалить комментарий.");
    }
  }

  return (
    <section className="question-discussion mt-6 rounded-[1.6rem] border border-white/70 bg-white/58 p-4 shadow-inner backdrop-blur-xl dark:border-white/10 dark:bg-white/8">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-black text-emerald-900 dark:text-white">
          Обсуждение {comments.length > 0 ? `· ${comments.length}` : ""}
        </h3>
        <div>
          {newCommentCount > 0 && (
            <button
              type="button"
              onClick={() => setNewCommentCount(0)}
              className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-black text-white shadow-lg"
            >
              Новых: {newCommentCount}
            </button>
          )}
        </div>
      </div>

      {comments.length > 0 && (
        <div className="question-discussion-list mt-3 space-y-2">
          {comments.map((comment) => {
            const isOwn = comment.user_id === currentUserId;
            const isEditing = editingId === comment.id;

            return (
              <div
                key={comment.id}
                className="question-discussion-comment rounded-2xl bg-emerald-50/80 p-3 shadow-inner dark:bg-white/8"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-emerald-900 dark:text-white">
                      {getName(comment.user_id)}
                    </p>
                    {isEditing ? (
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                        <input
                          value={editingText}
                          onChange={(event) => setEditingText(event.target.value)}
                          maxLength={500}
                          className="min-h-11 flex-1 rounded-full border border-emerald-200/70 bg-white/75 px-4 text-sm font-semibold text-emerald-950 outline-none transition focus:border-emerald-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => saveEdit(comment.id)}
                          className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-black text-white"
                        >
                          Сохранить
                        </button>
                      </div>
                    ) : (
                      <p className="mt-1 text-sm font-semibold leading-6 text-emerald-900/70 dark:text-white/65">
                        {comment.text}
                      </p>
                    )}
                    <p className="mt-2 text-xs font-black uppercase tracking-wide text-emerald-800/42 dark:text-white/38">
                      {formatCommentTime(comment.created_at)}
                      {comment.updated_at ? " · изменено" : ""}
                    </p>
                  </div>
                  {isOwn && !isEditing && (
                    <div className="flex shrink-0 flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => startEditing(comment)}
                        className="rounded-full bg-white/70 px-3 py-1 text-xs font-black text-emerald-700 shadow-inner dark:bg-white/10 dark:text-white"
                      >
                        Изменить
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteComment(comment.id)}
                        className="rounded-full bg-white/70 px-3 py-1 text-xs font-black text-emerald-700 shadow-inner dark:bg-white/10 dark:text-white"
                      >
                        Удалить
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {partnerTypingName && (
        <p className="mt-3 text-xs font-black uppercase tracking-wide text-emerald-700/55 dark:text-emerald-100/55">
          {partnerTypingName} пишет...
        </p>
      )}

      <div className="question-discussion-composer mt-3 flex items-center gap-2">
        <input
          value={draft}
          onChange={(event) => updateDraft(event.target.value)}
          maxLength={500}
          placeholder="Напишите короткий комментарий..."
          className="min-w-0 flex-1 rounded-full border border-emerald-200/70 bg-white/75 px-4 py-2.5 text-sm font-semibold text-emerald-950 outline-none transition placeholder:text-emerald-800/35 focus:border-emerald-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void addComment();
            }
          }}
        />
        <button
          type="button"
          onClick={addComment}
          disabled={isSaving || !draft.trim()}
          aria-label="Отправить комментарий"
          title="Отправить"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-600 text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Send aria-hidden="true" size={18} />
        </button>
      </div>

      {message && (
        <p className="mt-3 text-sm font-black text-emerald-700 dark:text-emerald-100">
          {message}
        </p>
      )}
    </section>
  );
}
