import { createPostgresData } from "./adapters/postgres.js";
import {
  createSupabaseData,
  type SupabaseDataConfig,
} from "./adapters/supabase.js";
import type { RevenueOSData } from "./interface.js";

export type DataProvider = "supabase" | "postgres";

export type CreateDataOptions =
  | {
      provider: "postgres";
      connectionString: string;
    }
  | ({
      provider: "supabase";
    } & SupabaseDataConfig)
  | {
      /** Env-driven: REVENUEOS_DATA_PROVIDER=supabase|postgres (default supabase). */
      provider?: "auto";
    };

/**
 * Factory for RevenueOS.Data.
 * Default remains Supabase so production behavior is unchanged until cutover.
 */
export function createData(options: CreateDataOptions = { provider: "auto" }): RevenueOSData {
  const provider =
    options.provider === "auto" || options.provider == null
      ? (process.env.REVENUEOS_DATA_PROVIDER ?? "supabase").toLowerCase()
      : options.provider;

  if (provider === "postgres") {
    const connectionString =
      ("connectionString" in options && options.connectionString) ||
      process.env.REVENUEOS_DATABASE_URL ||
      process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "postgres provider requires connectionString or REVENUEOS_DATABASE_URL",
      );
    }
    return createPostgresData(connectionString);
  }

  if (provider === "supabase") {
    if (options.provider === "supabase") {
      return createSupabaseData(options);
    }
    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) {
      throw new Error(
        "supabase provider requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
      );
    }
    return createSupabaseData({ url, serviceRoleKey });
  }

  throw new Error(`unknown_data_provider:${String(provider)}`);
}
