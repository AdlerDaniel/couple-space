import assert from "node:assert/strict";
import test from "node:test";

import { collectTrackerPages } from "../lib/trackerPagination.ts";

test("collectTrackerPages concatenates full pages until a short final page", async () => {
  const calls: Array<[number, number]> = [];
  const source = [1, 2, 3, 4, 5];
  const result = await collectTrackerPages<number, string>((from, to) => {
    calls.push([from, to]);
    return Promise.resolve({ data: source.slice(from, to + 1), error: null });
  }, 2);
  assert.deepEqual(result, { data: source, error: null });
  assert.deepEqual(calls, [[0, 1], [2, 3], [4, 5]]);
});

test("collectTrackerPages handles an empty first page", async () => {
  const result = await collectTrackerPages<number, string>(() => Promise.resolve({ data: [], error: null }), 25);
  assert.deepEqual(result, { data: [], error: null });
});

test("collectTrackerPages returns an error without exposing partial data", async () => {
  let page = 0;
  const result = await collectTrackerPages<number, string>(() => {
    page += 1;
    return Promise.resolve(page === 1 ? { data: [1, 2], error: null } : { data: null, error: "network" });
  }, 2);
  assert.deepEqual(result, { data: null, error: "network" });
});

test("collectTrackerPages stops an unexpectedly unbounded source", async () => {
  let calls = 0;
  await assert.rejects(() => collectTrackerPages<number, string>(() => {
    calls += 1;
    return Promise.resolve({ data: [calls], error: null });
  }, 1), /Слишком много записей/);
  assert.equal(calls, 200);
});

test("collectTrackerPages rejects unsafe page sizes", async () => {
  await assert.rejects(() => collectTrackerPages(() => Promise.resolve({ data: [], error: null }), 0), RangeError);
  await assert.rejects(() => collectTrackerPages(() => Promise.resolve({ data: [], error: null }), 1001), RangeError);
});
