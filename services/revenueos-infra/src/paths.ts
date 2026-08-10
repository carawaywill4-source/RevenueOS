import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Repo-relative migrations directory. */
export function migrationsDir(): string {
  return path.resolve(__dirname, "../migrations");
}

export type RevenueOsPaths = {
  home: string;
  brewPrefix: string;
  pgVersion: string;
  pgData: string;
  pgLog: string;
  pgRuntime: string;
  backups: string;
  configFile: string;
  connectionUrl: string;
  port: number;
  database: string;
  user: string;
};

/**
 * Dedicated RevenueOS data/config layout (not system Postgres defaults).
 * Override root with REVENUEOS_HOME.
 */
export function resolvePaths(env: NodeJS.ProcessEnv = process.env): RevenueOsPaths {
  const home = env.REVENUEOS_HOME ?? path.join(homedir(), ".revenueos");
  const pgVersion = env.REVENUEOS_PG_VERSION ?? "15";
  const port = Number(env.REVENUEOS_PG_PORT ?? "55432");
  const database = env.REVENUEOS_PG_DATABASE ?? "revenueos";
  const user = env.REVENUEOS_PG_USER ?? "revenueos";
  const password = env.REVENUEOS_PG_PASSWORD ?? "revenueos_local_dev";
  const host = env.REVENUEOS_PG_HOST ?? "127.0.0.1";

  return {
    home,
    brewPrefix: env.REVENUEOS_BREW_PREFIX ?? path.join(home, "homebrew"),
    pgVersion,
    pgData: env.REVENUEOS_PGDATA ?? path.join(home, "pg", "data"),
    pgLog: path.join(home, "pg", "postgres.log"),
    pgRuntime: path.join(home, "pg", "runtime"),
    backups: path.join(home, "backups"),
    configFile: path.join(home, "config", "database.json"),
    connectionUrl:
      env.REVENUEOS_DATABASE_URL ??
      `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`,
    port,
    database,
    user,
  };
}
