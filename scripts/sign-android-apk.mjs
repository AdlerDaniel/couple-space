import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const sdkDirectory =
  process.env.ANDROID_SDK_ROOT ??
  process.env.ANDROID_HOME ??
  "R:\\Users\\vremy\\.bubblewrap\\android_sdk";
const buildToolsDirectory = path.join(sdkDirectory, "build-tools", "36.0.0");
const signingDirectory = path.join(projectDirectory, ".android-signing");
const outputDirectory = path.join(projectDirectory, "outputs");
const unsignedApk = path.join(
  projectDirectory,
  "android-app",
  "app",
  "build",
  "outputs",
  "apk",
  "release",
  "app-release-unsigned.apk",
);
const alignedApk = path.join(outputDirectory, "Couple-Space-aligned.apk");
const signedApk = path.join(outputDirectory, "Couple-Space.apk");
const javaHome = path.join(
  projectDirectory,
  ".tools",
  "android",
  "jdk",
  "jdk-17.0.20+8",
);
const credentials = JSON.parse(
  await readFile(path.join(signingDirectory, "credentials.json"), "utf8"),
);
const signingEnvironment = {
  ...process.env,
  JAVA_HOME: javaHome,
  PATH: `${path.join(javaHome, "bin")}${path.delimiter}${process.env.PATH ?? ""}`,
  COUPLE_SPACE_KEYSTORE_PASSWORD: credentials.keystorePassword,
  COUPLE_SPACE_KEY_PASSWORD: credentials.keyPassword,
};

function run(executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    cwd: projectDirectory,
    encoding: "utf8",
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(
      result.stderr || result.stdout || `${path.basename(executable)} failed`,
    );
  }

  return `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
}

await mkdir(outputDirectory, { recursive: true });

run(path.join(buildToolsDirectory, "zipalign.exe"), [
  "-f",
  "-p",
  "4",
  unsignedApk,
  alignedApk,
]);

run(
  process.env.ComSpec || "cmd.exe",
  [
    "/d",
    "/s",
    "/c",
    path.join(buildToolsDirectory, "apksigner.bat"),
    "sign",
    "--ks",
    path.join(signingDirectory, "couple-space.keystore"),
    "--ks-key-alias",
    credentials.alias,
    "--ks-pass",
    "env:COUPLE_SPACE_KEYSTORE_PASSWORD",
    "--key-pass",
    "env:COUPLE_SPACE_KEY_PASSWORD",
    "--out",
    signedApk,
    alignedApk,
  ],
  { env: signingEnvironment },
);

const verification = run(
  process.env.ComSpec || "cmd.exe",
  [
    "/d",
    "/s",
    "/c",
    path.join(buildToolsDirectory, "apksigner.bat"),
    "verify",
    "--verbose",
    "--print-certs",
    signedApk,
  ],
  { env: signingEnvironment },
);

console.log(verification);
console.log(`Signed APK: ${signedApk}`);
