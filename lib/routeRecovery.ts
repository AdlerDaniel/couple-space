export function getRouteErrorMessage(value: unknown) {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "message" in value) {
    return String((value as { message?: unknown }).message || "");
  }

  return "";
}

export function isRecoverableRouteError(value: unknown) {
  const message = getRouteErrorMessage(value);

  return /chunk|dynamically imported module|loading css chunk|failed to fetch|rsc|couldn.?t load|maximum call stack size exceeded/i.test(
    message,
  );
}
