#!/usr/bin/env tsx
/**
 * RevenueOS infra CLI — native PostgreSQL lifecycle (no Docker runtime).
 *
 *   revenueos db prepare|start|stop|restart|health|migrate|backup|restore
 */

import { dbBackup, dbRestore } from "./backup.js";
import { dbHealth, dbRestart, dbStart, dbStop } from "./lifecycle.js";
import { dbMigrate } from "./migrate.js";
import { preparePostgres } from "./prepare.js";
import { resolvePaths } from "./paths.js";
import { resolvePgBinaries } from "./pg-binaries.js";

function usage(): never {
  console.log(`RevenueOS infra

Usage:
  revenueos db prepare              Install/prepare native PostgreSQL@15 (Homebrew, user-local ok)
  revenueos db start                Start dedicated RevenueOS cluster
  revenueos db stop                 Stop cluster
  revenueos db restart              Restart cluster
  revenueos db health               Cluster + connection health
  revenueos db migrate              Apply SQL migrations (advisory-locked)
  revenueos db backup [label]       pg_dump custom format → ~/.revenueos/backups
  revenueos db restore <file>       pg_restore into RevenueOS database
  revenueos db info                 Show paths / binaries

Environment:
  REVENUEOS_HOME          default ~/.revenueos
  REVENUEOS_PG_VERSION    default 15
  REVENUEOS_PG_PORT       default 55432
  REVENUEOS_DATABASE_URL  connection string override
`);
  process.exit(1);
}

async function main(): Promise<void> {
  const [, , domain, cmd, arg] = process.argv;
  if (domain !== "db" || !cmd) usage();

  switch (cmd) {
    case "prepare":
      await preparePostgres();
      break;
    case "start":
      await dbStart();
      break;
    case "stop":
      await dbStop();
      break;
    case "restart":
      await dbRestart();
      break;
    case "health": {
      const h = await dbHealth();
      console.log(JSON.stringify(h, null, 2));
      if (!h.running || !h.acceptingConnections) process.exit(2);
      break;
    }
    case "migrate": {
      const r = await dbMigrate();
      console.log(JSON.stringify(r, null, 2));
      break;
    }
    case "backup": {
      const out = await dbBackup(arg);
      console.log(out);
      break;
    }
    case "restore": {
      if (!arg) usage();
      await dbRestore(arg);
      break;
    }
    case "info": {
      const paths = resolvePaths();
      const bins = resolvePgBinaries(paths);
      console.log(
        JSON.stringify(
          {
            paths,
            binaries: {
              brew: bins.brew,
              pgCtl: bins.pgCtl,
              versionLabel: bins.versionLabel,
            },
          },
          null,
          2,
        ),
      );
      break;
    }
    default:
      usage();
  }
}

main().catch((err) => {
  console.error(
    "[revenueos-infra]",
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
});
