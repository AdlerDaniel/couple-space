import { supabase } from "@/lib/supabaseClient";

const signOutTimeoutMs = 6_000;
let activeSignOut: Promise<void> | null = null;

function getAuthStorageKey() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;

  try {
    const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
    return projectRef ? `sb-${projectRef}-auth-token` : null;
  } catch {
    return null;
  }
}

function clearStorage(storage: Storage, storageKey: string) {
  try {
    storage.removeItem(storageKey);
    storage.removeItem(`${storageKey}-code-verifier`);
    storage.removeItem(`${storageKey}-user`);
  } catch {
    // Storage can be unavailable in private browsing; the hard reload still clears in-memory auth.
  }
}

export function clearLocalAuthSession() {
  if (typeof window === "undefined") return;

  const storageKey = getAuthStorageKey();
  if (!storageKey) return;

  clearStorage(window.localStorage, storageKey);
  clearStorage(window.sessionStorage, storageKey);
}

async function performSignOut() {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      supabase.auth.signOut({ scope: "local" }).then(() => undefined),
      new Promise<void>((resolve) => {
        timeoutId = setTimeout(resolve, signOutTimeoutMs);
      }),
    ]);
  } catch {
    // A local cleanup below keeps logout usable when Auth is temporarily unreachable.
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    clearLocalAuthSession();
  }
}

export function signOutCurrentDevice() {
  if (!activeSignOut) {
    activeSignOut = performSignOut().finally(() => {
      activeSignOut = null;
    });
  }

  return activeSignOut;
}

export async function signOutAndRedirect() {
  await signOutCurrentDevice();
  window.location.replace("/login");
}
