const dailyQuestionAreas = [
  "в нашем общении",
  "в нашем дне",
  "в наших планах",
  "в нашей поддержке",
  "в нашем доме",
  "в наших привычках",
  "в наших разговорах",
  "в нашей близости",
  "в наших воспоминаниях",
  "в наших свиданиях",
  "в нашем будущем",
  "в наших мечтах",
  "в наших шутках",
  "в нашем доверии",
  "в нашем отдыхе",
  "в наших маленьких ритуалах",
  "в нашей заботе",
  "в наших сложных моментах",
  "в нашей спонтанности",
  "в нашей командности",
];

const dailyQuestionTemplates = [
  (area: string) => `Что ${area} сегодня было самым тёплым?`,
  (area: string) => `Какой маленький шаг ${area} ты заметил сегодня?`,
  (area: string) => `Что ${area} хочется сохранить на память?`,
  (area: string) => `Чего ${area} тебе хочется больше на этой неделе?`,
  (area: string) => `Что ${area} недавно приятно удивило тебя?`,
  (area: string) => `Какой момент ${area} ты бы повторил?`,
  (area: string) => `Что ${area} делает нас сильнее?`,
  (area: string) => `Что ${area} стоит обсудить спокойнее?`,
  (area: string) => `Какой комплимент ${area} ты бы сказал партнёру?`,
  (area: string) => `Что ${area} можно сделать проще и приятнее?`,
  (area: string) => `Какая деталь ${area} сегодня показалась важной?`,
  (area: string) => `Что ${area} помогает тебе чувствовать себя любимым?`,
  (area: string) => `Какую новую идею ${area} хочется попробовать?`,
  (area: string) => `За что ${area} ты особенно благодарен?`,
  (area: string) => `Что ${area} стало лучше за последнее время?`,
];

export const dailyQuestions = dailyQuestionAreas.flatMap((area) =>
  dailyQuestionTemplates.map((template) => template(area))
);

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
    month:
      Number(parts.find((part) => part.type === "month")?.value || date.getMonth() + 1),
    year: Number(parts.find((part) => part.type === "year")?.value || date.getFullYear()),
  };
}

function getDayIndex(date: Date, timeZone: string) {
  const { day, month, year } = getDatePartsInTimeZone(date, timeZone);
  const utcDate = Date.UTC(year, month - 1, day);

  return Math.floor(utcDate / (1000 * 60 * 60 * 24));
}

export function getDailyQuestion(date = new Date(), timeZone = getStoredCoupleTimeZone()) {
  const questionIndex = getDayIndex(date, timeZone) % dailyQuestions.length;
  return dailyQuestions[questionIndex];
}

export function getDailyQuestionDate(date = new Date(), timeZone = getStoredCoupleTimeZone()) {
  return date.toLocaleDateString("ru-RU", {
    timeZone,
  });
}
