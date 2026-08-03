import { cp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const packageRoot = path.join(root, "node_modules", "@lobehub", "fluent-emoji-3d");
const sourceAssets = path.join(packageRoot, "assets");
const outputRoot = path.join(root, "public", "fluent-emoji");
const outputAssets = path.join(outputRoot, "3d");
const markerPath = path.join(outputRoot, ".version");

const packageJson = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));
const versionMarker = `${packageJson.name}@${packageJson.version}`;

await mkdir(outputRoot, { recursive: true });

let currentMarker = "";
try {
  currentMarker = await readFile(markerPath, "utf8");
} catch {
  // The first run prepares the public assets.
}

if (currentMarker.trim() !== versionMarker) {
  await cp(sourceAssets, outputAssets, { recursive: true, force: true });
  await writeFile(markerPath, `${versionMarker}\n`, "utf8");
}

const [emojiData, messages] = await Promise.all([
  readFile(path.join(root, "node_modules", "emojibase-data", "ru", "data.json"), "utf8").then(JSON.parse),
  readFile(path.join(root, "node_modules", "emojibase-data", "ru", "messages.json"), "utf8").then(JSON.parse),
]);

const groupNames = Object.fromEntries(messages.groups.map((group) => [group.order, group.message]));

function assetName(hexcode) {
  return `${hexcode.toLowerCase()}.webp`;
}

async function hasAsset(fileName) {
  try {
    await stat(path.join(sourceAssets, fileName));
    return true;
  } catch {
    return false;
  }
}

const emojis = [];
for (const item of emojiData) {
  if (typeof item.group !== "number" || item.group === 2) continue;

  const asset = assetName(item.hexcode);
  if (!(await hasAsset(asset))) continue;

  const skins = [];
  for (const skin of item.skins || []) {
    const skinAsset = assetName(skin.hexcode);
    if (await hasAsset(skinAsset)) {
      skins.push({ emoji: skin.emoji, label: skin.label, asset: skinAsset, tone: skin.tone });
    }
  }

  emojis.push({
    emoji: item.emoji,
    label: item.label,
    tags: item.tags || [],
    group: item.group,
    order: item.order || 0,
    asset,
    skins,
  });
}

emojis.sort((a, b) => a.order - b.order);

await writeFile(
  path.join(outputRoot, "index.json"),
  JSON.stringify({
    version: versionMarker,
    groups: Object.entries(groupNames).map(([id, label]) => ({ id: Number(id), label })),
    emojis,
  }),
  "utf8",
);

console.log(`Fluent Emoji: prepared ${emojis.length} emoji and ${versionMarker}.`);
