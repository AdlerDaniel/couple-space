type QuestionAnswerEditWindowInput = {
  editedAt: string | null | undefined;
  recordCreatedAt: string | null | undefined;
  hasOwnAnswer: boolean;
};

export function getQuestionAnswerEditWindowStart({
  editedAt,
  recordCreatedAt,
  hasOwnAnswer,
}: QuestionAnswerEditWindowInput) {
  if (editedAt) return editedAt;
  return hasOwnAnswer ? recordCreatedAt || null : null;
}
