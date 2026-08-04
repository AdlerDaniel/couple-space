import { getQuizById, quizzes } from "@/lib/quizzes";
import QuizResultClient from "./QuizResultClient";

type QuizResultPageProps = {
  searchParams: Promise<{ quiz?: string | string[] }>;
};

export default async function QuizResultPage({ searchParams }: QuizResultPageProps) {
  const params = await searchParams;
  const quizId = Array.isArray(params.quiz) ? params.quiz[0] : params.quiz;
  const quiz = getQuizById(quizId || null);
  const similarQuiz = quiz
    ? quizzes.find((item) => item.category === quiz.category && item.id !== quiz.id) ||
      quizzes.find((item) => item.id !== quiz.id)
    : null;

  return <QuizResultClient quiz={quiz} similarQuizId={similarQuiz?.id || null} />;
}
