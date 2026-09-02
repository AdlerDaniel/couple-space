import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const client = readFileSync(new URL("../app/tracker/lab/TrackerLabClient.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/tracker/lab/page.tsx", import.meta.url), "utf8");
const layout = readFileSync(new URL("../app/tracker/lab/layout.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/tracker/lab/trackerLab.css", import.meta.url), "utf8");
const navigation = readFileSync(new URL("../lib/navigation.ts", import.meta.url), "utf8");

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
    "postgres_changes",
    "tracker_plan_comments",
    "tracker_plan_attachments",
    "buildTrackerPlanIcs",
  ]) {
    assert.match(client, new RegExp(marker));
  }
});

test("comments support text paste, files, photos, video and voice", () => {
  assert.match(client, /onPaste=\{handleCommentPaste\}/);
  assert.match(client, /handleClipboardFilePaste/);
  assert.match(client, /createCompatibleAudioRecorder/);
  assert.match(client, /<AccentAudioPlayer/);
  assert.match(client, /attachment_type === "image"/);
  assert.match(client, /attachment_type === "video"/);
  assert.match(client, /attachment_type === "file"/);
});

test("responsive styling covers required mobile and desktop widths and reduced motion", () => {
  assert.match(css, /@media \(max-width: 430px\)/);
  assert.match(css, /@media \(max-width: 767px\)/);
  assert.match(css, /@media \(max-width: 1179px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /grid-template-columns:\s*minmax\(14rem/);
  assert.match(css, /safe-area-inset-bottom/);
});
