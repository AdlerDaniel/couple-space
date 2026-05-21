import { Suspense } from "react";
import QuizPlayClient from "./QuizPlayClient";

export default function QuizPlayPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#f1e7ff] to-[#fbf7ff] px-6 text-[#7c3aed] dark:from-[#170525] dark:to-[#09020f] dark:text-[#c084fc]">
          <div className="rounded-3xl bg-white/40 p-8 font-semibold shadow-2xl backdrop-blur dark:bg-white/5">
            Загружаем викторину...
          </div>
        </main>
      }
    >
      <QuizPlayClient />
    </Suspense>
  );
}
