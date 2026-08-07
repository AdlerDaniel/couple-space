import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the application font is self-hosted with Cyrillic support", async () => {
  const [layoutSource, cssSource] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(layoutSource, /Manrope/);
  assert.match(layoutSource, /subsets: \["cyrillic", "latin"\]/);
  assert.match(layoutSource, /variable: "--font-manrope"/);
  assert.match(cssSource, /font-family: var\(--font-manrope\)/);
});

test("shared design tokens cover light, dark and keyboard focus states", async () => {
  const cssSource = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(cssSource, /--ui-focus-ring:/);
  assert.match(cssSource, /\.dark \{[\s\S]*--ui-surface:/);
  assert.match(cssSource, /:focus-visible \{[\s\S]*var\(--ui-focus-ring\)/);
});

test("shared native dialogs manage focus, Escape and page scrolling", async () => {
  const source = await readFile(
    new URL("../components/ui/AppDialog.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /dialog\.showModal\(\)/);
  assert.match(source, /data-dialog-initial-focus/);
  assert.match(source, /onCancel=/);
  assert.doesNotMatch(source, /onClose=/);
  assert.match(source, /lockPageScroll\(\)/);
  assert.match(source, /previouslyFocused\.focus/);
});

test("countdown and avatar editor use the shared accessible dialog", async () => {
  const [countdownSource, dashboardSource] = await Promise.all([
    readFile(new URL("../app/countdown/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(countdownSource, /<AppDialog/);
  assert.match(countdownSource, /role="alertdialog"/);
  assert.match(countdownSource, /ariaDescribedby="delete-countdown-description"/);
  assert.match(dashboardSource, /ariaLabelledby="avatar-crop-title"/);
});
