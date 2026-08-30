import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("questions support image, audio upload and compatible voice recording", async () => {
  const source = await readSource("app/questions/answer/page.tsx");
  assert.match(source, /accept="image\/\*"/);
  assert.match(source, /accept="audio\/\*/);
  assert.match(source, /createCompatibleAudioRecorder/);
  assert.match(source, /<Paperclip/);
  assert.match(source, /Добавить вложение/);
  assert.doesNotMatch(source, /Голосовой файл<\/span>|Фото-ответ<\/span>/);
  assert.doesNotMatch(source, /new MediaRecorder\(/);
});

test("memories support photo, video, files, uploaded audio and recorded voice", async () => {
  const source = await readSource("components/MemoryComposer.tsx");
  assert.match(source, /accept="image\/\*,video\/\*"/);
  assert.match(source, /accept="audio\/\*/);
  assert.match(source, />Файл</);
  assert.match(source, /Голосовое воспоминание/);
  assert.match(source, /createCompatibleAudioRecorder/);
  assert.match(source, /<Paperclip/);
  assert.match(source, /<Smile/);
  assert.match(source, /<Mic/);
});

test("memories use their upload timestamp instead of a custom event date", async () => {
  const [composerSource, memoriesSource] = await Promise.all([
    readSource("components/MemoryComposer.tsx"),
    readSource("app/memories/page.tsx"),
  ]);
  assert.doesNotMatch(composerSource, /type="date"|eventDate|event_date/);
  assert.doesNotMatch(memoriesSource, /Дата события|Время загрузки|event_date/);
  assert.match(memoriesSource, /Дата: \{formatTime\(memory\.created_at\)\}/);
});

test("today keeps its compact composer and memories open a dedicated creation page", async () => {
  const [todaySource, memoriesSource, newMemorySource] = await Promise.all([
    readSource("app/today/page.tsx"),
    readSource("app/memories/page.tsx"),
    readSource("app/memories/new/page.tsx"),
  ]);
  assert.match(todaySource, /<MemoryComposer/);
  assert.match(todaySource, /embedded/);
  assert.match(memoriesSource, /router\.push\("\/memories\/new"\)/);
  assert.match(newMemorySource, /<MemoryComposer/);
});

test("memory cards expose compact reactions, editing and an Instagram-style detail route", async () => {
  const [memoriesSource, composerSource, newMemorySource, detailSource] = await Promise.all([
    readSource("app/memories/page.tsx"),
    readSource("components/MemoryComposer.tsx"),
    readSource("app/memories/new/page.tsx"),
    readSource("app/memories/[id]/page.tsx"),
  ]);
  assert.match(memoriesSource, /memory-comment-button/);
  assert.match(memoriesSource, /\/memories\/new\?edit=/);
  assert.doesNotMatch(memoriesSource, /Реакции и комментарии/);
  assert.match(composerSource, /initialMemory/);
  assert.match(composerSource, /Сохранить изменения/);
  assert.match(newMemorySource, /\.update\(|editId|initialMemory/);
  assert.match(detailSource, /memory-post-layout/);
  assert.match(detailSource, /memory-post-comments/);
  assert.match(detailSource, /memory_comments/);
});

test("emoji picker never focuses search automatically", async () => {
  const pickerSource = await readSource("components/EmojiPicker.tsx");
  assert.doesNotMatch(pickerSource, /autoFocus|\.focus\(/);
  assert.match(pickerSource, /placeholder="Найти эмодзи"/);
});
