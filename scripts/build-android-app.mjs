import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const androidDirectory = path.join(projectDirectory, "android-app");
const javaHome = path.join(
  projectDirectory,
  ".tools",
  "android",
  "jdk",
  "jdk-17.0.20+8",
);
const androidSdk =
  process.env.ANDROID_SDK_ROOT ??
  process.env.ANDROID_HOME ??
  "R:\\Users\\vremy\\.bubblewrap\\android_sdk";
const proxyPort = process.env.GOOGLE_MAVEN_PROXY_PORT ?? "8765";
const buildEnvironment = {
  ...process.env,
  JAVA_HOME: javaHome,
  ANDROID_HOME: androidSdk,
  ANDROID_SDK_ROOT: androidSdk,
  GRADLE_USER_HOME:
    process.env.GRADLE_USER_HOME ??
    path.join(projectDirectory, ".tools", "android", "gradle-home-clean"),
  GOOGLE_MAVEN_PROXY: `http://127.0.0.1:${proxyPort}/dl/android/maven2`,
  GOOGLE_MAVEN_PROXY_PORT: proxyPort,
  PATH: `${path.join(javaHome, "bin")}${path.delimiter}${process.env.PATH ?? ""}`,
};

function run(executable, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      stdio: "inherit",
      ...options,
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${path.basename(executable)} exited with ${signal ?? `code ${code}`}`,
        ),
      );
    });
  });
}

function startGoogleMavenProxy() {
  const proxy = spawn(
    process.execPath,
    [path.join(scriptDirectory, "google-maven-proxy.mjs")],
    {
      cwd: projectDirectory,
      env: buildEnvironment,
      stdio: ["ignore", "pipe", "inherit"],
    },
  );

  const ready = new Promise((resolve, reject) => {
    proxy.once("error", reject);
    proxy.once("exit", (code) => {
      reject(new Error(`Google Maven proxy exited before startup with code ${code}`));
    });
    proxy.stdout.on("data", (chunk) => {
      const message = chunk.toString();
      process.stdout.write(message);
      if (message.includes("Google Maven proxy listening")) resolve();
    });
  });

  return { proxy, ready };
}

const { proxy, ready } = startGoogleMavenProxy();

try {
  await ready;
  await run(
    process.env.ComSpec || "cmd.exe",
    ["/d", "/s", "/c", "gradlew.bat", "assembleRelease"],
    {
      cwd: androidDirectory,
      env: buildEnvironment,
    },
  );
  await run(process.execPath, [path.join(scriptDirectory, "sign-android-apk.mjs")], {
    cwd: projectDirectory,
    env: buildEnvironment,
  });
} finally {
  proxy.kill();
}
