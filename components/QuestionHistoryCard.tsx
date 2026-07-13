import { Trash2 } from "lucide-react";

type QuestionHistoryCardProps = {
  date: string;
  question: string;
  answerOne: string;
  answerTwo: string;
  partnerOne: string;
  partnerTwo: string;
  onDelete: () => void;
};

export default function QuestionHistoryCard({
  date,
  question,
  answerOne,
  answerTwo,
  partnerOne,
  partnerTwo,
  onDelete,
}: QuestionHistoryCardProps) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-lg">
      <div className="mb-4 flex items-start justify-between gap-4">
        <p className="text-sm font-semibold text-rose-400">{date}</p>

        <button
          onClick={onDelete}
          className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-200"
        >
          <Trash2 aria-hidden="true" size={16} />
          Удалить
        </button>
      </div>

      <h3 className="mb-4 text-xl font-bold text-gray-800">{question}</h3>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-rose-50 p-4">
          <p className="mb-2 font-bold text-rose-600">{partnerOne}</p>
          <p className="text-gray-700">{answerOne}</p>
        </div>

        <div className="rounded-2xl bg-purple-50 p-4">
          <p className="mb-2 font-bold text-purple-600">{partnerTwo}</p>
          <p className="text-gray-700">{answerTwo}</p>
        </div>
      </div>
    </div>
  );
}
