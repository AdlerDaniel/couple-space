"use client";

import {
  createVirtualQuestionArchiveId,
  formatQuestionArchiveDate,
  getQuestionArchiveGroup,
  getQuestionCategory,
  getQuestionDateKey,
  parseQuestionDate,
  questionCategories,
  type QuestionArchiveGroup,
  type QuestionCategory,
} from "@/lib/questionArchive";
import { getDailyQuestionHistory } from "@/lib/dailyQuestions";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Couple = {
  id: string;
  created_at: string;
  partner_one_id: string;
  partner_two_id: string | null;
};

type CoupleProfile = {
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
  date: string;
  couple_id: string;
};

type ArchiveRow = AnswerRow & {
  parsedDate: Date;
  category: Exclude<QuestionCategory, "Все">;
  group: QuestionArchiveGroup;
  isStored: boolean;
};

const groupOrder: QuestionArchiveGroup[] = [
  "Сегодня",
  "Вчера",
  "Эта неделя",
  "Этот месяц",
  "Раньше",
];

function readObject<TValue>(value: unknown): Record<string, TValue> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, TValue>)
    : {};
}

function getReactionBadges(
  reactions: Record<string, string> | undefined,
  likes: Record<string, boolean> | undefined,
  favorites: Record<string, string> | undefined,
  answerKey: "answer_one" | "answer_two",
) {
  const reactionCounts = Object.values(readObject<string>(reactions)).reduce<Record<string, number>>(
    (counts, reaction) => {
      if (!reaction) return counts;
      counts[reaction] = (counts[reaction] || 0) + 1;
      return counts;
    },
    {},
  );
  const likeCount = Object.values(readObject<boolean>(likes)).filter(Boolean).length;
  const favoriteCount = Object.values(readObject<string>(favorites)).filter(
    (favorite) => favorite === answerKey,
  ).length;

  return [
    ...Object.entries(reactionCounts).map(([reaction, count]) => `${reaction} ${count}`),
    likeCount > 0 ? `👍 ${likeCount}` : null,
    favoriteCount > 0 ? `⭐ ${favoriteCount}` : null,
  ].filter(Boolean) as string[];
}

export default function QuestionsArchivePage() {
  const router = useRouter();
  const [couple, setCouple] = useState<Couple | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<ArchiveRow[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<QuestionCategory>("Все");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadArchive() {
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
        .select("time_zone")
        .eq("couple_id", coupleData.id)
        .limit(1)
        .maybeSingle<CoupleProfile>();

      const timeZone = profileData?.time_zone || "Europe/Moscow";

      const { data: answerRows } = await supabase
        .from("question_answers")
        .select(
          "id, question, answer_one, answer_two, answer_one_reactions, answer_two_reactions, answer_one_likes, answer_two_likes, favorite_answers, date, couple_id",
        )
        .eq("couple_id", coupleData.id);

      const archiveRows =
        answerRows?.map((row) => {
          const parsedDate = parseQuestionDate(row.date);
          return {
            ...row,
            parsedDate,
            category: getQuestionCategory(row.question),
            group: getQuestionArchiveGroup(parsedDate),
            isStored: true,
          };
        }) || [];

      const answeredDateKeys = new Set(
        archiveRows.map((row) => getQuestionDateKey(row.parsedDate)),
      );
      const missingRows: ArchiveRow[] = getDailyQuestionHistory(
        new Date(coupleData.created_at),
        new Date(),
        timeZone,
      )
        .filter((entry) => !answeredDateKeys.has(entry.dateKey))
        .map((entry) => {
          const parsedDate = parseQuestionDate(entry.date);

          return {
            id: createVirtualQuestionArchiveId(entry.dateKey),
            question: entry.question,
            answer_one: null,
            answer_two: null,
            date: entry.date,
            couple_id: coupleData.id,
            parsedDate,
            category: getQuestionCategory(entry.question),
            group: getQuestionArchiveGroup(parsedDate),
            isStored: false,
          };
        });

      const allRows = [...archiveRows, ...missingRows];
      allRows.sort((first, second) => second.parsedDate.getTime() - first.parsedDate.getTime());
      setRows(allRows);
      setIsLoading(false);
    }

    loadArchive();
  }, [router]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesSearch =
        !normalizedSearch ||
        row.question.toLowerCase().includes(normalizedSearch) ||
        (row.answer_one || "").toLowerCase().includes(normalizedSearch) ||
        (row.answer_two || "").toLowerCase().includes(normalizedSearch);
      const matchesCategory = category === "Все" || row.category === category;

      return matchesSearch && matchesCategory;
    });
  }, [category, rows, search]);

  const groupedRows = useMemo(() => {
    return groupOrder
      .map((group) => ({
        group,
        rows: filteredRows.filter((row) => row.group === group),
      }))
      .filter((group) => group.rows.length > 0);
  }, [filteredRows]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f0fff7] px-4 pb-32 pt-24 text-[#14532d] transition-colors dark:bg-[#02140b] dark:text-white sm:px-6 md:pt-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(34,197,94,0.24),transparent_34%),radial-gradient(circle_at_82%_20%,rgba(20,184,166,0.18),transparent_30%),linear-gradient(135deg,#e7fff2_0%,#f4fff9_48%,#e9fff7_100%)] dark:bg-[radial-gradient(circle_at_18%_16%,rgba(34,197,94,0.16),transparent_34%),radial-gradient(circle_at_82%_20%,rgba(20,184,166,0.15),transparent_30%),linear-gradient(135deg,#03170c_0%,#062315_48%,#02100a_100%)]" />

      <section className="questions-reveal relative mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <button
              onClick={() => router.push("/questions")}
              className="mb-5 rounded-full border border-emerald-200/70 bg-white/45 px-5 py-2 text-sm font-bold text-emerald-700 shadow-lg backdrop-blur-xl transition hover:bg-emerald-50 dark:border-white/10 dark:bg-white/8 dark:text-emerald-200 dark:hover:bg-emerald-500/15"
            >
              Назад к вопросу дня
            </button>
            <p className="text-sm font-black uppercase tracking-wide text-emerald-600/75 dark:text-emerald-200/70">
              Архив вопросов дня
            </p>
            <h1 className="mt-3 text-5xl font-black text-[#15803d] dark:text-white md:text-7xl">
              Все вопросы вашей пары
            </h1>
            <p className="mt-4 max-w-2xl font-semibold leading-7 text-emerald-900/58 dark:text-white/48">
              Здесь есть каждый вопрос со дня создания пары — даже если вы пропустили ответ.
            </p>
          </div>
          <div className="rounded-[1.4rem] border border-white/70 bg-white/55 px-5 py-4 text-sm font-black text-emerald-700 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-white/8 dark:text-emerald-100">
            {filteredRows.length} из {rows.length} вопросов
          </div>
        </div>

        <div className="mb-8 grid gap-4 lg:grid-cols-[1fr_auto]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск по вопросам и ответам..."
            className="rounded-[1.4rem] border border-emerald-200/70 bg-white/70 px-5 py-4 text-base font-semibold text-emerald-950 shadow-[0_18px_55px_rgba(21,128,61,0.12)] outline-none transition placeholder:text-emerald-800/35 focus:border-emerald-400 focus:shadow-[0_0_0_4px_rgba(20,184,166,0.14),0_22px_70px_rgba(21,128,61,0.16)] dark:border-white/10 dark:bg-white/8 dark:text-white"
          />

          <div className="flex flex-wrap gap-2">
            {questionCategories.map((item) => (
              <button
                key={item}
                onClick={() => setCategory(item)}
                className={`rounded-full px-4 py-3 text-sm font-black shadow-lg transition ${
                  category === item
                    ? "bg-gradient-to-r from-[#15803d] to-[#14b8a6] text-white"
                    : "border border-white/70 bg-white/55 text-emerald-700 hover:bg-emerald-50 dark:border-white/10 dark:bg-white/8 dark:text-emerald-100 dark:hover:bg-emerald-500/15"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-[2rem] border border-white/70 bg-white/55 p-8 text-center font-black text-emerald-700 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-white/8 dark:text-emerald-100">
            Загружаем архив...
          </div>
        ) : groupedRows.length === 0 ? (
          <div className="rounded-[2rem] border border-white/70 bg-white/55 p-8 text-center shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-white/8">
            <p className="text-2xl font-black text-[#15803d] dark:text-white">
              Ничего не найдено
            </p>
            <p className="mt-2 font-semibold text-emerald-800/58 dark:text-white/48">
              Попробуйте изменить запрос или выбрать другую категорию.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {groupedRows.map(({ group, rows: groupRows }) => (
              <section key={group}>
                <h2 className="mb-4 text-2xl font-black text-[#15803d] dark:text-white">
                  {group}
                </h2>
                <div className="question-archive-grid grid grid-cols-2 gap-3 md:gap-4">
                  {groupRows.map((row) => {
                    const isPartnerOne = currentUserId === couple?.partner_one_id;
                    const myAnswer = isPartnerOne ? row.answer_one : row.answer_two;
                    const partnerAnswer = isPartnerOne ? row.answer_two : row.answer_one;
                    const myBadges = getReactionBadges(
                      isPartnerOne ? row.answer_one_reactions : row.answer_two_reactions,
                      isPartnerOne ? row.answer_one_likes : row.answer_two_likes,
                      row.favorite_answers,
                      isPartnerOne ? "answer_one" : "answer_two",
                    );
                    const partnerBadges = getReactionBadges(
                      isPartnerOne ? row.answer_two_reactions : row.answer_one_reactions,
                      isPartnerOne ? row.answer_two_likes : row.answer_one_likes,
                      row.favorite_answers,
                      isPartnerOne ? "answer_two" : "answer_one",
                    );

                    return (
                      <button
                        key={row.id}
                        onClick={() => router.push(`/questions/archive/${row.id}`)}
                        className="question-archive-card group rounded-[1.4rem] border border-white/70 bg-white/58 p-4 text-left shadow-[0_16px_45px_rgba(21,128,61,0.12)] backdrop-blur-xl transition hover:-translate-y-1 hover:bg-emerald-50/80 dark:border-white/10 dark:bg-white/8 dark:hover:bg-emerald-500/12 md:rounded-[2rem] md:p-5"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700 dark:bg-white/10 dark:text-emerald-100">
                            {row.category}
                          </span>
                          <span className="text-sm font-bold text-emerald-800/48 dark:text-white/42">
                            {formatQuestionArchiveDate(row.parsedDate)}
                          </span>
                        </div>
                        <h3 className="mt-4 text-xl font-black leading-snug text-[#14532d] transition group-hover:text-[#15803d] dark:text-white">
                          {row.question}
                        </h3>
                        <div className="question-archive-statuses mt-4 grid gap-2 text-sm font-bold md:grid-cols-2">
                          <div className="rounded-2xl bg-emerald-50/80 p-3 text-emerald-800 dark:bg-white/8 dark:text-emerald-100">
                            {myAnswer
                              ? "Вы ответили"
                              : row.isStored
                                ? "Можно добавить ответ"
                                : "Вопрос был пропущен — можно ответить"}
                            {myBadges.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {myBadges.map((badge) => (
                                  <span
                                    key={badge}
                                    className="rounded-full bg-white/78 px-2 py-1 text-xs shadow-sm dark:bg-white/10"
                                  >
                                    {badge}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="rounded-2xl bg-cyan-50/80 p-3 text-cyan-800 dark:bg-white/8 dark:text-cyan-100">
                            {partnerAnswer ? "Партнёр ответил" : "Партнёр не ответил"}
                            {partnerBadges.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {partnerBadges.map((badge) => (
                                  <span
                                    key={badge}
                                    className="rounded-full bg-white/78 px-2 py-1 text-xs shadow-sm dark:bg-white/10"
                                  >
                                    {badge}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
