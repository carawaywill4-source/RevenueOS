/**
 * Targeted test for 0002_ros_channels.sql
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import pg from "pg";
import { dbStart } from "../lifecycle.js";
import { dbMigrate } from "../migrate.js";
import { resolvePaths } from "../paths.js";
import { resolvePgBinaries } from "../pg-binaries.js";

const paths = resolvePaths();
const bins = resolvePgBinaries(paths);
const canRun = existsSync(bins.pgCtl);

describe("migration 0002_ros_channels", { skip: !canRun }, () => {
  before(async () => {
    await dbStart();
    await dbMigrate();
  });

  it("creates ros_channels and provenance columns", async () => {
    const client = new pg.Client({
      connectionString: paths.connectionUrl,
      connectionTimeoutMillis: 8_000,
    });
    await client.connect();
    try {
      const table = await client.query(
        `select 1 from information_schema.tables
         where table_schema='public' and table_name='ros_channels'`,
      );
      assert.equal(table.rowCount, 1);

      const cols = await client.query<{ column_name: string }>(
        `select column_name from information_schema.columns
         where table_schema='public' and table_name='ros_channels'
         order by column_name`,
      );
      const names = new Set(cols.rows.map((r) => r.column_name));
      for (const required of [
        "id",
        "site_id",
        "platform",
        "document",
        "provenance",
        "updated_at",
      ]) {
        assert.ok(names.has(required), `missing column ${required}`);
      }

      const prov = await client.query<{ table_name: string }>(
        `select table_name from information_schema.columns
         where table_schema='public'
           and column_name='provenance'
           and table_name in (
             'ros_experiments','ros_pursuits','ros_events','ros_lessons',
             'ros_scorecards','ros_leases','ros_activity','ros_portfolio_state',
             'ros_businesses','ros_channels'
           )`,
      );
      assert.ok(prov.rowCount && prov.rowCount >= 10);

      const mig = await client.query(
        `select 1 from ros_schema_migrations where id='0002_ros_channels.sql'`,
      );
      assert.equal(mig.rowCount, 1);
    } finally {
      await client.end();
    }
  });
});
