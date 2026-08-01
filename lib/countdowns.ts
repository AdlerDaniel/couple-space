export type CountdownTimeParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isCompleted: boolean;
};

export function toLocalDateTimeValue(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function sortCountdowns<T extends { target_at: string }>(rows: T[], now = Date.now()) {
  return [...rows].sort((first, second) => {
    const firstTime = new Date(first.target_at).getTime();
    const secondTime = new Date(second.target_at).getTime();
    const firstIsPast = firstTime <= now;
    const secondIsPast = secondTime <= now;

    if (firstIsPast !== secondIsPast) return firstIsPast ? 1 : -1;
    return firstIsPast ? secondTime - firstTime : firstTime - secondTime;
  });
}

export function getCountdownTimeParts(targetAt: string, now: number): CountdownTimeParts {
  const targetTime = new Date(targetAt).getTime();
  const difference = Math.max(0, targetTime - now);

  return {
    days: Math.floor(difference / 86_400_000),
    hours: Math.floor((difference % 86_400_000) / 3_600_000),
    minutes: Math.floor((difference % 3_600_000) / 60_000),
    seconds: Math.floor((difference % 60_000) / 1_000),
    isCompleted: targetTime <= now,
  };
}
