import { getMediaKind } from "@/lib/mediaFiles";

type CompressImageOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  fileName?: string;
};

function getScaledSize(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number
) {
  const ratio = Math.min(1, maxWidth / width, maxHeight / height);

  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Не удалось сжать изображение"));
          return;
        }

        resolve(blob);
      },
      "image/webp",
      quality
    );
  });
}

async function createImageSource(file: File): Promise<ImageBitmap | HTMLImageElement | null> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Safari can decode some camera formats through <img> even when
      // createImageBitmap is unavailable or rejects the file.
    }
  }

  if (typeof Image === "undefined" || typeof URL === "undefined") return null;

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = objectUrl;
    if (typeof image.decode === "function") {
      await image.decode();
    } else {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Не удалось прочитать изображение"));
      });
    }
    return image;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function compressImageFile(
  file: File,
  {
    maxWidth = 1600,
    maxHeight = 1600,
    quality = 0.78,
    fileName,
  }: CompressImageOptions = {}
) {
  if (getMediaKind(file) !== "image") return file;

  const image = await createImageSource(file);
  if (!image) return file;

  const sourceWidth = "naturalWidth" in image ? image.naturalWidth : image.width;
  const sourceHeight = "naturalHeight" in image ? image.naturalHeight : image.height;
  const size = getScaledSize(sourceWidth, sourceHeight, maxWidth, maxHeight);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    if ("close" in image && typeof image.close === "function") image.close();
    return file;
  }

  ctx.drawImage(image, 0, 0, size.width, size.height);
  if ("close" in image && typeof image.close === "function") image.close();

  let blob: Blob;
  try {
    blob = await canvasToBlob(canvas, quality);
  } catch {
    return file;
  }

  const compressedName =
    fileName || `${file.name.replace(/\.[^.]+$/, "") || crypto.randomUUID()}.webp`;

  return new File([blob], compressedName.endsWith(".webp") ? compressedName : `${compressedName}.webp`, {
    type: "image/webp",
    lastModified: Date.now(),
  });
}
