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
  const [isLoading, setIsLoading] = useState(Boolean(coupleId));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setReloadVersion((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!coupleId) {
      setIsLoading(false);
      return;
    }
    let ignore = false;
    setIsLoading(true);
    setError(null);
    void fetchTrackerLabData(coupleId, year)
      .then((snapshot) => {
        if (!ignore) onData(snapshot);
      })
      .catch((loadError: unknown) => {
        if (!ignore) {
          setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить данные трекера");
        }
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [coupleId, onData, reloadVersion, year]);

  useEffect(() => {
    if (!coupleId) return;
    return subscribeTrackerData(coupleId, reload);
  }, [coupleId, reload]);

  return { isLoading, error, reload };
}
