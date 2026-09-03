import assert from "node:assert/strict";
import test from "node:test";

import { getMemoryStoragePath } from "../lib/memoryStorage.ts";

test("memory storage path parser handles public, signed and proxied URLs", () => {
  const path = "a0000000-0000-4000-8000-000000000001/user/photo name.png";
  assert.equal(
    getMemoryStoragePath(`https://project.supabase.co/storage/v1/object/public/memory-images/${encodeURIComponent(path)}`),
    path,
  );
  assert.equal(
    getMemoryStoragePath(`/supabase/storage/v1/object/sign/memory-images/${path.replace(" ", "%20")}?token=secret`),
    path,
  );
});

test("memory storage path parser rejects external and traversal values", () => {
  assert.equal(getMemoryStoragePath("https://example.com/photo.png"), null);
  assert.equal(getMemoryStoragePath("https://example.com/memory-images/pair/photo.png"), null);
  assert.equal(getMemoryStoragePath("/memory-images/pair/../secret"), null);
  assert.equal(getMemoryStoragePath("/storage/v1/object/sign/memory-images/pair/%2E%2E/secret?token=x"), null);
  assert.equal(getMemoryStoragePath(null), null);
});
