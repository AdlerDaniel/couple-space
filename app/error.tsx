"use client";

import AppRouteErrorFallback from "@/components/AppRouteErrorFallback";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <AppRouteErrorFallback error={error} reset={reset} />;
}
