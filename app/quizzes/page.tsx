import { quizCategories, quizzes } from "@/lib/quizzes";
import QuizzesClient from "./QuizzesClient";

export default function QuizzesPage() {
  const summaries = quizzes.map((quiz) => ({
    id: quiz.id,
    category: quiz.category,
    title: quiz.title,
    duration: quiz.duration,
    questionCount: quiz.questions.length,
    firstQuestion: quiz.questions[0]?.text || "",
  }));

  return <QuizzesClient categories={quizCategories} quizzes={summaries} />;
}
