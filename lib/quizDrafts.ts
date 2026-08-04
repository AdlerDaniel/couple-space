import "client-only";

const draftVersion = 1;

type QuizDraft = {
  version: typeof draftVersion;
  userId: string;
  answers: Record<string, string>;
  updatedAt: string;
};

function quizDraftKey(coupleId: string, quizId: string, userId: string) {
  return `couple-space:quiz-draft:${coupleId}:${quizId}:${userId}`;
}

export function readQuizDraft(coupleId: string, quizId: string, userId: string) {
  try {
    const raw = window.localStorage.getItem(quizDraftKey(coupleId, quizId, userId));
    if (!raw) return null;

    const draft = JSON.parse(raw) as QuizDraft;
    if (
      draft.version !== draftVersion ||
      draft.userId !== userId ||
      !draft.answers ||
      typeof draft.answers !== "object"
    ) {
      return null;
    }

    return draft.answers;
  } catch {
    return null;
  }
}

export function writeQuizDraft(
  coupleId: string,
  quizId: string,
  userId: string,
  answers: Record<string, string>,
) {
  const draft: QuizDraft = {
    version: draftVersion,
    userId,
    answers,
    updatedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(
    quizDraftKey(coupleId, quizId, userId),
    JSON.stringify(draft),
  );
}

export function clearQuizDraft(coupleId: string, quizId: string, userId: string) {
  window.localStorage.removeItem(quizDraftKey(coupleId, quizId, userId));
}

export function clearLegacyQuizCache(coupleId: string, quizId: string) {
  window.localStorage.removeItem(`couple-space:quiz-answers:${coupleId}:${quizId}`);
  window.localStorage.removeItem(`couple-space:quiz-comments:${coupleId}:${quizId}`);
}
