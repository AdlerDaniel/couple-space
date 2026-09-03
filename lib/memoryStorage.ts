import { decodeMemoryMedia, encodeMemoryMedia, type MemoryMedia } from "@/lib/memoryMedia";
import { supabase } from "@/lib/supabaseClient";
import { toPortableSupabaseUrl } from "@/lib/supabaseUrls";

const MEMORY_BUCKET = "memory-images";
const SIGNED_URL_TTL_SECONDS = 4 * 60 * 60;

export function getMemoryStoragePath(value?: string | null) {
  if (!value) return null;
  const clean = value.split(/[?#]/, 1)[0];
  const marker = `/storage/v1/object/`;
  const index = clean.indexOf(marker);
  if (index < 0) return null;
  const remainder = clean.slice(index + marker.length);
  const bucketPrefix = /^(?:public|sign|authenticated)\/memory-images\//.exec(remainder);
  if (!bucketPrefix) return null;
  try {
    const path = decodeURIComponent(remainder.slice(bucketPrefix[0].length)).replace(/^\/+/, "");
    if (!path || path.split("/").some((part) => part === "." || part === "..")) return null;
    return path;
  } catch {
    return null;
  }
}

function mapMediaUrls(media: MemoryMedia, map: (url: string) => string | null): MemoryMedia {
  return {
    photoUrl: media.photoUrl ? map(media.photoUrl) : null,
    voiceUrl: media.voiceUrl ? map(media.voiceUrl) : null,
    attachments: (media.attachments || []).flatMap((attachment) => {
      const url = map(attachment.url);
      return url ? [{ ...attachment, url }] : [];
    }),
  };
}

async function signUrl(value: string) {
  const path = getMemoryStoragePath(value);
  if (!path) return value;
  const { data, error } = await supabase.storage.from(MEMORY_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  return error || !data?.signedUrl ? value : data.signedUrl;
}

export async function signMemoryMediaValue(value?: string | null) {
  if (!value) return null;
  const media = decodeMemoryMedia(value);
  const urls = [
    media.photoUrl,
    media.voiceUrl,
    ...(media.attachments || []).map((attachment) => attachment.url),
  ].filter((url): url is string => Boolean(url));
  const signed = new Map<string, string>();
  await Promise.all(urls.map(async (url) => signed.set(url, await signUrl(url))));
  return encodeMemoryMedia(mapMediaUrls(media, (url) => signed.get(url) || url));
}

export async function signMemoryMediaRow<T extends { image: string | null }>(row: T): Promise<T> {
  return { ...row, image: await signMemoryMediaValue(row.image) };
}

export async function signMemoryMediaRows<T extends { image: string | null }>(rows: T[]) {
  return Promise.all(rows.map(signMemoryMediaRow));
}

export function normalizeMemoryMediaValueForStorage(value?: string | null) {
  if (!value) return null;
  const media = decodeMemoryMedia(value);
  return encodeMemoryMedia(mapMediaUrls(media, (url) => {
    const path = getMemoryStoragePath(url);
    if (!path) return url;
    const { data } = supabase.storage.from(MEMORY_BUCKET).getPublicUrl(path);
    return toPortableSupabaseUrl(data.publicUrl) || data.publicUrl;
  }));
}
