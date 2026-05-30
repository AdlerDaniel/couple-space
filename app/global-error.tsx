"use client";

import AppRouteErrorFallback from "@/components/AppRouteErrorFallback";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <AppRouteErrorFallback error={error} reset={reset} global />;
}
