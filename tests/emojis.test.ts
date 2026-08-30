import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("emoji picker uses the complete local Microsoft Fluent Emoji catalog", async () => {
  const [source, prepareScript, packageJson] = await Promise.all([
    readFile(new URL("../components/EmojiPicker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../scripts/prepare-fluent-emojis.mjs", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(source, /\/fluent-emoji\/index\.json/);
  assert.match(source, /Найти эмодзи/);
  assert.doesNotMatch(source, /Тон кожи|setSkinTone|Выбор тона кожи/);
  assert.doesNotMatch(source, /virtualKeyboard|клавиатур/i);
  assert.match(prepareScript, /fluent-emoji-3d/);
  assert.match(prepareScript, /emojibase-data/);
  assert.match(packageJson, /"prebuild:sites": "npm run prepare:emoji"/);
});

test("all user-facing emoji insertion points use the shared Fluent picker", async () => {
  const files = await Promise.all(
    [
      "../app/countdown/page.tsx",
      "../app/dashboard/page.tsx",
      "../components/MemoryComposer.tsx",
      "../components/AnswerSocialControls.tsx",
    ].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );

  files.forEach((source) => assert.match(source, /EmojiPicker/));
});

test("Fluent emoji presentation stays scoped away from countdown digits", async () => {
  const [styles, countdown] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/countdown/page.tsx", import.meta.url), "utf8"),
  ]);

  const bodyRule = styles.match(/body\s*\{[\s\S]*?\}/)?.[0] ?? "";
  assert.doesNotMatch(bodyRule, /font-variant-emoji:\s*emoji/);
  assert.match(styles, /\.fluent-emoji,[\s\S]*object-fit:\s*contain/);
  assert.match(styles, /\.countdown-number\s*\{[\s\S]*font-variant-numeric:\s*tabular-nums/);
  assert.match(countdown, /countdown-number/);
});
