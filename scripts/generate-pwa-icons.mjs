import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const source = await readFile(path.join(projectDirectory, "app", "icon.svg"));
const outputDirectory = path.join(projectDirectory, "public", "icons");

await mkdir(outputDirectory, { recursive: true });

async function generateIcon(filename, size, logoScale) {
  const logoSize = Math.round(size * logoScale);
  const logo = await sharp(source, { density: 192 })
    .resize(logoSize, logoSize, { fit: "contain" })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: "#f4f8f4",
    },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(path.join(outputDirectory, filename));
}

await Promise.all([
  generateIcon("couple-space-192.png", 192, 0.82),
  generateIcon("couple-space-512.png", 512, 0.82),
  generateIcon("couple-space-maskable-512.png", 512, 0.62),
]);
