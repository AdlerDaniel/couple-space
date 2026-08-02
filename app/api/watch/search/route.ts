import {
  dedupeWatchSearchResults,
  mapImdbSuggestionItem,
  mapItunesSearchItem,
  mapTmdbSearchItem,
  type WatchSearchResult,
} from "@/lib/watchSearch";
import { enforceRateLimit } from "@/lib/apiSecurity";
import { getAdminClient, getAuthenticatedUser } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type SearchResponse = {
  results?: unknown[];
};

type ImdbSuggestionResponse = {
  d?: unknown[];
};

type ItunesSearchResponse = {
  results?: unknown[];
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

async function searchItunesCatalog(
  query: string,
  media: "movie" | "tvShow",
  entity: "movie" | "tvSeason",
): Promise<WatchSearchResult[]> {
  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("term", query);
  url.searchParams.set("media", media);
  url.searchParams.set("entity", entity);
  url.searchParams.set("country", "US");
  url.searchParams.set("limit", "8");

  const response = await fetch(url, {
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!response.ok) return [];

  const data = (await response.json()) as ItunesSearchResponse;
  return (data.results || [])
    .map((item) =>
      mapItunesSearchItem(
        isRecord(item) ? (item as Parameters<typeof mapItunesSearchItem>[0]) : {},
        media === "tvShow" ? "series" : "movie",
      ),
    )
    .filter((item): item is WatchSearchResult => item !== null);
}

async function searchItunes(query: string): Promise<WatchSearchResult[]> {
  const searches = await Promise.allSettled([
    searchItunesCatalog(query, "movie", "movie"),
    searchItunesCatalog(query, "tvShow", "tvSeason"),
  ]);

  return searches.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}

export async function GET(request: Request) {
  const adminSupabase = getAdminClient();
  if (!adminSupabase) {
    return Response.json({ error: "Поиск временно недоступен" }, { status: 503 });
  }

  const user = await getAuthenticatedUser(adminSupabase, request);
  if (!user) return Response.json({ error: "Не выполнен вход" }, { status: 401 });

  const rateLimitResponse = await enforceRateLimit(adminSupabase, request, {
    route: "watch-search",
    identity: user.id,
    limit: 30,
    windowMs: 60_000,
  });
  if (rateLimitResponse) return rateLimitResponse;

  const query = getSafeQuery(request);
  if (query.length < 2) {
    return Response.json({ results: [] });
  }

  const searches = await Promise.allSettled([
    searchTmdb(query),
    searchImdb(query),
    searchItunes(query),
  ]);
  const results = searches.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );

  return Response.json({
    results: dedupeWatchSearchResults(results).slice(0, 8),
  });
}
