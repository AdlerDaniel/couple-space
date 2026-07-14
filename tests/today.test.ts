import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { isAuthorizedCronRequest } from "../lib/cronAuth.ts";
import {
  formatRuDate,
  formatRuTime,
  getDateTimestamp,
  getDailyQuestionReminderRecipients,
  getSafeDate,
  getTodayNextStep,
} from "../lib/today.ts";

const baseInput = {
  isAuthenticated: true,
  hasCouple: true,
  hasPartner: true,
  hasUnread: false,
  hasMyAnswer: false,
  hasPartnerAnswer: false,
  watchRemaining: 0,
  hasGoal: false,
  quizHref: "/quizzes/play?quiz=test",
};

test("today next step prioritizes onboarding before daily work", () => {
  assert.equal(
    getTodayNextStep({
      ...baseInput,
      isAuthenticated: false,
      hasUnread: true,
    }).id,
    "login",
  );

  assert.equal(
    getTodayNextStep({
      ...baseInput,
      hasCouple: false,
      hasUnread: true,
    }).id,
    "create-couple",
  );
});

test("today next step prioritizes unread before answering", () => {
  const step = getTodayNextStep({
    ...baseInput,
    hasUnread: true,
    unreadHref: "/chat",
  });

  assert.equal(step.id, "unread");
  assert.equal(step.href, "/chat");
});

test("today next step handles question states", () => {
  assert.equal(getTodayNextStep(baseInput).id, "answer-question");

  assert.equal(
    getTodayNextStep({
      ...baseInput,
      hasMyAnswer: true,
      hasPartnerAnswer: true,
    }).id,
    "open-partner-answer",
  );

  assert.equal(
    getTodayNextStep({
      ...baseInput,
      hasMyAnswer: true,
    }).id,
    "quick-reply",
  );
});

test("today switches the full page theme between question, memories and movies", async () => {
  const [pageSource, cssSource] = await Promise.all([
    readFile(new URL("../app/today/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(pageSource, /type FocusId = "question" \| "memories" \| "movies"/);
  assert.match(pageSource, /today-page-\$\{activeFocus\}/);
  assert.match(pageSource, /label: "Фильмы"/);
  assert.match(cssSource, /\.today-page-question/);
  assert.match(cssSource, /\.today-page-memories/);
  assert.match(cssSource, /\.today-page-movies/);
});

test("daily question reminder targets only users without today's answer", () => {
  const couple = {
    partner_one_id: "user-1",
    partner_two_id: "user-2",
  };

  assert.deepEqual(getDailyQuestionReminderRecipients(couple, null), ["user-1", "user-2"]);
  assert.deepEqual(
    getDailyQuestionReminderRecipients(couple, {
      answer_one: "ready",
      answer_two: null,
    }),
    ["user-2"],
  );
  assert.deepEqual(
    getDailyQuestionReminderRecipients(couple, {
      answer_one: "ready",
      answer_two: "ready",
    }),
    [],
  );
});

test("today date helpers handle Russian question dates and invalid values safely", () => {
  assert.equal(getSafeDate("31.05.2026")?.getFullYear(), 2026);
  assert.equal(formatRuDate("31.05.2026"), "31 мая");
  assert.equal(formatRuDate("not-a-date"), "дата не указана");
  assert.equal(formatRuTime("not-a-date"), "");
  assert.equal(getDateTimestamp("not-a-date"), 0);
});

test("cron auth rejects missing or invalid secret", () => {
  const request = new Request("https://example.com/api/cron/daily-question", {
    headers: { authorization: "Bearer right" },
  });

  assert.equal(isAuthorizedCronRequest(request, ""), false);
  assert.equal(isAuthorizedCronRequest(request, "wrong"), false);
  assert.equal(isAuthorizedCronRequest(request, "right"), true);
});
