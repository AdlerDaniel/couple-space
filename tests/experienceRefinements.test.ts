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

test("question results use avatars, a dedicated discussion chat, and an expiring inline editor", async () => {
  const source = await readSource("app/questions/today/page.tsx");
  const discussion = await readSource("app/questions/discussion/page.tsx");

  assert.match(source, /question-conversation-layout/);
  assert.match(source, /QuestionAvatar/);
  assert.match(source, /Время редактирования истекло/);
  assert.match(source, /myEditedAt \|\| answerRecord\?\.created_at/);
  assert.match(source, /<Flame/);
  assert.match(source, /questions\/discussion\?answerId=/);
  assert.doesNotMatch(source, /<QuestionComments/);
  assert.match(discussion, /question-discussion-chat-bg/);
  assert.match(discussion, /accept="image\/\*,video\/\*"/);
  assert.match(discussion, /accept="audio\/\*/);
  assert.match(discussion, /Аудиофайл/);
  assert.match(discussion, /EmojiPicker/);
  assert.match(discussion, /createCompatibleAudioRecorder/);
  assert.doesNotMatch(source, />Ответ сохранён</);
});

test("memory cards omit empty fallback copy and keep the composer compact", async () => {
  const memories = await readSource("app/memories/page.tsx");
  const composer = await readSource("components/MemoryComposer.tsx");
  const mobileCss = await readSource("app/mobile-redesign.css");

  assert.match(composer, /placeholder="Описание"/);
  assert.doesNotMatch(composer, /title\.trim\(\) \|\| "Без названия"/);
  assert.match(memories, /getMemoryTitle/);
  assert.match(memories, /getMemoryDescription/);
  assert.match(memories, /displayTitle &&/);
  assert.match(memories, /memory-card-controls/);
  assert.match(memories, /memory-voice-player/);
  assert.match(composer, /memory-emoji-picker fixed/);
  assert.match(memories, /portal/);
  assert.match(memories, /onClick=\{\(event\) => event\.stopPropagation\(\)\}/);
  assert.ok(
    composer.lastIndexOf("Добавить воспоминание") > composer.lastIndexOf("memoryAttachments.length"),
  );
  assert.match(mobileCss, /columns:\s*2 !important/);
  assert.match(mobileCss, /break-inside:\s*avoid/);
  assert.match(mobileCss, /memory-reaction-option\.is-active/);
});

test("chat uses a compact mobile profile header and integrated composer", async () => {
  const chat = await readSource("app/chat/page.tsx");
  const shell = await readSource("components/AppShell.tsx");

  assert.match(chat, /chat-partner-pill/);
  assert.match(chat, /chat-mobile-more/);
  assert.match(chat, /chat-composer/);
  assert.match(chat, /placeholder="Сообщение"/);
  assert.match(chat, /lineHeight \* 5/);
  assert.match(chat, /overflow-y-hidden/);
  assert.match(chat, /chat-messages-scroll/);
  assert.match(chat, /isVoiceMessage \? "px-0 py-0 shadow-none"/);
  assert.match(shell, /pathname === "\/chat"/);
  assert.match(shell, /questions\/discussion/);
});

test("archive and tracker keep dense two-column mobile lists", async () => {
  const archive = await readSource("app/questions/archive/page.tsx");
  const tracker = await readSource("app/tracker/page.tsx");

  assert.match(archive, /question-archive-grid grid grid-cols-2/);
  assert.match(tracker, /disabled=\{value <= 0\}/);
  assert.match(tracker, /grid grid-cols-2 gap-2/);
  assert.match(tracker, /mobile-disclosure/);
});

test("Today movie actions open the dedicated add page and roulette", async () => {
  const [source, watchSource, addSource] = await Promise.all([
    readSource("app/today/page.tsx"),
    readSource("app/watch/page.tsx"),
    readSource("app/watch/new/page.tsx"),
  ]);

  assert.match(source, /href="\/watch\/new"/);
  assert.match(source, /href="\/watch\?spin=1"/);
  assert.doesNotMatch(source, /Сохранить момент дня/);
  assert.match(watchSource, /href="\/watch\/new"/);
  assert.doesNotMatch(watchSource, /Вернуться в Сегодня/);
  assert.match(addSource, /Добавить в список/);
  assert.match(addSource, /WatchResultPoster/);
  assert.match(addSource, /void addItem\(result\)/);
});

test("daily answer attachments keep voice recording as a separate action", async () => {
  const source = await readSource("app/questions/answer/page.tsx");

  assert.match(source, /pr-28/);
  assert.match(source, /aria-label=\{isRecording \? "Завершить запись" : "Записать голос"\}/);
  assert.match(source, /firstSavedAt = answerRecord\?\.\[editedAtField\] \|\| answerRecord\?\.created_at/);
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
