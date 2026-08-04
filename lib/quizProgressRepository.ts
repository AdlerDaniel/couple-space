import "client-only";

import { supabase } from "@/lib/supabaseClient";

export type QuizProgressRow = {
  quiz_id: string;
  user_id: string;
  answers?: Record<string, string>;
};

async function getAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

async function readApiError(response: Response, fallback: string) {
  try {
    const result = (await response.json()) as { error?: string };
    return result.error || fallback;
  } catch {
    return fallback;
  }
}

export async function fetchQuizProgress(coupleId: string, quizId?: string) {
  const query = new URLSearchParams({ coupleId });
  if (quizId) query.set("quizId", quizId);

  const response = await fetch(`/api/quizzes/progress?${query.toString()}`, {
    headers: await getAuthHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, "Не удалось загрузить прогресс викторин"));
  }

  const result = (await response.json()) as { answers?: QuizProgressRow[] };
  return result.answers || [];
}

export async function saveQuizProgress(input: {
  quizId: string;
  coupleId: string;
  answers: Record<string, string>;
}) {
  const response = await fetch("/api/quizzes/progress", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await getAuthHeaders()),
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, "Не удалось сохранить прогресс викторины"));
  }
}
