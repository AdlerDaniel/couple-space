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

async function createImageSource(file: File) {
  if (typeof createImageBitmap !== "function") return null;

  try {
    return await createImageBitmap(file);
  } catch {
    return null;
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
  if (!file.type.startsWith("image/")) return file;

  const image = await createImageSource(file);
  if (!image) return file;

  const size = getScaledSize(image.width, image.height, maxWidth, maxHeight);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    image.close();
    return file;
  }

  ctx.drawImage(image, 0, 0, size.width, size.height);
  image.close();

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
