import { randomBytes } from "node:crypto";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const signingDirectory = path.join(projectDirectory, ".android-signing");
const keystorePath = path.join(signingDirectory, "couple-space.keystore");
const credentialsPath = path.join(signingDirectory, "credentials.json");
const jdkDirectory = path.join(projectDirectory, ".tools", "android", "jdk");

async function findKeytool() {
  const entries = await readdir(jdkDirectory, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const candidate = path.join(jdkDirectory, entry.name, "bin", "keytool.exe");
    try {
      await stat(candidate);
      return candidate;
    } catch {
      // Continue looking for the extracted JDK directory.
    }
  }

  throw new Error("JDK keytool was not found.");
}

await mkdir(signingDirectory, { recursive: true });

try {
  await stat(keystorePath);
  await stat(credentialsPath);
  process.exit(0);
} catch {
  // Generate the signing material only when it does not already exist.
}

const password = randomBytes(32).toString("base64url");
const alias = "couple-space";
const keytool = await findKeytool();
const result = spawnSync(
  keytool,
  [
    "-genkeypair",
    "-alias",
    alias,
    "-keyalg",
    "RSA",
    "-keysize",
    "2048",
    "-validity",
    "10000",
    "-storetype",
    "PKCS12",
    "-keystore",
    keystorePath,
    "-storepass",
    password,
    "-keypass",
    password,
    "-dname",
    "CN=Couple Space, OU=Mobile, O=Couple Space, L=Moscow, ST=Moscow, C=RU",
  ],
  { encoding: "utf8" },
);

if (result.status !== 0) {
  throw new Error(result.stderr || result.stdout || "Failed to generate Android signing key.");
}

await writeFile(
  credentialsPath,
  `${JSON.stringify({ alias, keystorePassword: password, keyPassword: password }, null, 2)}\n`,
  { encoding: "utf8", mode: 0o600 },
);
