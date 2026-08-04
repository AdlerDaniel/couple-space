import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("quiz completion is sourced from the server while local storage is draft-only", async () => {
  const [list, play, result, drafts, repository] = await Promise.all([
    readSource("app/quizzes/page.tsx"),
    readSource("app/quizzes/play/QuizPlayClient.tsx"),
    readSource("app/quizzes/result/QuizResultClient.tsx"),
    readSource("lib/quizDrafts.ts"),
    readSource("lib/quizProgressRepository.ts"),
  ]);

  assert.doesNotMatch(list, /localAnswersKey|StoredAnswers/);
  assert.match(list, /fetchQuizProgress/);
  assert.doesNotMatch(result, /localAnswersKey|localCommentsKey|quiz-answers:|quiz-comments:/);
  assert.match(result, /setAnswersByUser\(nextAnswers\)/);
  assert.match(play, /writeQuizDraft/);
  assert.match(play, /await saveQuizProgress/);
  assert.match(play, /clearQuizDraft/);
  assert.ok(play.indexOf("await saveQuizProgress") < play.lastIndexOf("clearQuizDraft"));
  assert.match(drafts, /quiz-draft:\$\{coupleId\}:\$\{quizId\}:\$\{userId\}/);
  assert.match(repository, /cache: "no-store"/);
});
