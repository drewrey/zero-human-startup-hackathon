// Run: node --test ops/querit/   (mocked; no live calls)
import test from "node:test";
import assert from "node:assert/strict";
import { parseArgs, search, formatResults, QUERIT_URL } from "./search.mjs";

const mock = {
  error_code: 0,
  results: {
    result: [
      { title: "eBay fees 2026", url: "https://example.com/fees", page_time: 1790000000, snippet: "Final value fee\n 13.25%" },
      { title: "No date", url: "https://example.com/b", page_age: "3 days ago", snippet: "x" },
    ],
  },
};
const okFetch = (calls) => async (url, init) => {
  calls.push({ url, init });
  return { ok: true, status: 200, json: async () => mock };
};

test("parseArgs reads query and --n", () => {
  assert.deepEqual(parseArgs(["eBay", "fees", "--n", "3"]), { query: "eBay fees", n: 3 });
  assert.equal(parseArgs(["q"]).n, 5);
  assert.throws(() => parseArgs([]), /missing query/);
  assert.throws(() => parseArgs(["q", "--n", "0"]), /--n/);
});

test("search sends SDK request shape and formats title, URL, date, snippet", async () => {
  const calls = [];
  const items = await search("ebay fees", 2, { apiKey: "k", fetchImpl: okFetch(calls) });
  assert.equal(calls[0].url, QUERIT_URL);
  assert.equal(calls[0].init.headers.Authorization, "Bearer k");
  assert.deepEqual(JSON.parse(calls[0].init.body), { query: "ebay fees", count: 2 });
  const out = formatResults(items);
  assert.match(out, /eBay fees 2026/);
  assert.match(out, /https:\/\/example\.com\/fees/);
  assert.match(out, /Date: 2026-/);
  assert.match(out, /Final value fee 13\.25%/);
  assert.match(out, /Date: 3 days ago/);
});

test("missing key fails clearly without calling the network", async () => {
  const calls = [];
  await assert.rejects(search("q", 1, { fetchImpl: okFetch(calls) }), /QUERIT_API_KEY is not set/);
  assert.equal(calls.length, 0);
});

test("API error codes surface", async () => {
  const f = async () => ({ ok: true, status: 200, json: async () => ({ error_code: 401, error_msg: "bad key" }) });
  await assert.rejects(search("q", 1, { apiKey: "k", fetchImpl: f }), /Querit error 401: bad key/);
});

test("live response shape: error_code 200 with empty error_msg is success", async () => {
  const live = {
    took: "737ms",
    error_code: 200,
    error_msg: "",
    results: { result: [{ url: "https://example.com/str", page_age: "2026-09-16T14:53:45Z", title: "STR guide", snippet: "70%+ STR" }] },
  };
  const f = async () => ({ ok: true, status: 200, json: async () => live });
  const items = await search("sell-through", 1, { apiKey: "k", fetchImpl: f });
  assert.equal(items.length, 1);
  assert.equal(items[0].url, "https://example.com/str");
});

test("error_code 200 with an error message is still an error", async () => {
  const f = async () => ({ ok: true, status: 200, json: async () => ({ error_code: 200, error_msg: "quota" }) });
  await assert.rejects(search("q", 1, { apiKey: "k", fetchImpl: f }), /Querit error 200: quota/);
});
