#!/usr/bin/env node
// Querit web search CLI. Usage: node ops/querit/search.mjs "<query>" [--n 5]
// Reads QUERIT_API_KEY from the environment. Request shape follows the `querit`
// Python SDK 0.1.5: POST https://api.querit.ai/v1/search, Bearer auth, {query, count}.
import { fileURLToPath } from "node:url";

export const QUERIT_URL = "https://api.querit.ai/v1/search";

export function parseArgs(argv) {
  const words = [];
  let n = 5;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--n") {
      n = Number(argv[++i]);
    } else if (argv[i].startsWith("--n=")) {
      n = Number(argv[i].slice(4));
    } else {
      words.push(argv[i]);
    }
  }
  if (!Number.isInteger(n) || n < 1 || n > 50) {
    throw new Error("--n must be an integer from 1 to 50");
  }
  const query = words.join(" ").trim();
  if (!query) throw new Error('missing query. Usage: node ops/querit/search.mjs "<query>" [--n 5]');
  return { query, n };
}

export function formatDate(item) {
  const t = item.page_time;
  if (typeof t === "number" && t > 0) {
    // Seconds or milliseconds since epoch.
    const d = new Date(t < 1e11 ? t * 1000 : t);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return item.page_age || "date unknown";
}

export function parseResults(raw) {
  if (raw?.error_code) {
    throw new Error(`Querit error ${raw.error_code}: ${raw.error_msg ?? "unknown"}`);
  }
  const items = raw?.results?.result;
  return Array.isArray(items) ? items : [];
}

export function formatResults(items) {
  if (!items.length) return "No results.";
  return items
    .map((it, i) =>
      [
        `${i + 1}. ${it.title ?? "(no title)"}`,
        `   URL:  ${it.url ?? "(no url)"}`,
        `   Date: ${formatDate(it)}`,
        `   ${(it.snippet ?? "").replace(/\s+/g, " ").trim()}`,
      ].join("\n"),
    )
    .join("\n\n");
}

export async function search(query, n, { apiKey, fetchImpl = fetch } = {}) {
  if (!apiKey) throw new Error("QUERIT_API_KEY is not set. Export it (see ops/querit/README.md).");
  const res = await fetchImpl(QUERIT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, count: n }),
  });
  if (!res.ok) throw new Error(`Querit HTTP ${res.status}`);
  return parseResults(await res.json());
}

async function main() {
  try {
    const { query, n } = parseArgs(process.argv.slice(2));
    const items = await search(query, n, { apiKey: process.env.QUERIT_API_KEY });
    console.log(formatResults(items));
  } catch (err) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
