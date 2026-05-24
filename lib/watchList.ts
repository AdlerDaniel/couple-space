export type WatchListItemBase = {
  id: string;
  title: string;
  is_watched: boolean;
};

export function normalizeWatchTitle(title: string) {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizeOptionalUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function findDuplicateWatchTitle<T extends WatchListItemBase>(
  items: T[],
  title: string,
) {
  const normalized = normalizeWatchTitle(title);
  return items.find((item) => normalizeWatchTitle(item.title) === normalized) || null;
}

export function getRandomWatchItem<T extends WatchListItemBase>(
  items: T[],
  random = Math.random,
) {
  const availableItems = items.filter((item) => !item.is_watched);
  if (availableItems.length === 0) return null;
  const index = Math.floor(random() * availableItems.length);
  return availableItems[Math.min(index, availableItems.length - 1)];
}
