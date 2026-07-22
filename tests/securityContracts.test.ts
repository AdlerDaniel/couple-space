import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("security migration closes anonymous reads and adds integrity constraints", async () => {
  const migration = await readSource(
    "supabase/migrations/20260722092723_secure_private_data_and_integrity.sql",
  );

  assert.match(migration, /revoke all on table public\.couple_profiles from anon/);
  assert.match(migration, /revoke all on table public\.memories from anon/);
  assert.match(migration, /couple_profiles_couple_id_key unique \(couple_id\)/);
  assert.match(migration, /question_answers_couple_date_question_key/);
  assert.match(migration, /couples_invite_code_key unique \(invite_code\)/);
  assert.match(migration, /couple\.id::text = \(storage\.foldername\(name\)\)\[1\]/);
  assert.doesNotMatch(migration, /create policy "Anyone can read memory images"/);
});

test("public server routes authenticate or rate-limit expensive operations", async () => {
  const [signup, watchSearch, linkPreview, pushSend, membership] = await Promise.all([
    readSource("app/api/auth/login-signup/route.ts"),
    readSource("app/api/watch/search/route.ts"),
    readSource("app/api/link-preview/route.ts"),
    readSource("app/api/push/send/route.ts"),
    readSource("app/api/couple/membership/route.ts"),
  ]);

  assert.match(signup, /enforceRateLimit/);
  assert.match(signup, /isSameOriginRequest/);
  assert.match(watchSearch, /getAuthenticatedUser/);
  assert.match(linkPreview, /getAuthenticatedUser/);
  assert.match(pushSend, /notificationId/);
  assert.doesNotMatch(pushSend, /sendDirectNotification/);
  assert.match(membership, /getAuthenticatedUser/);
});

test("couple membership and archived answers use race-safe server operations", async () => {
  const [profile, invite, archive] = await Promise.all([
    readSource("app/profile/page.tsx"),
    readSource("app/invite/page.tsx"),
    readSource("app/questions/archive/[id]/page.tsx"),
  ]);

  assert.match(profile, /\/api\/couple\/membership/);
  assert.doesNotMatch(profile, /from\("couples"\)\.update/);
  assert.match(invite, /\/api\/couple\/membership/);
  assert.doesNotMatch(invite, /\.eq\("invite_code"/);
  assert.match(archive, /\.upsert\(/);
  assert.match(archive, /onConflict: "couple_id,date,question"/);
});

test("partner-answer reveal uses Realtime and auth persistence follows user choice", async () => {
  const [today, archive, supabaseClient] = await Promise.all([
    readSource("app/questions/today/page.tsx"),
    readSource("app/questions/archive/[id]/page.tsx"),
    readSource("lib/supabaseClient.ts"),
  ]);

  assert.match(today, /postgres_changes/);
  assert.match(archive, /postgres_changes/);
  assert.doesNotMatch(archive, /}, 4000\)/);
  assert.match(supabaseClient, /window\.sessionStorage/);
  assert.match(supabaseClient, /rememberPreferenceKey/);
});
