import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("answered users are redirected directly to today's answers", async () => {
  const source = await readFile(new URL("../app/questions/page.tsx", import.meta.url), "utf8");

  assert.match(source, /const savedAnswer =/);
  assert.match(source, /router\.replace\("\/questions\/today"\)/);
});

test("question pages do not display the configured time zone", async () => {
  const source = await readFile(new URL("../app/questions/today/page.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(source, /\{dailyQuestionState\.timeZone\}/);
});

test("question archive includes missed days and allows a late answer", async () => {
  const [archiveSource, detailSource] = await Promise.all([
    readFile(new URL("../app/questions/archive/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/questions/archive/[id]/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(archiveSource, /getDailyQuestionHistory/);
  assert.match(archiveSource, /Вопрос был пропущен — можно ответить/);
  assert.match(detailSource, /saveArchivedAnswer/);
  assert.match(detailSource, /После сохранения откроется ответ партнёра/);
});

test("settings keep account, couple, notification controls and time zone only", async () => {
  const source = await readFile(new URL("../app/settings/page.tsx", import.meta.url), "utf8");

  assert.match(source, /title: "Аккаунт"/);
  assert.match(source, /title: "Пара"/);
  assert.match(source, /Настройки уведомлений/);
  assert.match(source, /Таймзона пары/);
  assert.doesNotMatch(source, /title: "Приватность"|title: "Уведомления"|title: "Медиа и хранилище"|title: "Сессия"/);
});

test("settings own the brown navigation theme and push control", async () => {
  const [settingsSource, themesSource, navbarSource] = await Promise.all([
    readFile(new URL("../app/settings/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/pageThemes.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/Navbar.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(settingsSource, /getPageTheme\("\/settings"\)/);
  assert.match(settingsSource, /<PushNotificationButton/);
  assert.match(themesSource, /settings: \{[\s\S]*?accent: "#78350f"/);
  assert.match(themesSource, /pathname\.startsWith\("\/settings"\).*return "settings"/);
  assert.doesNotMatch(navbarSource, /PushNotificationButton/);
});
