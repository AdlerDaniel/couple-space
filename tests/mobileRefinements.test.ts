import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("watch and memories use dense two-column mobile grids", async () => {
  const [css, watch, memories] = await Promise.all([
    readFile(new URL("../app/mobile-redesign.css", import.meta.url), "utf8"),
    readFile(new URL("../app/watch/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/memories/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(css, /\.watch-card-grid[\s\S]*grid-template-columns:\s*repeat\(2/);
  assert.match(css, /\.memories-grid[\s\S]*grid-template-columns:\s*repeat\(2/);
  assert.match(watch, /watch-card-grid/);
  assert.match(memories, /memory-comment-button/);
  assert.match(memories, /href=\{`\/memories\/\$\{memory\.id\}`\}/);
  assert.match(memories, /memory-actions-menu/);
  assert.doesNotMatch(memories, /Реакции и комментарии/);
});

test("question answers use integrated partner-only reactions and compact discussion", async () => {
  const [today, archive, discussion, reactions] = await Promise.all([
    readFile(new URL("../app/questions/today/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/questions/archive/[id]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/QuestionComments.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/AnswerSocialControls.tsx", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(today, /Ваш статус/);
  assert.doesNotMatch(today, /Статус партнёра/);
  assert.doesNotMatch(discussion, /Комментарии к ответу/);
  assert.doesNotMatch(discussion, /Комментариев пока нет/);
  assert.match(discussion, />\s*Обсуждение/);
  assert.match(discussion, /<Send/);
  assert.equal((today.match(/<AnswerSocialControls/g) || []).length, 1);
  assert.equal((archive.match(/<AnswerSocialControls/g) || []).length, 1);
  assert.match(reactions, /isReactionPickerOpen/);
  assert.doesNotMatch(reactions, /Короткий комментарий/);
});

test("textareas size to their content outside the chat composer", async () => {
  const css = await readFile(new URL("../app/mobile-redesign.css", import.meta.url), "utf8");
  assert.match(css, /textarea:not\(\.chat-composer-input\)[\s\S]*field-sizing:\s*content/);
});
