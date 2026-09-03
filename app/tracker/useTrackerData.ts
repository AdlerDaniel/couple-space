"use client";

import { useCallback, useEffect, useState } from "react";

import {
  fetchTrackerLabData,
  subscribeTrackerData,
  type TrackerLabSnapshot,
} from "@/lib/trackerRepository";

type UseTrackerDataOptions = {
  coupleId: string | null;
  year: number;
  onData: (snapshot: TrackerLabSnapshot) => void;
};

export function useTrackerData({ coupleId, year, onData }: UseTrackerDataOptions) {
  const [reloadVersion, setReloadVersion] = useState(0);
  const [completedRequest, setCompletedRequest] = useState<{
    key: string | null;
    error: string | null;
  }>({ key: null, error: null });
  const requestKey = coupleId ? `${coupleId}:${year}:${reloadVersion}` : null;

  const reload = useCallback(() => {
    setReloadVersion((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!coupleId || !requestKey) return;
    let ignore = false;
    void fetchTrackerLabData(coupleId, year)
      .then((snapshot) => {
        if (ignore) return;
        onData(snapshot);
        setCompletedRequest({ key: requestKey, error: null });
      })
      .catch((loadError: unknown) => {
        if (ignore) return;
        const message = loadError && typeof loadError === "object" && "message" in loadError
          ? String(loadError.message)
          : "Не удалось загрузить данные трекера";
        setCompletedRequest({ key: requestKey, error: message });
      });
    return () => {
      ignore = true;
    };
  }, [coupleId, onData, requestKey, year]);

  useEffect(() => {
    if (!coupleId) return;
    return subscribeTrackerData(coupleId, reload);
  }, [coupleId, reload]);

  return {
    isLoading: Boolean(requestKey && completedRequest.key !== requestKey),
    error: completedRequest.key === requestKey ? completedRequest.error : null,
    reload,
  };
}
