import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("mobile rendering disables expensive page blur while keeping a lighter dock", async () => {
  const css = await readSource("app/globals.css");

  assert.match(css, /@media \(max-width: 767px\), \(pointer: coarse\)/);
  assert.match(css, /main \[class\*="backdrop-blur"\]/);
  assert.match(css, /\.mobile-matte-dock[\s\S]*?blur\(10px\)/);
  assert.match(css, /\.performance-list-item[\s\S]*?content-visibility: auto/);
});

test("global AnimeJS runtime is loaded on demand and skipped on phones", async () => {
  const source = await readSource("components/AnimeRuntime.tsx");

  assert.doesNotMatch(source, /import \{[^}]*animate[^}]*\} from "animejs"/);
  assert.match(source, /import\("animejs"\)/);
  assert.match(source, /max-width: 767px/);
  assert.match(source, /saveData/);
});

test("chat initially loads recent messages and paginates older history", async () => {
  const [page, repository, utils] = await Promise.all([
    readSource("app/chat/page.tsx"),
    readSource("app/chat/chatRepository.ts"),
    readSource("app/chat/chatUtils.ts"),
  ]);
  const source = `${page}\n${repository}\n${utils}`;

  assert.match(source, /CHAT_PAGE_SIZE = 80/);
  assert.match(source, /order\("created_at", \{ ascending: false \}\)/);
  assert.match(source, /\.lt\("created_at", before\)/);
  assert.match(source, /Показать предыдущие сообщения/);
  assert.match(source, /preload="none"/);
});

test("memories defer offscreen cards and audio downloads", async () => {
  const source = await readSource("app/memories/page.tsx");
  const player = await readSource("components/AccentAudioPlayer.tsx");

  assert.match(source, /performance-list-item group/);
  assert.match(source, /AccentAudioPlayer/);
  assert.match(player, /preload="metadata"/);
  assert.doesNotMatch(source, /<audio controls/);
});

test("watch list defers offscreen cards", async () => {
  const source = await readSource("app/watch/page.tsx");

  assert.match(source, /performance-list-item group/);
});
