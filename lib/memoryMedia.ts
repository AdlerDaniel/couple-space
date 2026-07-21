import { toBrowserSupabaseUrl } from "./supabaseUrls.ts";

const memoryMediaPrefix = "couple-space-media:";

export type MemoryMedia = {
  photoUrl: string | null;
  voiceUrl: string | null;
};

export function encodeMemoryMedia({ photoUrl, voiceUrl }: MemoryMedia) {
  if (!voiceUrl) return photoUrl;

  return `${memoryMediaPrefix}${encodeURIComponent(
    JSON.stringify({ version: 1, photoUrl, voiceUrl })
  )}`;
}

export function decodeMemoryMedia(value?: string | null): MemoryMedia {
  if (!value) return { photoUrl: null, voiceUrl: null };
  if (!value.startsWith(memoryMediaPrefix)) {
    return { photoUrl: toBrowserSupabaseUrl(value), voiceUrl: null };
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(value.slice(memoryMediaPrefix.length))) as {
      photoUrl?: unknown;
      voiceUrl?: unknown;
    };

    return {
      photoUrl:
        typeof parsed.photoUrl === "string" ? toBrowserSupabaseUrl(parsed.photoUrl) : null,
      voiceUrl:
        typeof parsed.voiceUrl === "string" ? toBrowserSupabaseUrl(parsed.voiceUrl) : null,
    };
  } catch {
    return { photoUrl: null, voiceUrl: null };
  }
}
