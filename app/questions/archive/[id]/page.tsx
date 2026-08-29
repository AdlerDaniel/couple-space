"use client";

import AnswerSocialControls from "@/components/AnswerSocialControls";
import { getDailyQuestionHistory } from "@/lib/dailyQuestions";
import { createPartnerNotification } from "@/lib/notifications";
import {
  formatQuestionArchiveDate,
  getQuestionCategory,
  parseVirtualQuestionArchiveId,
  parseQuestionDate,
} from "@/lib/questionArchive";
import { supabase } from "@/lib/supabaseClient";
import { MessageCircle } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Couple = {
  id: string;
  created_at: string;
  partner_one_id: string;
  partner_two_id: string | null;
};

type CoupleProfile = {
  partner_one: string | null;
  partner_two: string | null;
  time_zone: string | null;
};

type AnswerRow = {
  id: string;
  question: string;
  answer_one: string | null;
  answer_two: string | null;
  answer_one_reactions?: Record<string, string>;
  answer_two_reactions?: Record<string, string>;
  answer_one_likes?: Record<string, boolean>;
  answer_two_likes?: Record<string, boolean>;
  favorite_answers?: Record<string, string>;
  answer_one_edited_at?: string | null;
  answer_two_edited_at?: string | null;
  date: string;
  couple_id: string;
};

const ANSWER_MAX_LENGTH = 600;

export default function QuestionArchiveDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [couple, setCouple] = useState<Couple | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [answerRecord, setAnswerRecord] = useState<AnswerRow | null>(null);
  const [draftAnswer, setDraftAnswer] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadQuestion() {
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
        .select("*")
        .or(`partner_one_id.eq.${user.id},partner_two_id.eq.${user.id}`)
        .limit(1)
        .single();

      if (coupleError || !coupleData) {
        router.push("/couple");
        return;
      }

      setCouple(coupleData);

      const { data: profileData } = await supabase
        .from("couple_profiles")
        .select("partner_one, partner_two, time_zone")
        .eq("couple_id", coupleData.id)
        .limit(1)
        .maybeSingle<CoupleProfile>();

      const virtualDateKey = parseVirtualQuestionArchiveId(params.id);
      if (virtualDateKey) {
        const timeZone = profileData?.time_zone || "Europe/Moscow";
        const historyEntry = getDailyQuestionHistory(
          new Date(coupleData.created_at),
          new Date(),
          timeZone,
        ).find((entry) => entry.dateKey === virtualDateKey);

        if (!historyEntry) {
          router.push("/questions/archive");
          return;
        }

        const { data: storedRow } = await supabase
          .from("question_answers")
          .select("*")
          .eq("couple_id", coupleData.id)
          .eq("date", historyEntry.date)
          .eq("question", historyEntry.question)
          .limit(1)
          .maybeSingle();

        setAnswerRecord(
          storedRow || {
            id: params.id,
            question: historyEntry.question,
            answer_one: null,
            answer_two: null,
            date: historyEntry.date,
            couple_id: coupleData.id,
          },
        );
        setIsLoading(false);
        return;
      }

      const { data } = await supabase
        .from("question_answers")
        .select("*")
        .eq("id", params.id)
        .eq("couple_id", coupleData.id)
        .single();

      if (!data) {
        router.push("/questions/archive");
        return;
      }

      setAnswerRecord(data);
      setIsLoading(false);
    }

    loadQuestion();
  }, [params.id, router]);

  useEffect(() => {
    if (!answerRecord || !couple || !currentUserId) return;
    if (parseVirtualQuestionArchiveId(answerRecord.id)) return;

    const isPartnerOne = currentUserId === couple.partner_one_id;
    const myAnswer = isPartnerOne ? answerRecord.answer_one : answerRecord.answer_two;
    const partnerAnswer = isPartnerOne ? answerRecord.answer_two : answerRecord.answer_one;
    if (!myAnswer || partnerAnswer) return;

    const channel = supabase
      .channel(`archive-answer-${answerRecord.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "question_answers",
          filter: `id=eq.${answerRecord.id}`,
        },
        (payload) => setAnswerRecord(payload.new as AnswerRow),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [answerRecord, couple, currentUserId]);

  async function saveArchivedAnswer() {
    const answerToSave = draftAnswer.trim();
    if (!answerRecord || !couple || !currentUserId || !answerToSave || isSaving) return;

    setIsSaving(true);
    setSaveMessage("");

    const isPartnerOne = currentUserId === couple.partner_one_id;
    const answerField = isPartnerOne ? "answer_one" : "answer_two";
    const editedAtField = isPartnerOne ? "answer_one_edited_at" : "answer_two_edited_at";
    const firstSavedAt = new Date().toISOString();
    const isVirtual = Boolean(parseVirtualQuestionArchiveId(answerRecord.id));

    let latestRecord = answerRecord;

    if (isVirtual) {
      const { data: storedRow } = await supabase
        .from("question_answers")
        .select("*")
        .eq("couple_id", couple.id)
        .eq("date", answerRecord.date)
        .eq("question", answerRecord.question)
        .limit(1)
        .maybeSingle();

      if (storedRow) latestRecord = storedRow;
    }

    const query = parseVirtualQuestionArchiveId(latestRecord.id)
      ? supabase.from("question_answers").upsert(
          {
            question: latestRecord.question,
            date: latestRecord.date,
            couple_id: couple.id,
            [answerField]: answerToSave,
            [editedAtField]: firstSavedAt,
          },
          { onConflict: "couple_id,date,question" },
        )
      : supabase
          .from("question_answers")
          .update({
            [answerField]: answerToSave,
            [editedAtField]: latestRecord[editedAtField] || firstSavedAt,
          })
          .eq("id", latestRecord.id)
          .eq("couple_id", couple.id);

    const { data, error } = await query.select().single();

    if (error || !data) {
      setSaveMessage(error?.message || "Не удалось сохранить ответ");
      setIsSaving(false);
      return;
    }

    setAnswerRecord(data);
    setDraftAnswer("");
    setSaveMessage("Ответ сохранён. Теперь ответ партнёра открыт.");
    router.replace(`/questions/archive/${data.id}`, { scroll: false });
    await createPartnerNotification(couple, currentUserId, {
      type: "question_answered",
      title: "Ответ на вопрос из архива",
      body: "Партнёр ответил на пропущенный вопрос дня.",
      href: `/questions/archive/${data.id}`,
    });
    setIsSaving(false);
  }

  if (isLoading || !answerRecord) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#e2fff2] to-[#f0fff7] px-6 pb-10 pt-28 text-[#27ae60] transition-colors dark:from-[#041f0f] dark:to-[#000e07]">
        <div className="rounded-3xl bg-white/60 p-8 font-black shadow-xl backdrop-blur-xl dark:bg-white/8">
          Загружаем вопрос...
        </div>
      </main>
    );
  }

  const isPartnerOne = currentUserId === couple?.partner_one_id;
  const myAnswer = isPartnerOne ? answerRecord.answer_one : answerRecord.answer_two;
  const partnerAnswer = isPartnerOne ? answerRecord.answer_two : answerRecord.answer_one;
  const parsedDate = parseQuestionDate(answerRecord.date);
  const category = getQuestionCategory(answerRecord.question);
  const isStoredRecord = !parseVirtualQuestionArchiveId(answerRecord.id);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f0fff7] px-4 pb-32 pt-24 text-[#14532d] transition-colors dark:bg-[#02140b] dark:text-white sm:px-6 md:pt-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(34,197,94,0.24),transparent_34%),radial-gradient(circle_at_82%_20%,rgba(20,184,166,0.18),transparent_30%),linear-gradient(135deg,#e7fff2_0%,#f4fff9_48%,#e9fff7_100%)] dark:bg-[radial-gradient(circle_at_18%_16%,rgba(34,197,94,0.16),transparent_34%),radial-gradient(circle_at_82%_20%,rgba(20,184,166,0.15),transparent_30%),linear-gradient(135deg,#03170c_0%,#062315_48%,#02100a_100%)]" />

      <section className="questions-reveal relative mx-auto max-w-5xl">
        <button
          onClick={() => router.push("/questions/archive")}
          className="mb-6 rounded-full border border-emerald-200/70 bg-white/45 px-5 py-2 text-sm font-bold text-emerald-700 shadow-lg backdrop-blur-xl transition hover:bg-emerald-50 dark:border-white/10 dark:bg-white/8 dark:text-emerald-200 dark:hover:bg-emerald-500/15"
        >
          Назад в архив
        </button>

        <div className="mb-8 text-center">
          <div className="mx-auto inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-white/70 bg-white/50 px-5 py-2 text-sm font-black text-emerald-700 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-white/8 dark:text-emerald-100">
            <span>{category}</span>
            <span className="text-emerald-700/35 dark:text-white/30">•</span>
            <span>{formatQuestionArchiveDate(parsedDate)}</span>
          </div>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-black leading-tight text-[#15803d] dark:text-white md:text-6xl">
            {answerRecord.question}
          </h1>
          <button
            type="button"
            disabled={!isStoredRecord}
            onClick={() => {
              if (isStoredRecord) {
                router.push(`/questions/discussion?answerId=${answerRecord.id}`);
              }
            }}
            className="question-summary-pill question-discussion-link mx-auto mt-5 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <MessageCircle aria-hidden="true" size={17} />
            {isStoredRecord ? "Обсудить" : "Обсуждение после ответа"}
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <article className="rounded-[2rem] border border-emerald-200/70 bg-gradient-to-br from-white/78 via-emerald-50/86 to-lime-50/75 p-6 shadow-[0_28px_90px_rgba(21,128,61,0.18)] backdrop-blur-2xl dark:border-emerald-300/10 dark:from-emerald-500/12 dark:via-white/8 dark:to-lime-500/8">
            <p className="text-sm font-black uppercase text-emerald-700/72 dark:text-emerald-200/70">
              Ваш ответ
            </p>
            <div className="mt-5 min-h-48 rounded-[1.5rem] border border-emerald-200/60 bg-white/70 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_18px_55px_rgba(21,128,61,0.1)] dark:border-white/10 dark:bg-black/20">
              {myAnswer ? (
                <p className="break-words text-lg font-semibold leading-8 text-emerald-950 dark:text-white">
                  {myAnswer}
                </p>
              ) : (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    saveArchivedAnswer();
                  }}
                >
                  <label
                    htmlFor="archived-answer"
                    className="text-sm font-black text-emerald-800 dark:text-emerald-100"
                  >
                    Добавьте ответ сейчас
                  </label>
                  <textarea
                    id="archived-answer"
                    value={draftAnswer}
                    onChange={(event) =>
                      setDraftAnswer(event.target.value.slice(0, ANSWER_MAX_LENGTH))
                    }
                    placeholder="Напишите, что вы думаете об этом вопросе..."
                    rows={5}
                    className="mt-3 w-full resize-none rounded-2xl border border-emerald-200/70 bg-white/80 px-4 py-3 text-base font-semibold leading-7 text-emerald-950 outline-none transition placeholder:text-emerald-800/35 focus:border-emerald-400 focus:shadow-[0_0_0_4px_rgba(20,184,166,0.14)] dark:border-white/10 dark:bg-white/8 dark:text-white"
                  />
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs font-bold text-emerald-800/48 dark:text-white/42">
                    <span>После сохранения откроется ответ партнёра.</span>
                    <span>{draftAnswer.length}/{ANSWER_MAX_LENGTH}</span>
                  </div>
                  <button
                    type="submit"
                    disabled={!draftAnswer.trim() || isSaving}
                    className="mt-4 w-full rounded-full bg-gradient-to-r from-[#15803d] to-[#14b8a6] px-6 py-3 font-black text-white shadow-[0_18px_55px_rgba(21,128,61,0.24)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSaving ? "Сохраняем..." : "Сохранить ответ"}
                  </button>
                </form>
              )}
            </div>
            {saveMessage && (
              <p className="mt-3 text-center text-sm font-bold text-emerald-800/70 dark:text-emerald-100/70">
                {saveMessage}
              </p>
            )}
          </article>

          <article className="rounded-[2rem] border border-cyan-200/70 bg-gradient-to-br from-white/78 via-cyan-50/88 to-teal-50/78 p-6 shadow-[0_28px_90px_rgba(20,184,166,0.18)] backdrop-blur-2xl dark:border-cyan-300/10 dark:from-cyan-500/12 dark:via-white/8 dark:to-teal-500/8">
            <p className="text-sm font-black uppercase text-cyan-700/72 dark:text-cyan-200/70">
              Ответ партнёра
            </p>
            <div className="question-partner-answer-body relative mt-5 min-h-48 overflow-visible rounded-[1.5rem] border border-cyan-200/60 bg-white/70 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_18px_55px_rgba(20,184,166,0.1)] dark:border-white/10 dark:bg-black/20">
              {myAnswer ? (
                <>
                  <p className="break-words text-lg font-semibold leading-8 text-emerald-950 dark:text-white">
                    {partnerAnswer || "Партнёр не отвечал на этот вопрос."}
                  </p>
                  {partnerAnswer && (
                    <AnswerSocialControls
                      record={answerRecord}
                      recordId={answerRecord.id}
                      currentUserId={currentUserId}
                      reactionColumn={
                        isPartnerOne ? "answer_two_reactions" : "answer_one_reactions"
                      }
                      onUpdate={setAnswerRecord}
                    />
                  )}
                </>
              ) : (
                <>
                  <div className="select-none space-y-3 blur-sm">
                    <div className="h-5 w-11/12 rounded-full bg-cyan-200/80 dark:bg-white/12" />
                    <div className="h-5 w-9/12 rounded-full bg-cyan-200/65 dark:bg-white/10" />
                    <div className="h-5 w-10/12 rounded-full bg-teal-200/65 dark:bg-white/10" />
                    <div className="h-5 w-7/12 rounded-full bg-teal-200/55 dark:bg-white/8" />
                  </div>
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/58 text-center backdrop-blur-md dark:bg-black/34">
                    <p className="text-4xl">🔒</p>
                    <p className="mt-3 text-lg font-black text-cyan-800 dark:text-white">
                      Ответ партнёра скрыт
                    </p>
                    <p className="mt-2 max-w-sm text-sm font-semibold leading-6 text-cyan-900/58 dark:text-white/48">
                      На этот вопрос сначала нужен ваш ответ.
                    </p>
                  </div>
                </>
              )}
            </div>
          </article>
        </div>

      </section>
    </main>
  );
}
