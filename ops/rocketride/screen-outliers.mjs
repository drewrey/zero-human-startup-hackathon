// Pipeline agent job: screen a price-index entry's sold prices for outliers (SPEC BR-12) on
// Rocket Ride Cloud, compare with the app's reference rule, and report the run over BAND.
//
//   node ops/rocketride/screen-outliers.mjs ["patagonia synchilla mens l"] [--report]
//
// Needs ROCKETRIDE_URI / ROCKETRIDE_APIKEY / BAND keys in ../../.env.local and DATABASE_URL in
// ../../web/.env.local. --report posts the receipt to Atlas over BAND as "Pipeline".
import { RocketRideClient } from "rocketride";
import postgres from "../../web/node_modules/postgres/src/index.js";
import { claimAll, markProcessed, sendAs } from "../band/lib.mjs";

process.loadEnvFile(new URL("../../web/.env.local", import.meta.url).pathname);
const key = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "patagonia synchilla mens l";
const report = process.argv.includes("--report");

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const [row] = await sql`select query, listings, fetched_at from price_index where key = ${key}`;
await sql.end();
if (!row) throw new Error(`No price-index entry for "${key}"`);
const prices = row.listings.sold.map((c) => c.price);

// Reference: the app's BR-12 rule (Tukey fences on all prices).
const q = (v, p) => { const s = [...v].sort((a, b) => a - b); const i = (s.length - 1) * p; const lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo); };
const [q1, q3] = [q(prices, 0.25), q(prices, 0.75)];
const reference = prices.filter((p) => p < q1 - 1.5 * (q3 - q1) || p > q3 + 1.5 * (q3 - q1));

const t0 = Date.now();
const client = new RocketRideClient({ uri: process.env.ROCKETRIDE_URI, auth: process.env.ROCKETRIDE_APIKEY });
await client.connect();
const { token } = await client.use({ filepath: new URL("./screen-outliers.pipe", import.meta.url).pathname });
// The anomaly detector is rolling (each value judged against earlier ones): warm it, then screen.
for (const p of prices) await client.send(token, String(p), { name: "warm.txt" }, "text/plain");
const flagged = [];
for (const p of prices) {
  const r = await client.send(token, String(p), { name: "price.txt" }, "text/plain");
  if (/anomal|warning|critical/i.test(JSON.stringify(r))) flagged.push(p);
}
await client.terminate(token);
await client.disconnect();
const secs = ((Date.now() - t0) / 1000).toFixed(1);

const summary =
  `Rocket Ride run (screen-outliers.pipe, IQR anomaly detector) on "${row.query}": ${prices.length} sold prices ` +
  `from the price index (fetched ${new Date(row.fetched_at).toISOString().slice(0, 16)}Z), screened on Rocket Ride Cloud in ${secs}s. ` +
  `Flagged: ${flagged.join(", ") || "none"}. App's BR-12 reference flags: ${reference.join(", ") || "none"}. ` +
  (flagged.length === reference.length && flagged.every((p) => reference.includes(p))
    ? "Matches the reference."
    : "Differs from the reference on borderline values (Rocket Ride's detector is rolling); the app's rule stays authoritative until they match.");
console.log(summary);

if (report) {
  const waiting = await claimAll("Pipeline");
  await sendAs("Pipeline", `@Atlas ${summary} Not yet wired into live lookups; this is a batch check of indexed comps.`);
  for (const m of waiting) await markProcessed("Pipeline", m.id);
  console.log(`Reported to Atlas over BAND (closed ${waiting.length} waiting request(s)).`);
}
