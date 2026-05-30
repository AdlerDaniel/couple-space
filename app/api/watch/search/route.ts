import {
  dedupeWatchSearchResults,
  mapImdbSuggestionItem,
  mapTmdbSearchItem,
  type WatchSearchResult,
} from "@/lib/watchSearch";

export const runtime = "nodejs";

type SearchResponse = {
  results?: unknown[];
};

type ImdbSuggestionResponse = {
  d?: unknown[];
};

function getSafeQuery(request: Request) {
  const { searchParams } = new URL(request.url);
  return (searchParams.get("q") || "").trim().replace(/\s+/g, " ").slice(0, 80);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

async function searchTmdb(query: string): Promise<WatchSearchResult[]> {
  const token = process.env.TMDB_READ_ACCESS_TOKEN;
  const apiKey = process.env.TMDB_API_KEY;
  if (!token && !apiKey) return [];

  const url = new URL("https://api.themoviedb.org/3/search/multi");
  url.searchParams.set("query", query);
  url.searchParams.set("include_adult", "false");
  url.searchParams.set("language", "ru-RU");
  url.searchParams.set("page", "1");
  if (!token && apiKey) {
    url.searchParams.set("api_key", apiKey);
  }

  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!response.ok) return [];

  const data = (await response.json()) as SearchResponse;
  return (data.results || [])
    .map((item) =>
      mapTmdbSearchItem(isRecord(item) ? (item as Parameters<typeof mapTmdbSearchItem>[0]) : {}),
    )
    .filter((item): item is WatchSearchResult => item !== null);
}

function getImdbSuggestionUrl(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!/^[a-z0-9]/i.test(normalized)) return null;

  const encoded = encodeURIComponent(normalized);
  return `https://v3.sg.media-imdb.com/suggestion/${encoded[0]}/${encoded}.json`;
}

async function searchImdb(query: string): Promise<WatchSearchResult[]> {
  const url = getImdbSuggestionUrl(query);
  if (!url) return [];

  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 CoupleSpaceWatchSearch/1.0",
    },
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!response.ok) return [];

  const data = (await response.json()) as ImdbSuggestionResponse;
  return (data.d || [])
    .map((item) =>
      mapImdbSuggestionItem(
        isRecord(item) ? (item as Parameters<typeof mapImdbSuggestionItem>[0]) : {},
      ),
    )
    .filter((item): item is WatchSearchResult => item !== null);
}

export async function GET(request: Request) {
  const query = getSafeQuery(request);
  if (query.length < 2) {
    return Response.json({ results: [] });
  }

  try {
    const tmdbResults = await searchTmdb(query);
    const results = tmdbResults.length ? tmdbResults : await searchImdb(query);

    return Response.json({
      results: dedupeWatchSearchResults(results).slice(0, 8),
    });
  } catch {
    return Response.json({ results: [] });
  }
}
