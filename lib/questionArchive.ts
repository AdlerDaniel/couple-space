export const questionCategories = [
  "Все",
  "Эмоции",
  "Благодарность",
  "Воспоминания",
  "Планы",
  "Отношения",
] as const;

export type QuestionCategory = (typeof questionCategories)[number];
export type QuestionArchiveGroup = "Сегодня" | "Вчера" | "Эта неделя" | "Этот месяц" | "Раньше";

const virtualQuestionArchivePrefix = "day-";

export function getQuestionCategory(question: string): Exclude<QuestionCategory, "Все"> {
  const normalized = question.toLowerCase();

  if (normalized.includes("улыб")) return "Эмоции";
  if (normalized.includes("благодар")) return "Благодарность";
  if (normalized.includes("момент") || normalized.includes("вспомина")) {
    return "Воспоминания";
  }
  if (normalized.includes("недел") || normalized.includes("сделать")) return "Планы";

  return "Отношения";
}

export function parseQuestionDate(value: string) {
  const trimmed = value.trim();
  const parts = trimmed.split(/[./-]/).map((part) => Number(part));

  if (parts.length === 3 && parts.every((part) => Number.isFinite(part))) {
    const [first, second, third] = parts;

    if (first > 999) {
      return new Date(first, second - 1, third);
    }

    const year = third < 100 ? 2000 + third : third;

    if (first > 12) {
      return new Date(year, second - 1, first);
    }

    if (second > 12) {
      return new Date(year, first - 1, second);
    }

    return new Date(year, second - 1, first);
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function getQuestionDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function createVirtualQuestionArchiveId(dateKey: string) {
  return `${virtualQuestionArchivePrefix}${dateKey}`;
}

export function parseVirtualQuestionArchiveId(value: string) {
  const dateKey = value.startsWith(virtualQuestionArchivePrefix)
    ? value.slice(virtualQuestionArchivePrefix.length)
    : "";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;

  const parsedDate = parseQuestionDate(dateKey);
  return getQuestionDateKey(parsedDate) === dateKey ? dateKey : null;
}

export function getQuestionArchiveGroup(date: Date): QuestionArchiveGroup {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.round(
    (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "Сегодня";
  if (diffDays === 1) return "Вчера";
  if (diffDays > 1 && diffDays < 7) return "Эта неделя";
  if (
    target.getFullYear() === today.getFullYear() &&
    target.getMonth() === today.getMonth()
  ) {
    return "Этот месяц";
  }

  return "Раньше";
}

export function formatQuestionArchiveDate(date: Date) {
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
