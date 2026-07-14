import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("logout is local, bounded and clears stale browser auth", async () => {
  const source = await readFile(new URL("../lib/authSession.ts", import.meta.url), "utf8");

  assert.match(source, /signOut\(\{ scope: "local" \}\)/);
  assert.match(source, /Promise\.race/);
  assert.match(source, /clearLocalAuthSession/);
  assert.match(source, /window\.location\.replace\("\/login"\)/);
});

test("all logout entry points use the resilient session helper", async () => {
  const [navbarSource, logoutPageSource] = await Promise.all([
    readFile(new URL("../components/Navbar.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/logout/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(navbarSource, /signOutAndRedirect/);
  assert.match(logoutPageSource, /signOutAndRedirect/);
  assert.doesNotMatch(navbarSource, /supabase\.auth\.signOut/);
  assert.doesNotMatch(logoutPageSource, /supabase\.auth\.signOut/);
});
