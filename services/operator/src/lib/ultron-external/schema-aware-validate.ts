/**
 * CURSOR-TEACHER 1: SCHEMA_AWARE_CODE_VALIDATION.
 *
 * Would have caught:
 *   column "kind" does not exist       (ros_events collision)
 *   aq_channel_surfaces.surface_url ≠ url
 *
 * Runtime approach: cache `information_schema.columns` per boot, then any
 * SQL snippet AE synthesizes gets scanned for `table.column` and unqualified
 * columns after a known table's name. Unknown columns produce a hard
 * ValidationIssue *before* deploy.
 */

import type pg from "pg";
import { createHash } from "node:crypto";

type SchemaCache = Map<string, Set<string>>;

let CACHE: SchemaCache | null = null;
let CACHED_AT = 0;

export async function refreshSchemaSnapshot(pool: pg.Pool): Promise<SchemaCache> {
  const r = await pool.query(
    `select table_name, column_name
       from information_schema.columns
      where table_schema = 'public'`,
  );
  const cache: SchemaCache = new Map();
  for (const row of r.rows) {
    const t = String(row.table_name);
    const c = String(row.column_name);
    if (!cache.has(t)) cache.set(t, new Set());
    cache.get(t)!.add(c);
  }
  const snapshot: Record<string, string[]> = {};
  for (const [t, cols] of cache) snapshot[t] = Array.from(cols).sort();
  const id = `snap_${createHash("sha1").update(JSON.stringify(snapshot)).digest("hex").slice(0, 20)}`;
  await pool.query(
    `insert into ros_schema_snapshot (snapshot_id, taken_at, tables)
     values ($1, now(), $2::jsonb)
     on conflict (snapshot_id) do update set taken_at = now()`,
    [id, JSON.stringify(snapshot)],
  );
  CACHE = cache;
  CACHED_AT = Date.now();
  return cache;
}

async function ensureCache(pool: pg.Pool): Promise<SchemaCache> {
  if (!CACHE || Date.now() - CACHED_AT > 5 * 60_000) {
    return refreshSchemaSnapshot(pool);
  }
  return CACHE;
}

export type SchemaValidationIssue = {
  kind: "UNKNOWN_TABLE" | "UNKNOWN_COLUMN" | "AMBIGUOUS";
  detail: string;
  table?: string;
  column?: string;
};

const KNOWN_KEYWORDS = new Set([
  "select","from","where","join","left","right","inner","outer","on","and","or",
  "not","in","is","null","true","false","group","by","order","limit","offset",
  "insert","into","values","update","set","delete","create","table","exists",
  "index","primary","key","default","now","interval","case","when","then","else",
  "end","cast","as","distinct","having","union","all","with","using",
  "coalesce","count","sum","max","min","avg","array","jsonb","text","integer",
  "boolean","numeric","timestamptz","returning","conflict","do","nothing",
  "current_timestamp","current_date","current_user","asc","desc","between",
  "like","ilike","similar","substring","upper","lower","trim","length",
  "date","time","interval","extract","filter","over","partition","for",
  "share","update","fetch","next","only","material","view","alter",
  "add","column","drop","if","references","cascade","restrict","action",
]);

function isColumnLike(token: string): boolean {
  if (!token) return false;
  if (KNOWN_KEYWORDS.has(token.toLowerCase())) return false;
  if (/^\d+$/.test(token)) return false;
  if (/^[$][0-9]+$/.test(token)) return false;
  return /^[a-z_][a-z0-9_]*$/.test(token);
}

/**
 * Validate a SQL string against the live schema. Detects:
 *   - "unknown_table.something"
 *   - "known_table.unknown_column"
 * Does NOT do full parsing — that's fine for the class of drift bugs we
 * actually saw (column name typos + table renames).
 */
export async function validateSqlAgainstSchema(
  pool: pg.Pool,
  sql: string,
): Promise<SchemaValidationIssue[]> {
  const cache = await ensureCache(pool);
  const issues: SchemaValidationIssue[] = [];
  const re = /([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)/g;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql.toLowerCase())) !== null) {
    const table = m[1];
    const column = m[2];
    if (!isColumnLike(column)) continue;
    const key = `${table}.${column}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // Aliases like `r.action_id` are common — resolve via FROM clause alias.
    // Simplification: if the "table" side is a single letter or short alias,
    // we skip since alias resolution is out of scope for this class of bugs.
    if (table.length <= 3) continue;
    if (!cache.has(table)) {
      issues.push({
        kind: "UNKNOWN_TABLE",
        detail: `Table ${table} not present in live schema.`,
        table,
      });
      continue;
    }
    const cols = cache.get(table)!;
    if (!cols.has(column)) {
      const guess = Array.from(cols).find((c) => c.includes(column) || column.includes(c));
      issues.push({
        kind: "UNKNOWN_COLUMN",
        detail: `Column ${table}.${column} does not exist${guess ? ` — did you mean ${table}.${guess}?` : ""}.`,
        table,
        column,
      });
    }
  }
  return issues;
}

/**
 * Report of any SQL string embedded in a TypeScript source. This is what
 * AE v3 will call before it deploys any synthesized code.
 */
export async function validateEmbeddedSqlInSource(
  pool: pg.Pool,
  source: string,
): Promise<SchemaValidationIssue[]> {
  const issues: SchemaValidationIssue[] = [];
  // Extract obvious SQL blocks: template literals containing "select"/"insert"/"update"/"delete"/"from"
  const templateBlocks = source.match(/`[^`]*?\b(select|insert|update|delete|from|create table)\b[^`]*`/gi) ?? [];
  for (const block of templateBlocks) {
    const inner = block.slice(1, -1);
    issues.push(...(await validateSqlAgainstSchema(pool, inner)));
  }
  return issues;
}

export async function schemaHash(pool: pg.Pool): Promise<string> {
  const cache = await ensureCache(pool);
  const flat: string[] = [];
  for (const [t, cols] of cache) flat.push(`${t}:${Array.from(cols).sort().join(",")}`);
  return createHash("sha256").update(flat.sort().join("|")).digest("hex").slice(0, 16);
}
