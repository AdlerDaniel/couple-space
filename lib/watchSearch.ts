export type WatchSearchContentType = "movie" | "series" | "cartoon" | "anime";

export type WatchSearchResult = {
  id: string;
  title: string;
  contentType: WatchSearchContentType;
  posterUrl: string | null;
  externalUrl: string | null;
  year: string | null;
  subtitle: string | null;
};

type ItunesSearchItem = {
  trackId?: number;
  collectionId?: number;
  trackName?: string;
  collectionName?: string;
  artistName?: string;
  primaryGenreName?: string;
  releaseDate?: string;
  artworkUrl100?: string;
  trackViewUrl?: string;
  collectionViewUrl?: string;
  kind?: string;
  wrapperType?: string;
};

type TmdbSearchItem = {
  id?: number;
  title?: string;
  name?: string;
  media_type?: string;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  original_title?: string;
  original_name?: string;
};

type ImdbSuggestionItem = {
  id?: string;
  l?: string;
  q?: string;
  y?: number;
  i?: {
    imageUrl?: string;
  };
};

export function getHighResolutionArtwork(url?: string) {
  if (!url) return null;
  return url.replace(/\/\d+x\d+bb\./, "/600x900bb.").replace(/\/\d+x\d+-\d+\./, "/600x900-75.");
}

export function getTmdbPosterUrl(path?: string | null) {
  return path ? `https://image.tmdb.org/t/p/w500${path}` : null;
}

export function getYearFromReleaseDate(value?: string) {
  if (!value) return null;
  const year = new Date(value).getFullYear();
  return Number.isFinite(year) ? String(year) : null;
}

export function mapTmdbSearchItem(item: TmdbSearchItem): WatchSearchResult | null {
  if (item.media_type !== "movie" && item.media_type !== "tv") return null;

  const title = item.media_type === "movie" ? item.title : item.name;
  if (!title || !item.id) return null;

  const year = getYearFromReleaseDate(
    item.media_type === "movie" ? item.release_date : item.first_air_date,
  );
  const originalTitle = item.media_type === "movie" ? item.original_title : item.original_name;
  const subtitleParts = [
    year,
    item.media_type === "movie" ? "Фильм" : "Сериал",
    originalTitle && originalTitle !== title ? originalTitle : null,
  ].filter(Boolean);

  return {
    id: `tmdb-${item.media_type}-${item.id}`,
    title,
    contentType: item.media_type === "tv" ? "series" : "movie",
    posterUrl: getTmdbPosterUrl(item.poster_path),
    externalUrl: `https://www.themoviedb.org/${item.media_type === "tv" ? "tv" : "movie"}/${item.id}`,
    year,
    subtitle: subtitleParts.length ? subtitleParts.join(" · ") : null,
  };
}

export function mapImdbSuggestionItem(item: ImdbSuggestionItem): WatchSearchResult | null {
  if (!item.id || !item.l || !item.id.startsWith("tt")) return null;

  const quality = item.q?.toLowerCase() || "";
  const isSeries = quality.includes("tv series") || quality.includes("tv mini");
  const isMovie =
    quality.includes("feature") ||
    quality.includes("tv movie") ||
    quality.includes("short") ||
    quality.includes("video");

  if (!isSeries && !isMovie) return null;

  return {
    id: `imdb-${item.id}`,
    title: item.l,
    contentType: isSeries ? "series" : "movie",
    posterUrl: item.i?.imageUrl || null,
    externalUrl: `https://www.imdb.com/title/${item.id}/`,
    year: item.y ? String(item.y) : null,
    subtitle: [item.y, isSeries ? "Сериал" : "Фильм"].filter(Boolean).join(" · ") || null,
  };
}

export function mapItunesSearchItem(
  item: ItunesSearchItem,
  fallbackContentType: WatchSearchContentType,
): WatchSearchResult | null {
  const title = item.trackName || item.collectionName;
  const rawId = item.trackId || item.collectionId;
  if (!title || !rawId) return null;

  const isTv = item.wrapperType === "collection" || item.kind === "tv-episode";
  const genre = item.primaryGenreName?.toLowerCase() || "";
  const contentType: WatchSearchContentType = isTv
    ? "series"
    : genre.includes("animation")
      ? "cartoon"
      : fallbackContentType;

  const year = getYearFromReleaseDate(item.releaseDate);
  const subtitleParts = [year, item.primaryGenreName, item.artistName].filter(Boolean);

  return {
    id: String(rawId),
    title,
    contentType,
    posterUrl: getHighResolutionArtwork(item.artworkUrl100),
    externalUrl: item.trackViewUrl || item.collectionViewUrl || null,
    year,
    subtitle: subtitleParts.length ? subtitleParts.join(" · ") : null,
  };
}

export function dedupeWatchSearchResults(results: WatchSearchResult[]) {
  const seen = new Set<string>();

  return results.filter((result) => {
    const key = `${result.contentType}:${result.title.toLowerCase()}:${result.year || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
