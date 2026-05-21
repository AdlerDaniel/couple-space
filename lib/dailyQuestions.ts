export const dailyQuestions = [
  "Что сегодня заставило тебя улыбнуться?",
  "За что ты сегодня благодарен партнёру?",
  "Какой наш момент ты вспоминаешь с теплом?",
  "Что мы можем сделать вместе на этой неделе?",
  "Что тебе особенно нравится в наших отношениях?",
];

export function getDailyQuestion(date = new Date()) {
  const questionIndex = date.getDate() % dailyQuestions.length;
  return dailyQuestions[questionIndex];
}

export function getDailyQuestionDate(date = new Date()) {
  return date.toLocaleDateString();
}
