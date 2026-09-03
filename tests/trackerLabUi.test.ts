import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const client = readFileSync(new URL("../app/tracker/lab/TrackerLabClient.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/tracker/lab/page.tsx", import.meta.url), "utf8");
const layout = readFileSync(new URL("../app/tracker/lab/layout.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/tracker/lab/trackerLab.css", import.meta.url), "utf8");
const navigation = readFileSync(new URL("../lib/navigation.ts", import.meta.url), "utf8");
const repository = readFileSync(new URL("../lib/trackerRepository.ts", import.meta.url), "utf8");
const hook = readFileSync(new URL("../app/tracker/useTrackerData.ts", import.meta.url), "utf8");
const originalTracker = readFileSync(new URL("../app/tracker/page.tsx", import.meta.url), "utf8");
const dailyDigest = readFileSync(new URL("../lib/trackerDailyDigest.ts", import.meta.url), "utf8");
const discussion = readFileSync(new URL("../app/tracker/lab/TrackerLabDiscussion.tsx", import.meta.url), "utf8");
const dialog = readFileSync(new URL("../app/tracker/lab/TrackerLabDialog.tsx", import.meta.url), "utf8");
const planComposer = readFileSync(new URL("../app/tracker/lab/TrackerLabPlanComposer.tsx", import.meta.url), "utf8");
const freeTime = readFileSync(new URL("../app/tracker/lab/TrackerLabFreeTimeDialog.tsx", import.meta.url), "utf8");
const analytics = readFileSync(new URL("../app/tracker/lab/TrackerLabAnalytics.tsx", import.meta.url), "utf8");
const pagination = readFileSync(new URL("../lib/trackerPagination.ts", import.meta.url), "utf8");
const trackerSource = [client, repository, hook, dailyDigest, discussion, planComposer, freeTime, analytics, pagination].join("\n");

test("tracker lab stays hidden from global navigation and search indexing", () => {
  assert.doesNotMatch(navigation, /href:\s*["']\/tracker\/lab["']/);
  assert.match(layout, /index:\s*false/);
  assert.match(layout, /follow:\s*false/);
  assert.match(page, /TrackerLabClient/);
});

test("tracker lab exposes the complete collaborative flow", () => {
  for (const marker of [
    "Сегодня",
    "Календарь",
    "Активность",
    "Наше свободное время",
    "Обсуждение",
    "Сделать воспоминанием",
    "find_tracker_common_free_slots",
    "save_tracker_checkin",
    "adjust_tracker_event_count",
    "broadcast",
    "tracker_plan_comments",
    "tracker_plan_attachments",
    "buildTrackerPlanIcs",
    "tracker_plan_participants",
    "tracker_plan_occurrence_overrides",
    "Перенести этот день",
    "Принять",
    "complete_tracker_assigned_task",
    "Карта",
    "По дням недели",
    "История отметок",
  ]) {
    assert.match(trackerSource, new RegExp(marker));
  }
});

test("comments support text paste, files, photos, video and voice", () => {
  assert.match(discussion, /onPaste=\{handlePaste\}/);
  assert.match(discussion, /handleClipboardFilePaste/);
  assert.match(discussion, /createCompatibleAudioRecorder/);
  assert.match(discussion, /<AccentAudioPlayer/);
  assert.match(discussion, /attachment_type === "image"/);
  assert.match(discussion, /attachment_type === "video"/);
  assert.match(discussion, /attachment_type === "file"/);
});

test("responsive styling covers required mobile and desktop widths and reduced motion", () => {
  assert.match(css, /@media \(max-width: 430px\)/);
  assert.match(css, /@media \(max-width: 767px\)/);
  assert.match(css, /@media \(max-width: 1179px\)/);
  assert.match(css, /@media \(min-width: 768px\) and \(max-width: 1179px\)/);
  assert.match(client, /tracker-lab-insights/);
  assert.match(client, /aria-current=\{activeTab/);
  assert.match(client, /aria-pressed=\{scopeFilter/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /grid-template-columns:\s*minmax\(14rem/);
  assert.match(css, /safe-area-inset-bottom/);
});


test("shared repository powers both tracker versions and the daily free-tier digest", () => {
  assert.match(repository, /channel\(`tracker:\$\{coupleId\}`, \{ config: \{ private: true \} \}\)/);
  assert.match(repository, /\.on\("broadcast", \{ event: "changed" \}/);
  assert.match(repository, /realtime\.setAuth\(\)/);
  assert.doesNotMatch(repository, /postgres_changes/);
  assert.match(client, /useTrackerData/);
  assert.match(client, /adjustTrackerEventCount/);
  assert.match(originalTracker, /adjustTrackerEventCount/);
  assert.match(originalTracker, /subscribeTrackerData/);
  assert.match(originalTracker, /tracker_category_preferences/);
  assert.match(dailyDigest, /expandTrackerPlanOccurrences/);
  assert.match(dailyDigest, /tracker-digest-/);
  assert.match(dailyDigest, /plan\.assignee_id === userId/);
  assert.match(client, /getTimedEndDate/);
  assert.match(client, /restoreOccurrence/);
});

test("discussion owns disposable microphone state and dialogs manage focus and mobile viewport", () => {
  assert.match(client, /<TrackerLabDiscussion/);
  assert.match(client, /key=\{selectedPlan\.id\}/);
  assert.match(discussion, /recorder\.onstop = null/);
  assert.match(discussion, /stream\.getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
  assert.match(discussion, /!mountedRef\.current \|\| request !== recordingRequestRef\.current/);
  assert.match(dialog, /aria-modal="true"/);
  assert.match(dialog, /visualViewport/);
  assert.match(dialog, /previousFocus\?\.isConnected/);
  assert.match(dialog, /event\.shiftKey/);
  assert.match(dialog, /prefers-reduced-motion/);
});

test("analytics retains the original full-year and history capabilities", () => {
  assert.match(client, /<TrackerLabAnalytics/);
  assert.match(analytics, /Array\.from\(\{ length \}/);
  assert.match(analytics, /tracker-lab-heat-grid/);
  assert.match(analytics, /tracker-lab-heat-months/);
  assert.match(analytics, /data-heat-month/);
  assert.match(analytics, /tabIndex=\{isSelected \? 0 : -1\}/);
  assert.match(analytics, /categoryFilter/);
  assert.match(analytics, /getVisibleEventNote/);
  assert.match(analytics, /duration_minutes/);
  assert.match(repository, /collectTrackerPages/);
  assert.match(originalTracker, /fetchTrackerEvents/);
});

test("visible check-ins render server-authorized details without changing privacy logic", () => {
  assert.match(client, /checkin\.energy/);
  assert.match(client, /checkin\.relationship/);
  assert.match(client, /checkin\.note/);
  assert.match(client, /checkin\.visibility === "private"/);
});
