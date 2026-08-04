import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (path: string) => readFile(path, "utf8");

test("local Supabase tooling stays pinned and outside the dependency graph", async () => {
  const packageSource = await readSource("package.json");
  const packageJson = JSON.parse(packageSource) as {
    scripts?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  assert.equal(packageJson.devDependencies?.supabase, undefined);
  assert.match(packageJson.scripts?.["supabase:start"] || "", /supabase@2\.111\.0 start/);
  assert.match(packageJson.scripts?.["supabase:test"] || "", /supabase@2\.111\.0 test db/);
  assert.match(packageJson.scripts?.["supabase:lint"] || "", /supabase@2\.111\.0 db lint/);
});

test("development infrastructure uses only the free local Supabase stack", async () => {
  const [config, workflow, realtimeTest] = await Promise.all([
    readSource("supabase/config.toml"),
    readSource(".github/workflows/ci.yml"),
    readSource("tests/archive-realtime.spec.ts"),
  ]);

  assert.match(config, /\[storage\.vector\]\s+enabled = false/);
  assert.match(config, /\[edge_runtime\]\s+enabled = false/);
  assert.match(config, /\[analytics\]\s+enabled = false/);
  assert.match(workflow, /Start the free local Supabase stack/);
  assert.doesNotMatch(workflow, /supabase branches create|supabase_branch|create_branch/);
  assert.match(realtimeTest, /may run only against the local Supabase stack/);
});
