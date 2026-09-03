import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { migrationsDir, resolvePaths } from "./paths.js";

const LOCK_KEY = 82420155; // advisory lock id for RevenueOS migrations

export type MigrateResult = {
  applied: string[];
  skipped: string[];
  databaseUrlHost: string;
};

/**
 * Apply SQL migrations under services/revenueos-infra/migrations.
 * Uses pg_advisory_lock so concurrent migrate calls are serialized.
 */
export async function dbMigrate(): Promise<MigrateResult> {
  const paths = resolvePaths();
  const dir = migrationsDir();
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const client = new pg.Client({
    connectionString: paths.connectionUrl,
    connectionTimeoutMillis: 8_000,
  });
  await client.connect();

  const applied: string[] = [];
  const skipped: string[] = [];

  try {
    await client.query("select pg_advisory_lock($1)", [LOCK_KEY]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ros_schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const existing = await client.query<{ id: string }>(
      "select id from ros_schema_migrations",
    );
    const done = new Set(existing.rows.map((r) => r.id));

    for (const file of files) {
      if (done.has(file)) {
        skipped.push(file);
        continue;
      }
      const sql = readFileSync(path.join(dir, file), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query(
          "insert into ros_schema_migrations (id) values ($1) on conflict do nothing",
          [file],
        );
        await client.query("commit");
        applied.push(file);
        console.log(`[revenueos-infra] migrated ${file}`);
      } catch (err) {
        await client.query("rollback");
        throw err;
      }
    }
  } finally {
    try {
      await client.query("select pg_advisory_unlock($1)", [LOCK_KEY]);
    } catch {
      /* ignore */
    }
    await client.end();
  }

  let databaseUrlHost = "local";
  try {
    databaseUrlHost = new URL(paths.connectionUrl).host;
  } catch {
    /* ignore */
  }

  return { applied, skipped, databaseUrlHost };
}
