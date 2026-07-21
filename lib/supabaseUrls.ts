export const supabaseProxyPath = "/supabase";

function getCanonicalSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || "";
}

export function getSupabaseClientUrl() {
  if (typeof window !== "undefined") {
    return `${window.location.origin}${supabaseProxyPath}`;
  }

  return getCanonicalSupabaseUrl();
}

export function getSupabaseAuthStorageKey() {
  try {
    const projectRef = new URL(getCanonicalSupabaseUrl()).hostname.split(".")[0];
    return projectRef ? `sb-${projectRef}-auth-token` : "couple-space-auth-token";
  } catch {
    return "couple-space-auth-token";
  }
}

export function toPortableSupabaseUrl(value?: string | null) {
  if (!value) return value || null;
  if (value.startsWith(`${supabaseProxyPath}/`)) return value;

  try {
    const url = new URL(value);
    const canonicalSupabaseUrl = getCanonicalSupabaseUrl();
    const canonical = canonicalSupabaseUrl ? new URL(canonicalSupabaseUrl) : null;

    if (canonical && url.origin === canonical.origin) {
      return `${supabaseProxyPath}${url.pathname}${url.search}${url.hash}`;
    }

    if (
      typeof window !== "undefined" &&
      url.origin === window.location.origin &&
      url.pathname.startsWith(`${supabaseProxyPath}/`)
    ) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    return value;
  }

  return value;
}

export function toBrowserSupabaseUrl(value?: string | null) {
  const portable = toPortableSupabaseUrl(value);
  if (!portable || typeof window === "undefined") return portable;

  return portable.startsWith(`${supabaseProxyPath}/`) ? portable : value || null;
}
