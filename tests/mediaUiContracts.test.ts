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
  assert.doesNotMatch(source, /new MediaRecorder\(/);
});

test("chat exposes separate media and audio pickers and does not use storage upsert", async () => {
  const source = await readSource("app/chat/page.tsx");
  assert.match(source, /accept="image\/\*,video\/\*"/);
  assert.match(source, /accept="audio\/\*/);
  assert.match(source, /Аудиофайл/);
  assert.match(source, /upload\(filePath, uploadFile, \{ upsert: false \}\)/);
  assert.doesNotMatch(source, /Р—Р°|РРґ|\?\?\?\?/);
});

test("memories support photo, uploaded audio and recorded voice", async () => {
  const source = await readSource("components/MemoryComposer.tsx");
  assert.match(source, /accept="image\/\*"/);
  assert.match(source, /accept="audio\/\*/);
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

test("today and memories share the full memory composer", async () => {
  const [todaySource, memoriesSource] = await Promise.all([
    readSource("app/today/page.tsx"),
    readSource("app/memories/page.tsx"),
  ]);
  assert.match(todaySource, /<MemoryComposer/);
  assert.match(todaySource, /embedded/);
  assert.match(memoriesSource, /<MemoryComposer/);
});
