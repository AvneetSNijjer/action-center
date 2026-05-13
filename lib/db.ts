/**
 * Database connection layer — Phase 1 foundation.
 *
 * Connects to the Ampliphi read-replica Postgres. All queries are read-only;
 * write operations are deliberately not supported here.
 *
 * Usage:
 *   import { sql, cached } from "@/lib/db";
 *
 *   // One-shot query
 *   const rows = await sql<MyRow>`SELECT col FROM table WHERE id = ${id}`;
 *
 *   // Cached query (deduplicated for AMPLIPHI_QUERY_CACHE_TTL_MS)
 *   const rows = await cached("morning_briefing", { hotelId }, () =>
 *     sql<...>`...`
 *   );
 */

import { Pool, type PoolClient, type QueryResultRow } from "pg";

/* ============================================================
 * Pool — lazily initialized so build-time / SSG doesn't open
 * connections to the DB when the env var isn't set.
 * ============================================================ */

let _pool: Pool | null = null;

function getPool(): Pool {
  if (_pool) return _pool;

  const connectionString = process.env.AMPLIPHI_DB_URL;
  if (!connectionString) {
    throw new Error(
      "AMPLIPHI_DB_URL is not set. Copy .env.local.example to .env.local and fill it in."
    );
  }

  const max = parseInt(process.env.AMPLIPHI_DB_POOL_MAX ?? "5", 10);
  const idleTimeoutMillis = parseInt(process.env.AMPLIPHI_DB_IDLE_MS ?? "30000", 10);
  const queryTimeoutMs = parseInt(process.env.AMPLIPHI_DB_QUERY_TIMEOUT_MS ?? "15000", 10);

  _pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: true },
    max,
    idleTimeoutMillis,
    connectionTimeoutMillis: 10_000,
    statement_timeout: queryTimeoutMs,
    query_timeout: queryTimeoutMs,
  });

  _pool.on("error", (err) => {
    // Idle-client errors shouldn't crash the process
    // eslint-disable-next-line no-console
    console.error("[db] idle client error:", err.message);
  });

  return _pool;
}

/* ============================================================
 * Tagged-template SQL helper
 *
 * Lets us write parameterised SQL without manual placeholder
 * numbering. Returns the rows array directly.
 *
 *   const rows = await sql<{ id: string }>`
 *     SELECT id FROM hotels WHERE hotel_id = ${hotelId}
 *   `;
 * ============================================================ */

export async function sql<T extends QueryResultRow = QueryResultRow>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  // Build $1, $2, ... placeholders
  let text = "";
  for (let i = 0; i < strings.length; i++) {
    text += strings[i];
    if (i < values.length) text += `$${i + 1}`;
  }

  const pool = getPool();
  const result = await pool.query<T>(text, values as unknown[]);
  return result.rows;
}

/** Get a dedicated client for multi-statement transactions (read-only). */
export async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

/* ============================================================
 * In-memory query cache
 *
 * Simple Map-based TTL cache, shared across all callers in the
 * Node process. Helpful because the read replica is occasionally
 * slow on cold reads and many pages re-query identical shapes
 * (e.g. "current hotel KPIs" gets hit by morning briefing, stats
 * cards, and side panel simultaneously).
 *
 * Each entry stores a Promise so concurrent callers de-duplicate
 * to a single underlying query.
 * ============================================================ */

interface CacheEntry<T> {
  expiresAt: number;
  promise: Promise<T>;
}

const _cache = new Map<string, CacheEntry<unknown>>();

function defaultTtlMs(): number {
  return parseInt(process.env.AMPLIPHI_QUERY_CACHE_TTL_MS ?? "300000", 10);
}

export async function cached<T>(
  key: string,
  params: Record<string, unknown> | undefined,
  loader: () => Promise<T>,
  ttlMs?: number
): Promise<T> {
  const fullKey = params ? `${key}:${stableStringify(params)}` : key;
  const now = Date.now();
  const existing = _cache.get(fullKey);
  if (existing && existing.expiresAt > now) {
    return existing.promise as Promise<T>;
  }

  const ttl = ttlMs ?? defaultTtlMs();
  const promise = loader().catch((err) => {
    // Don't cache failures — let the next caller retry
    _cache.delete(fullKey);
    throw err;
  });
  _cache.set(fullKey, { expiresAt: now + ttl, promise });
  return promise;
}

/** Invalidate cache entries that start with the given prefix. Useful in tests. */
export function invalidateCache(prefix?: string) {
  if (!prefix) {
    _cache.clear();
    return;
  }
  for (const key of _cache.keys()) {
    if (key.startsWith(prefix)) _cache.delete(key);
  }
}

function stableStringify(obj: Record<string, unknown>): string {
  return JSON.stringify(
    Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = obj[k];
        return acc;
      }, {})
  );
}

/* ============================================================
 * Health probe — used by /api/health/db
 * ============================================================ */

export async function probeDb() {
  const start = Date.now();
  const [{ db, usr, ver }] = await sql<{
    db: string;
    usr: string;
    ver: string;
  }>`SELECT current_database() AS db, current_user AS usr, version() AS ver`;

  const [counts] = await sql<{
    tables: string;
    hotels: string;
  }>`
    SELECT
      (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') AS tables,
      (SELECT COUNT(*) FROM hotels WHERE deleted_at IS NULL) AS hotels
  `;

  return {
    ok: true,
    elapsedMs: Date.now() - start,
    database: db,
    user: usr,
    version: ver.split(" on ")[0],
    publicTables: parseInt(counts.tables, 10),
    activeHotels: parseInt(counts.hotels, 10),
  };
}
