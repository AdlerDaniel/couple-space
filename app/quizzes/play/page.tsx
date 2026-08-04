import { getQuizById } from "@/lib/quizzes";
import QuizPlayClient from "./QuizPlayClient";

type QuizPlayPageProps = {
  searchParams: Promise<{ quiz?: string | string[] }>;
};

export default async function QuizPlayPage({ searchParams }: QuizPlayPageProps) {
  const params = await searchParams;
  const quizId = Array.isArray(params.quiz) ? params.quiz[0] : params.quiz;

  return <QuizPlayClient quiz={getQuizById(quizId || null)} />;
}
