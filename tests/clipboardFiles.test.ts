import assert from "node:assert/strict";
import test from "node:test";

import { getClipboardFiles, handleClipboardFilePaste } from "../lib/clipboardFiles.ts";

test("clipboard file extraction ignores text and keeps pasted files", () => {
  const screenshot = new File(["image"], "screenshot.png", { type: "image/png" });
  const document = new File(["document"], "notes.pdf", { type: "application/pdf" });

  const files = getClipboardFiles({
    items: [
      { kind: "string", getAsFile: () => null },
      { kind: "file", getAsFile: () => screenshot },
      { kind: "file", getAsFile: () => document },
    ],
  });

  assert.deepEqual(files, [screenshot, document]);
});

test("clipboard paste only prevents normal text insertion when files exist", () => {
  let prevented = false;
  let received: File[] = [];

  const handled = handleClipboardFilePaste(
    {
      clipboardData: { items: [{ kind: "string", getAsFile: () => null }] },
      preventDefault: () => {
        prevented = true;
      },
    },
    (files) => {
      received = files;
    },
  );

  assert.equal(handled, false);
  assert.equal(prevented, false);
  assert.deepEqual(received, []);
});
