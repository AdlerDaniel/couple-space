export const networkDiagnosticsStorageKey = "couple-space:network-diagnostics-report";
export const lastRouteErrorStorageKey = "couple-space:last-route-error";
export const failedResourcesStorageKey = "couple-space:failed-resources";

export type DiagnosticStatus = "ok" | "failed" | "skipped";

export type NetworkDiagnosticClassification =
  | "ok"
  | "origin-blocked"
  | "chunk-failed"
  | "supabase-blocked"
  | "realtime-blocked"
  | "unknown";

export type NetworkDiagnosticSignals = {
  failedResources: string[];
  originStatus: DiagnosticStatus;
  staticAssetsStatus: DiagnosticStatus;
  supabaseRestStatus: DiagnosticStatus;
  supabaseAuthStatus: DiagnosticStatus;
  realtimeStatus: DiagnosticStatus;
};

export type NetworkDiagnosticCheck = {
  label: string;
  status: DiagnosticStatus;
  url?: string;
  message?: string;
  durationMs?: number;
};

export type NetworkDiagnosticReport = NetworkDiagnosticSignals & {
  classification: NetworkDiagnosticClassification;
  createdAt: string;
  currentUrl: string;
  userAgent: string;
  online: boolean;
  effectiveType: string | null;
  lastError: string | null;
  checks: {
    origin: NetworkDiagnosticCheck;
    staticAssets: NetworkDiagnosticCheck;
    supabaseRest: NetworkDiagnosticCheck;
    supabaseAuth: NetworkDiagnosticCheck;
    realtime: NetworkDiagnosticCheck;
  };
};

type ConnectionNavigator = Navigator & {
  connection?: {
    effectiveType?: string;
  };
};

type ResourceWithStatus = PerformanceResourceTiming & {
  responseStatus?: number;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function getMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error || "unknown error");
}

function getStoredString(key: string) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function getStoredStringArray(key: string) {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(key) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))].slice(0, 30);
}

function isNextStaticResource(url: string) {
  return /\/_next\/static\/|\/_next\/webpack|\/_next\/.*\.(js|css)(\?|$)/i.test(url);
}

function getFailedPerformanceResources() {
  if (typeof performance === "undefined" || !performance.getEntriesByType) return [];

  return performance
    .getEntriesByType("resource")
    .filter((entry): entry is ResourceWithStatus => "name" in entry)
    .filter((entry) => {
      const status = entry.responseStatus;
      return Boolean(status && status >= 400) || (isNextStaticResource(entry.name) && entry.duration === 0);
    })
    .map((entry) => entry.name);
}

async function timedCheck(
  label: string,
  url: string | undefined,
  check: (signal: AbortSignal) => Promise<void>,
): Promise<NetworkDiagnosticCheck> {
  if (!url) {
    return { label, status: "skipped", message: "URL не настроен" };
  }

  const startedAt = now();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 4500);

  try {
    await check(controller.signal);
    return {
      label,
      status: "ok",
      url,
      durationMs: Math.round(now() - startedAt),
    };
  } catch (error) {
    return {
      label,
      status: "failed",
      url,
      message: getMessage(error),
      durationMs: Math.round(now() - startedAt),
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

function assertResponse(response: Response) {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
}

export function normalizeSupabaseRestStatus(
  status: DiagnosticStatus,
  message?: string,
): DiagnosticStatus {
  if (status === "failed" && message === "HTTP 401") return "ok";
  return status;
}

function normalizeSupabaseRestCheck(check: NetworkDiagnosticCheck): NetworkDiagnosticCheck {
  const status = normalizeSupabaseRestStatus(check.status, check.message);
  if (status === check.status) return check;

  return {
    ...check,
    status,
    message: "REST endpoint отвечает HTTP 401, значит сеть до Supabase работает.",
  };
}

function getRealtimeUrl() {
  if (!supabaseUrl || !supabaseAnonKey) return "";
  const url = new URL("/realtime/v1/websocket", supabaseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("apikey", supabaseAnonKey);
  url.searchParams.set("vsn", "1.0.0");
  return url.toString();
}

function checkRealtime(url: string, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const socket = new WebSocket(url);

    function cleanup() {
      signal.removeEventListener("abort", abort);
      socket.onopen = null;
      socket.onerror = null;
      socket.onclose = null;
    }

    function abort() {
      cleanup();
      socket.close();
      reject(new Error("timeout"));
    }

    signal.addEventListener("abort", abort);

    socket.onopen = () => {
      cleanup();
      socket.close();
      resolve();
    };
    socket.onerror = () => {
      cleanup();
      reject(new Error("WebSocket error"));
    };
    socket.onclose = () => {
      cleanup();
      reject(new Error("WebSocket closed before open"));
    };
  });
}

export function classifyNetworkDiagnostics(
  signals: NetworkDiagnosticSignals,
): NetworkDiagnosticClassification {
  if (signals.originStatus === "failed") return "origin-blocked";
  if (
    signals.staticAssetsStatus === "failed" ||
    signals.failedResources.some((resource) => isNextStaticResource(resource))
  ) {
    return "chunk-failed";
  }
  if (signals.supabaseRestStatus === "failed" || signals.supabaseAuthStatus === "failed") {
    return "supabase-blocked";
  }
  if (signals.realtimeStatus === "failed") return "realtime-blocked";
  if (
    signals.originStatus === "ok" &&
    signals.staticAssetsStatus === "ok" &&
    signals.supabaseRestStatus === "ok" &&
    signals.supabaseAuthStatus === "ok" &&
    (signals.realtimeStatus === "ok" || signals.realtimeStatus === "skipped")
  ) {
    return "ok";
  }

  return "unknown";
}

export function getDiagnosticSummary(classification: NetworkDiagnosticClassification) {
  if (classification === "origin-blocked") {
    return "Не открываются базовые ресурсы сайта. Проверьте VPN, DNS или блокировку домена.";
  }
  if (classification === "chunk-failed") {
    return "Не загружаются файлы интерфейса из /_next/static. Это похоже на кеш вкладки, расширение браузера или VPN-маршрут, который режет часть ресурсов Vercel.";
  }
  if (classification === "supabase-blocked") {
    return "Сайт открылся, но браузер не может достучаться до Supabase. Вход и данные пары будут ломаться.";
  }
  if (classification === "realtime-blocked") {
    return "Основные запросы работают, но WebSocket/Realtime блокируется. Чат и live-обновления могут работать нестабильно.";
  }
  if (classification === "ok") {
    return "Базовые сетевые проверки прошли. Если ошибка повторяется, вероятен кеш вкладки или расширение браузера.";
  }

  return "Не удалось однозначно определить источник сбоя. Скопируйте отчёт и сравните его с другим браузером или VPN.";
}

export async function runNetworkDiagnostics(lastError?: string | null) {
  const failedResources = unique([
    ...getStoredStringArray(failedResourcesStorageKey),
    ...getFailedPerformanceResources(),
  ]);

  const originUrl = typeof window !== "undefined" ? window.location.origin : "";
  const originCheck = await timedCheck("Сайт", originUrl, async (signal) => {
    const response = await fetch("/", { cache: "no-store", signal });
    assertResponse(response);
  });

  const staticAssetsCheck: NetworkDiagnosticCheck = {
    label: "Файлы интерфейса",
    status: failedResources.some((resource) => isNextStaticResource(resource)) ? "failed" : "ok",
    message:
      failedResources.length > 0
        ? `Проблемные ресурсы: ${failedResources.slice(0, 3).join(", ")}`
        : undefined,
  };

  const restUrl = supabaseUrl ? new URL("/rest/v1/", supabaseUrl).toString() : "";
  const authUrl = supabaseUrl ? new URL("/auth/v1/health", supabaseUrl).toString() : "";
  const rawRestCheck = await timedCheck("Supabase REST", restUrl, async (signal) => {
    const response = await fetch(restUrl, {
      cache: "no-store",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      signal,
    });
    assertResponse(response);
  });
  const restCheck = normalizeSupabaseRestCheck(rawRestCheck);
  const authCheck = await timedCheck("Supabase Auth", authUrl, async (signal) => {
    const response = await fetch(authUrl, {
      cache: "no-store",
      headers: { apikey: supabaseAnonKey },
      signal,
    });
    assertResponse(response);
  });

  const realtimeUrl = getRealtimeUrl();
  const realtimeCheck = await timedCheck("Supabase Realtime", realtimeUrl, (signal) =>
    checkRealtime(realtimeUrl, signal),
  );

  const signals: NetworkDiagnosticSignals = {
    failedResources,
    originStatus: originCheck.status,
    staticAssetsStatus: staticAssetsCheck.status,
    supabaseRestStatus: restCheck.status,
    supabaseAuthStatus: authCheck.status,
    realtimeStatus: realtimeCheck.status,
  };
  const classification = classifyNetworkDiagnostics(signals);
  const connection = (navigator as ConnectionNavigator).connection;

  const report: NetworkDiagnosticReport = {
    ...signals,
    classification,
    createdAt: new Date().toISOString(),
    currentUrl: window.location.href,
    userAgent: navigator.userAgent,
    online: navigator.onLine,
    effectiveType: connection?.effectiveType || null,
    lastError: lastError || getStoredString(lastRouteErrorStorageKey),
    checks: {
      origin: originCheck,
      staticAssets: staticAssetsCheck,
      supabaseRest: restCheck,
      supabaseAuth: authCheck,
      realtime: realtimeCheck,
    },
  };

  try {
    sessionStorage.setItem(networkDiagnosticsStorageKey, JSON.stringify(report));
  } catch {}

  return report;
}

export function formatNetworkDiagnosticReport(report: NetworkDiagnosticReport) {
  return JSON.stringify(report, null, 2);
}
