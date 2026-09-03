/**
 * Advance business architect lifecycle N ticks (proof helper).
 * SITE_ID optional — advances existing queue.
 */
import pg from "pg";
import { runBusinessArchitectTick } from "../lib/business-architect-loop.js";

async function main() {
  const url = process.env.DATABASE_URL || process.env.REVENUEOS_DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  const appRoot = process.env.REVENUEOS_APP_ROOT || process.cwd();
  const n = Number(process.env.TICKS || "5");
  const pool = new pg.Pool({ connectionString: url });
  const logger = (
    level: "info" | "warn" | "error",
    event: string,
    meta?: Record<string, unknown>,
  ) => console.log(JSON.stringify({ level, event, ...meta }));
  try {
    for (let i = 0; i < n; i++) {
      const r = await runBusinessArchitectTick({ pool, appRoot, logger });
      console.log(JSON.stringify({ tick: i + 1, ...r }));
    }
  } finally {
    await pool.end();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
