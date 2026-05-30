import assert from "node:assert/strict";
import test from "node:test";

import {
  dedupeWatchSearchResults,
  getHighResolutionArtwork,
  getTmdbPosterUrl,
  getYearFromReleaseDate,
  mapImdbSuggestionItem,
  mapItunesSearchItem,
  mapTmdbSearchItem,
} from "../lib/watchSearch.ts";

test("watch search maps iTunes movie result", () => {
  const result = mapItunesSearchItem(
    {
      trackId: 123,
      trackName: "Interstellar",
      primaryGenreName: "Sci-Fi & Fantasy",
      releaseDate: "2014-11-07T08:00:00Z",
      artworkUrl100: "https://example.com/100x100bb.jpg",
      trackViewUrl: "https://example.com/interstellar",
      kind: "feature-movie",
    },
    "movie",
  );

  assert.equal(result?.title, "Interstellar");
  assert.equal(result?.contentType, "movie");
  assert.equal(result?.year, "2014");
  assert.equal(result?.posterUrl, "https://example.com/600x900bb.jpg");
});

test("watch search maps tv collections as series", () => {
  const result = mapItunesSearchItem(
    {
      collectionId: 456,
      collectionName: "Severance, Season 1",
      wrapperType: "collection",
      primaryGenreName: "Drama",
    },
    "movie",
  );

  assert.equal(result?.contentType, "series");
});

test("watch search maps TMDB movies with posters", () => {
  const result = mapTmdbSearchItem({
    id: 603,
    media_type: "movie",
    title: "Матрица",
    original_title: "The Matrix",
    release_date: "1999-03-31",
    poster_path: "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
  });

  assert.equal(result?.id, "tmdb-movie-603");
  assert.equal(result?.title, "Матрица");
  assert.equal(result?.contentType, "movie");
  assert.equal(result?.year, "1999");
  assert.equal(result?.posterUrl, "https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg");
  assert.equal(result?.externalUrl, "https://www.themoviedb.org/movie/603");
});

test("watch search maps TMDB tv results as series", () => {
  const result = mapTmdbSearchItem({
    id: 66732,
    media_type: "tv",
    name: "Очень странные дела",
    original_name: "Stranger Things",
    first_air_date: "2016-07-15",
  });

  assert.equal(result?.contentType, "series");
  assert.equal(result?.subtitle, "2016 · Сериал · Stranger Things");
});

test("watch search maps IMDb title suggestions", () => {
  const result = mapImdbSuggestionItem({
    id: "tt0133093",
    l: "The Matrix",
    q: "feature",
    y: 1999,
    i: { imageUrl: "https://example.com/matrix.jpg" },
  });

  assert.equal(result?.id, "imdb-tt0133093");
  assert.equal(result?.title, "The Matrix");
  assert.equal(result?.contentType, "movie");
  assert.equal(result?.posterUrl, "https://example.com/matrix.jpg");
});

test("watch search ignores IMDb people suggestions", () => {
  assert.equal(
    mapImdbSuggestionItem({
      id: "nm0000206",
      l: "Keanu Reeves",
      q: "actor",
    }),
    null,
  );
});

test("watch search deduplicates by title type and year", () => {
  const results = dedupeWatchSearchResults([
    {
      id: "1",
      title: "Movie",
      contentType: "movie",
      posterUrl: null,
      externalUrl: null,
      year: "2026",
      subtitle: null,
    },
    {
      id: "2",
      title: "movie",
      contentType: "movie",
      posterUrl: null,
      externalUrl: null,
      year: "2026",
      subtitle: null,
    },
  ]);

  assert.equal(results.length, 1);
});

test("watch search handles invalid dates and empty artwork", () => {
  assert.equal(getYearFromReleaseDate("not-a-date"), null);
  assert.equal(getHighResolutionArtwork(), null);
  assert.equal(getTmdbPosterUrl(), null);
});
