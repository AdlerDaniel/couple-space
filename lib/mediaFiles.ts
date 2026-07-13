export type AppMediaKind = "image" | "video" | "audio" | "file";

const audioMimeCandidates = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];

const imageExtensions = new Set([
  "avif",
  "gif",
  "heic",
  "heif",
  "jpeg",
  "jpg",
  "png",
  "webp",
]);
const videoExtensions = new Set(["m4v", "mov", "mp4", "webm"]);
const audioExtensions = new Set(["aac", "m4a", "mp3", "mp4", "ogg", "opus", "wav", "webm"]);

export const MAX_IMAGE_SIZE = 25 * 1024 * 1024;
export const MAX_AUDIO_SIZE = 15 * 1024 * 1024;

function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "";
}

export function getMediaKind(file: Pick<File, "name" | "type">): AppMediaKind {
  const mimeType = file.type.toLowerCase();
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";

  const extension = getFileExtension(file.name);
  if (imageExtensions.has(extension)) return "image";
  if (videoExtensions.has(extension)) return "video";
  if (audioExtensions.has(extension)) return "audio";
  return "file";
}

export function validateMediaFile(
  file: Pick<File, "name" | "size" | "type">,
  allowedKinds: AppMediaKind[],
  maximumSize: number
) {
  const kind = getMediaKind(file);
  if (!allowedKinds.includes(kind)) {
    return { kind, error: `Файл «${file.name}» имеет неподдерживаемый формат.` };
  }

  if (file.size <= 0) {
    return { kind, error: `Файл «${file.name}» пустой.` };
  }

  if (file.size > maximumSize) {
    const sizeInMb = Math.round(maximumSize / 1024 / 1024);
    return { kind, error: `Файл «${file.name}» слишком большой. Максимум ${sizeInMb} МБ.` };
  }

  return { kind, error: null };
}

export function getSupportedAudioMimeType(
  mediaRecorderApi: Pick<typeof MediaRecorder, "isTypeSupported"> | null =
    typeof MediaRecorder === "undefined" ? null : MediaRecorder
) {
  if (!mediaRecorderApi?.isTypeSupported) return "";
  return audioMimeCandidates.find((mimeType) => mediaRecorderApi.isTypeSupported(mimeType)) || "";
}

export function createCompatibleAudioRecorder(stream: MediaStream) {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("Запись голоса не поддерживается этим браузером");
  }

  const mimeType = getSupportedAudioMimeType();
  return mimeType
    ? new MediaRecorder(stream, { mimeType })
    : new MediaRecorder(stream);
}

export function getAudioExtension(mimeType: string) {
  const normalizedMimeType = mimeType.toLowerCase();
  if (normalizedMimeType.includes("mp4") || normalizedMimeType.includes("aac")) return "m4a";
  if (normalizedMimeType.includes("ogg") || normalizedMimeType.includes("opus")) return "ogg";
  if (normalizedMimeType.includes("mpeg")) return "mp3";
  if (normalizedMimeType.includes("wav")) return "wav";
  return "webm";
}

export function createRecordedAudioFile(
  chunks: Blob[],
  recorderMimeType: string,
  baseName = "voice"
) {
  const mimeType = recorderMimeType || chunks.find((chunk) => chunk.type)?.type || "audio/webm";
  const blob = new Blob(chunks, { type: mimeType });
  if (blob.size <= 0) {
    throw new Error("Запись получилась пустой. Попробуйте записать голос ещё раз.");
  }

  return new File([blob], `${baseName}-${Date.now()}.${getAudioExtension(mimeType)}`, {
    type: mimeType,
    lastModified: Date.now(),
  });
}

export function getSafeStoragePath(coupleId: string, file: Pick<File, "name" | "type">) {
  const nameExtension = getFileExtension(file.name);
  const mimeExtension = file.type.split("/").pop()?.split(";")[0]?.replace(/[^a-z0-9]/gi, "");
  const safeExtension = nameExtension || mimeExtension || "bin";
  return `${coupleId}/${crypto.randomUUID()}.${safeExtension}`;
}
