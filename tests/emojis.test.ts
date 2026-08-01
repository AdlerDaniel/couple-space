import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("emoji picker delegates the complete choice to the device keyboard", async () => {
  const source = await readFile(new URL("../components/EmojiPicker.tsx", import.meta.url), "utf8");

  assert.match(source, /virtualKeyboard/);
  assert.match(source, /inputMode="text"/);
  assert.match(source, /Windows: Win \+ \./);
  assert.match(source, /Mac: Control \+ Command \+ Space/);
  assert.doesNotMatch(source, /emojiCategories/);
});

test("all user-facing emoji insertion points use the system picker", async () => {
  const files = await Promise.all(
    [
      "../app/chat/page.tsx",
      "../app/countdown/page.tsx",
      "../app/dashboard/page.tsx",
      "../components/MemoryComposer.tsx",
      "../components/AnswerSocialControls.tsx",
    ].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );

  files.forEach((source) => assert.match(source, /EmojiPicker/));
});

test("emoji presentation stays scoped away from countdown digits", async () => {
  const [styles, countdown] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/countdown/page.tsx", import.meta.url), "utf8"),
  ]);

  const bodyRule = styles.match(/body\s*\{[\s\S]*?\}/)?.[0] ?? "";
  assert.doesNotMatch(bodyRule, /font-variant-emoji:\s*emoji/);
  assert.match(styles, /\.native-emoji,[\s\S]*font-variant-emoji:\s*emoji/);
  assert.match(styles, /\.countdown-number\s*\{[\s\S]*font-variant-numeric:\s*tabular-nums/);
  assert.match(countdown, /countdown-number/);
});
