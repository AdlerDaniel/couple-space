import { toBrowserSupabaseUrl } from "./supabaseUrls.ts";

const memoryMediaPrefix = "couple-space-media:";

export type MemoryMedia = {
  photoUrl: string | null;
  voiceUrl: string | null;
  attachments?: MemoryAttachment[];
};

export type MemoryAttachment = {
  url: string;
  type: "image" | "video" | "audio" | "file";
  name: string;
  mimeType?: string | null;
  size?: number | null;
};

export function encodeMemoryMedia({ photoUrl, voiceUrl, attachments = [] }: MemoryMedia) {
  if (!voiceUrl && attachments.length === 0) return photoUrl;

  return `${memoryMediaPrefix}${encodeURIComponent(
    JSON.stringify({ version: 2, photoUrl, voiceUrl, attachments })
  )}`;
}

export function decodeMemoryMedia(value?: string | null): MemoryMedia {
  if (!value) return { photoUrl: null, voiceUrl: null, attachments: [] };
  if (!value.startsWith(memoryMediaPrefix)) {
    return { photoUrl: toBrowserSupabaseUrl(value), voiceUrl: null, attachments: [] };
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(value.slice(memoryMediaPrefix.length))) as {
      photoUrl?: unknown;
      voiceUrl?: unknown;
      attachments?: unknown;
    };

    const attachments = Array.isArray(parsed.attachments)
      ? parsed.attachments.flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const candidate = item as Record<string, unknown>;
          if (typeof candidate.url !== "string" || !["image", "video", "audio", "file"].includes(String(candidate.type))) return [];
          return [{
            url: toBrowserSupabaseUrl(candidate.url) || candidate.url,
            type: candidate.type as MemoryAttachment["type"],
            name: typeof candidate.name === "string" ? candidate.name : "Вложение",
            mimeType: typeof candidate.mimeType === "string" ? candidate.mimeType : null,
            size: typeof candidate.size === "number" ? candidate.size : null,
          }];
        })
      : [];

    return {
      photoUrl:
        typeof parsed.photoUrl === "string" ? toBrowserSupabaseUrl(parsed.photoUrl) : null,
      voiceUrl:
        typeof parsed.voiceUrl === "string" ? toBrowserSupabaseUrl(parsed.voiceUrl) : null,
      attachments,
    };
  } catch {
    return { photoUrl: null, voiceUrl: null, attachments: [] };
  }
}
