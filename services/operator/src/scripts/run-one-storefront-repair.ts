/**
 * One-shot storefront repair proof (deterministic, no AI).
 * Usage: SITE_ID=storelift DATABASE_URL=... VERCEL_TOKEN=... tsx ...
 */
import pg from "pg";
import {
  executeOneStorefrontRepair,
  syncManagedCommercialStates,
  REPAIR_EXECUTOR_VERSION,
} from "../lib/storefront-repair-executor.js";

async function main() {
  const siteId = process.env.SITE_ID || "storelift";
  const url = process.env.DATABASE_URL;
  const appRoot = process.env.REVENUEOS_APP_ROOT || process.cwd();
  if (!url) throw new Error("DATABASE_URL required");
  if (!process.env.VERCEL_TOKEN) throw new Error("VERCEL_TOKEN required");

  const pool = new pg.Pool({ connectionString: url });
  const logger = (
    level: "info" | "warn" | "error",
    event: string,
    meta?: Record<string, unknown>,
  ) => {
    console.log(JSON.stringify({ level, event, ...meta }));
  };

  try {
    const cp = await pool.query(
      `select value from ros_config_meta where key='admit_rollout_checkpoint'`,
    );
    const managed = ((cp.rows[0]?.value as { titanManaged?: string[] })
      ?.titanManaged ?? []) as string[];
    await syncManagedCommercialStates({
      pool,
      titanManaged: managed,
      logger,
    });

    const beforeReady = managed.length; // placeholder
    void beforeReady;

    const result = await executeOneStorefrontRepair({
      pool,
      appRoot,
      siteId,
      logger,
    });

    console.log(
      JSON.stringify(
        {
          REPAIR_EXECUTOR_VERSION,
          result,
        },
        null,
        2,
      ),
    );
    if (!result.ok) process.exit(2);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
