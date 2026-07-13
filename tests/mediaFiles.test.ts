import assert from "node:assert/strict";
import test from "node:test";

import {
  getAudioExtension,
  getMediaKind,
  getSupportedAudioMimeType,
  validateMediaFile,
} from "../lib/mediaFiles.ts";
import { decodeMemoryMedia, encodeMemoryMedia } from "../lib/memoryMedia.ts";

test("media kind falls back to the extension when mobile browsers omit MIME type", () => {
  assert.equal(getMediaKind({ name: "photo.HEIC", type: "" }), "image");
  assert.equal(getMediaKind({ name: "voice.m4a", type: "" }), "audio");
});

test("audio recorder prefers WebM but falls back to MP4 for Safari", () => {
  const safariRecorder = {
    isTypeSupported: (mimeType: string) => mimeType.startsWith("audio/mp4"),
  };

  assert.equal(getSupportedAudioMimeType(safariRecorder), "audio/mp4;codecs=mp4a.40.2");
  assert.equal(getAudioExtension("audio/mp4;codecs=mp4a.40.2"), "m4a");
});

test("media validation rejects empty, oversized and unsupported files", () => {
  assert.match(
    validateMediaFile({ name: "empty.jpg", type: "image/jpeg", size: 0 }, ["image"], 100).error || "",
    /пустой/
  );
  assert.match(
    validateMediaFile({ name: "large.jpg", type: "image/jpeg", size: 101 }, ["image"], 100).error || "",
    /слишком большой/
  );
  assert.match(
    validateMediaFile({ name: "note.txt", type: "text/plain", size: 10 }, ["image"], 100).error || "",
    /неподдерживаемый/
  );
});

test("memory media keeps old photo URLs and stores photo plus voice without a schema change", () => {
  assert.deepEqual(decodeMemoryMedia("https://example.com/photo.jpg"), {
    photoUrl: "https://example.com/photo.jpg",
    voiceUrl: null,
  });

  const encoded = encodeMemoryMedia({
    photoUrl: "https://example.com/photo.jpg",
    voiceUrl: "https://example.com/voice.m4a",
  });
  assert.deepEqual(decodeMemoryMedia(encoded), {
    photoUrl: "https://example.com/photo.jpg",
    voiceUrl: "https://example.com/voice.m4a",
  });
});
