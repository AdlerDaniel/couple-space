import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const signingDirectory = path.join(projectDirectory, ".android-signing");
const credentials = JSON.parse(
  await readFile(path.join(signingDirectory, "credentials.json"), "utf8"),
);
const keystorePath = path.join(signingDirectory, "couple-space.keystore");
const jdkDirectory = path.join(projectDirectory, ".tools", "android", "jdk");

let keytool;
for (const entry of await readdir(jdkDirectory, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;

  const candidate = path.join(jdkDirectory, entry.name, "bin", "keytool.exe");
  try {
    await stat(candidate);
    keytool = candidate;
    break;
  } catch {
    // Continue looking for the extracted JDK directory.
  }
}

if (!keytool) throw new Error("JDK keytool was not found.");

const result = spawnSync(
  keytool,
  [
    "-list",
    "-v",
    "-alias",
    credentials.alias,
    "-keystore",
    keystorePath,
    "-storepass",
    credentials.keystorePassword,
  ],
  { encoding: "utf8" },
);

if (result.status !== 0) {
  throw new Error(result.stderr || result.stdout || "Failed to inspect Android signing key.");
}

const match = result.stdout.match(/SHA256:\s*([0-9A-F:]+)/i);
if (!match) throw new Error("SHA-256 fingerprint was not found.");

console.log(match[1].toUpperCase());
