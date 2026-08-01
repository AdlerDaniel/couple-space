import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { emojiCategories, searchEmojiCategories } from "../lib/emojis.ts";

test("shared emoji catalog is broad, categorized and searchable in Russian", () => {
  const emojis = emojiCategories.flatMap((category) => category.emojis);

  assert.ok(emojiCategories.length >= 8);
  assert.ok(emojis.length >= 700);
  assert.ok(searchEmojiCategories("сердце").flatMap((category) => category.emojis).includes("❤️"));
  assert.ok(searchEmojiCategories("поездка").some((category) => category.id === "travel"));
});

test("all user-facing emoji choices use the shared catalog or picker", async () => {
  const files = await Promise.all(
    [
      "../app/chat/page.tsx",
      "../app/countdown/page.tsx",
      "../app/dashboard/page.tsx",
      "../components/MemoryComposer.tsx",
      "../components/AnswerSocialControls.tsx",
    ].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );

  assert.match(files[0], /emojiCategories/);
  files.slice(1).forEach((source) => assert.match(source, /EmojiPicker/));
});
