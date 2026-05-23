export const dailyQuestions = [
  "Что сегодня заставило тебя улыбнуться?",
  "За что ты сегодня благодарен партнёру?",
  "Какой наш момент ты вспоминаешь с теплом?",
  "Что мы можем сделать вместе на этой неделе?",
  "Что тебе особенно нравится в наших отношениях?",
];

export function getStoredCoupleTimeZone() {
  return "Europe/Moscow";
}

function getDatePartsInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone,
  }).formatToParts(date);

  return {
    day: Number(parts.find((part) => part.type === "day")?.value || date.getDate()),
  };
}

export function getDailyQuestion(date = new Date(), timeZone = getStoredCoupleTimeZone()) {
  const { day } = getDatePartsInTimeZone(date, timeZone);
  const questionIndex = day % dailyQuestions.length;
  return dailyQuestions[questionIndex];
}

export function getDailyQuestionDate(date = new Date(), timeZone = getStoredCoupleTimeZone()) {
  return date.toLocaleDateString("ru-RU", {
    timeZone,
  });
}
