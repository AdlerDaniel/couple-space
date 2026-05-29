"use client";

import AppRouteErrorFallback from "@/components/AppRouteErrorFallback";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return <AppRouteErrorFallback error={error} unstable_retry={unstable_retry} />;
}
