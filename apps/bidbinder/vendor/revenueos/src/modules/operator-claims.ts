/**
 * Operator claim handoff — Vercel cron must no-op when Mac/Fly Core holds
 * a live lease on this siteId. Prevents dual-execution during migration.
 *
 * Also honors hard override: REVENUEOS_OPERATOR_HOSTED=1
 */

export type OperatorHostCheck =
  | { hosted: true; reason: "env_flag" | "active_claim"; owner?: string; leaseUntil?: string }
  | { hosted: false; reason: "unclaimed" | "no_supabase" | "lookup_failed" };

export async function checkOperatorHosting(
  siteId: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<OperatorHostCheck> {
  if (env.REVENUEOS_OPERATOR_HOSTED === "1") {
    return { hosted: true, reason: "env_flag" };
  }
  const url = env.SUPABASE_URL?.replace(/\/$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return { hosted: false, reason: "no_supabase" };
  }
  try {
    const res = await fetch(
      `${url}/rest/v1/revenueos_operator_claims?site_id=eq.${encodeURIComponent(siteId)}&select=owner,lease_until&limit=1`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!res.ok) {
      // Table missing → treat as unclaimed so cron keeps working
      return { hosted: false, reason: "lookup_failed" };
    }
    const rows = (await res.json()) as Array<{
      owner?: string;
      lease_until?: string;
    }>;
    const row = rows[0];
    if (!row?.lease_until) return { hosted: false, reason: "unclaimed" };
    if (Date.parse(row.lease_until) <= Date.now()) {
      return { hosted: false, reason: "unclaimed" };
    }
    return {
      hosted: true,
      reason: "active_claim",
      owner: row.owner,
      leaseUntil: row.lease_until,
    };
  } catch {
    return { hosted: false, reason: "lookup_failed" };
  }
}
