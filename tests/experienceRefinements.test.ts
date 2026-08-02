import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Sites loads database images directly and voice notes use the themed player", async () => {
  const config = await readSource("next.config.ts");
  const memories = await readSource("app/memories/page.tsx");
  const player = await readSource("components/AccentAudioPlayer.tsx");

  assert.match(config, /unoptimized:\s*true/);
  assert.match(memories, /AccentAudioPlayer/);
  assert.match(player, /accent-audio-player/);
  assert.match(player, /type="range"/);
});

test("question results use avatars, compact discussion, and an expiring inline editor", async () => {
  const source = await readSource("app/questions/today/page.tsx");

  assert.match(source, /question-conversation-layout/);
  assert.match(source, /QuestionAvatar/);
  assert.match(source, /Время редактирования истекло/);
  assert.match(source, /<Flame/);
  assert.doesNotMatch(source, />Ответ сохранён</);
});

test("archive and tracker keep dense two-column mobile lists", async () => {
  const archive = await readSource("app/questions/archive/page.tsx");
  const tracker = await readSource("app/tracker/page.tsx");

  assert.match(archive, /question-archive-grid grid grid-cols-2/);
  assert.match(tracker, /disabled=\{value <= 0\}/);
  assert.match(tracker, /grid grid-cols-2 gap-2/);
  assert.match(tracker, /mobile-disclosure/);
});

test("Today movie actions open the shared add dialog and roulette", async () => {
  const source = await readSource("app/today/page.tsx");

  assert.match(source, /href="\/watch\?add=1"/);
  assert.match(source, /href="\/watch\?spin=1"/);
  assert.doesNotMatch(source, /Сохранить момент дня/);
});

test("achievements no longer create notifications or navigation entries", async () => {
  const dashboard = await readSource("app/dashboard/page.tsx");
  const navigation = await readSource("lib/navigation.ts");
  const notifications = await readSource("app/notifications/page.tsx");

  assert.doesNotMatch(dashboard, /createOwnNotification/);
  assert.doesNotMatch(navigation, /icon:\s*"achievements"/);
  assert.match(notifications, /neq\("type", "achievement_unlocked"\)/);
});

test("either partner can hard-delete a chat message without a placeholder", async () => {
  const chat = await readSource("app/chat/page.tsx");
  const migration = await readSource(
    "supabase/migrations/20260802120000_allow_couple_chat_hard_delete.sql",
  );

  assert.match(chat, /async function deleteForEveryone/);
  assert.match(chat, /\.delete\(\)\s*\.eq\("id", message\.id\)/);
  assert.doesNotMatch(chat, />Сообщение удалено</);
  assert.match(migration, /for delete\s+to authenticated/);
  assert.match(migration, /auth\.uid\(\)[\s\S]*partner_one_id/);
});
