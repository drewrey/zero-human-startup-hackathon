import postgres from "postgres";
import type { PlatformListings } from "../types";

/**
 * Storage for the price index (BR-18..BR-20) and Apify spend tracking.
 * Postgres when DATABASE_URL is set (InstaCloud), otherwise in-memory (local dev; lost on restart).
 */

export interface IndexEntry {
  key: string;
  query: string;
  listings: PlatformListings;
  fetchedAt: string;
  costUsd: number;
}

export interface IndexStore {
  get(key: string): Promise<IndexEntry | null>;
  put(entry: IndexEntry): Promise<void>;
  /** Most-recently-fetched entries first; used by batch refresh. */
  list(limit: number): Promise<IndexEntry[]>;
  spentSince(since: Date): Promise<number>;
  recordSpend(usd: number, note: string): Promise<void>;
}

export class MemoryStore implements IndexStore {
  private entries = new Map<string, IndexEntry>();
  private spend: { at: number; usd: number }[] = [];

  async get(key: string) {
    return this.entries.get(key) ?? null;
  }
  async put(entry: IndexEntry) {
    this.entries.set(entry.key, entry);
  }
  async list(limit: number) {
    return [...this.entries.values()].sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt)).slice(0, limit);
  }
  async spentSince(since: Date) {
    return this.spend.filter((s) => s.at >= since.getTime()).reduce((n, s) => n + s.usd, 0);
  }
  async recordSpend(usd: number) {
    this.spend.push({ at: Date.now(), usd });
  }
}

export class PostgresStore implements IndexStore {
  private sql: postgres.Sql;
  private ready: Promise<void>;

  constructor(url: string) {
    this.sql = postgres(url, { max: 3, idle_timeout: 20, onnotice: () => {} });
    this.ready = this.migrate();
  }

  private async migrate() {
    await this.sql`
      create table if not exists price_index (
        key text primary key,
        query text not null,
        listings jsonb not null,
        fetched_at timestamptz not null,
        cost_usd numeric not null default 0
      )`;
    await this.sql`
      create table if not exists apify_spend (
        id bigserial primary key,
        at timestamptz not null default now(),
        usd numeric not null,
        note text
      )`;
  }

  async get(key: string) {
    await this.ready;
    const [row] = await this.sql`select * from price_index where key = ${key}`;
    return row ? toEntry(row) : null;
  }

  async put(e: IndexEntry) {
    await this.ready;
    await this.sql`
      insert into price_index (key, query, listings, fetched_at, cost_usd)
      values (${e.key}, ${e.query}, ${this.sql.json(e.listings as never)}, ${e.fetchedAt}, ${e.costUsd})
      on conflict (key) do update set
        query = excluded.query, listings = excluded.listings,
        fetched_at = excluded.fetched_at, cost_usd = excluded.cost_usd`;
  }

  async list(limit: number) {
    await this.ready;
    const rows = await this.sql`select * from price_index order by fetched_at desc limit ${limit}`;
    return rows.map(toEntry);
  }

  async spentSince(since: Date) {
    await this.ready;
    const [row] = await this.sql`select coalesce(sum(usd), 0)::float as total from apify_spend where at >= ${since}`;
    return Number(row.total);
  }

  async recordSpend(usd: number, note: string) {
    await this.ready;
    await this.sql`insert into apify_spend (usd, note) values (${usd}, ${note})`;
  }

  /** Test helper: empty both tables. Never call against a real database. */
  async resetForTests() {
    await this.ready;
    await this.sql`truncate price_index, apify_spend`;
  }

  async close() {
    await this.sql.end();
  }
}

function toEntry(row: postgres.Row): IndexEntry {
  return {
    key: row.key,
    query: row.query,
    listings: row.listings,
    fetchedAt: new Date(row.fetched_at).toISOString(),
    costUsd: Number(row.cost_usd),
  };
}

let store: IndexStore | null = null;

export function getStore(): IndexStore {
  store ??= process.env.DATABASE_URL ? new PostgresStore(process.env.DATABASE_URL) : new MemoryStore();
  return store;
}
