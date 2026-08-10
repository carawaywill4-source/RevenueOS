/**
 * Operator claim handoff — Vercel cron must no-op when Mac/Fly Core holds
 * a live lease on this siteId. Prevents dual-execution during migration.
 *
 * Storage preference:
 *   1. Native table `revenueos_operator_claims` (SQL migration)
 *   2. Document-mode row in `revenueos_experiments` (id `ros:opclaim:{siteId}`)
 *      when the native table is not yet applied — same durable project,
 *      no second Supabase, no reset.
 *
 * Also honors hard override: REVENUEOS_OPERATOR_HOSTED=1
 */

export type OperatorHostCheck =
  | {
      hosted: true;
      reason: "env_flag" | "active_claim";
      owner?: string;
      leaseUntil?: string;
      storage?: "native" | "document";
    }
  | {
      hosted: false;
      reason: "unclaimed" | "no_supabase" | "lookup_failed";
    };

export const OPERATOR_CLAIM_CATEGORY = "__ros_operator_claim__";

export function operatorClaimDocId(siteId: string): string {
  return `ros:opclaim:${siteId}`;
}

type ClaimRow = { owner?: string; lease_until?: string };

function activeFromRow(row: ClaimRow | null | undefined): ClaimRow | null {
  if (!row?.lease_until) return null;
  if (Date.parse(row.lease_until) <= Date.now()) return null;
  return row;
}

async function fetchNativeClaim(
  url: string,
  key: string,
  siteId: string,
): Promise<{ ok: true; row: ClaimRow | null } | { ok: false; missing: boolean }> {
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
  if (res.status === 404 || res.status === 406) {
    return { ok: false, missing: true };
  }
  if (!res.ok) {
    const body = await res.text();
    if (body.includes("PGRST205") || body.includes("does not exist")) {
      return { ok: false, missing: true };
    }
    return { ok: false, missing: false };
  }
  const rows = (await res.json()) as ClaimRow[];
  return { ok: true, row: rows[0] ?? null };
}

async function fetchDocumentClaim(
  url: string,
  key: string,
  siteId: string,
): Promise<{ ok: true; row: ClaimRow | null } | { ok: false }> {
  const id = operatorClaimDocId(siteId);
  const res = await fetch(
    `${url}/rest/v1/revenueos_experiments?id=eq.${encodeURIComponent(id)}&select=document&limit=1`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8_000),
    },
  );
  // Transport/API failure must fail closed — never treat as "unclaimed".
  if (!res.ok) return { ok: false };
  const rows = (await res.json()) as Array<{ document?: ClaimRow }>;
  return { ok: true, row: rows[0]?.document ?? null };
}

export async function checkOperatorHosting(
  siteId: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<OperatorHostCheck> {
  if (env.REVENUEOS_OPERATOR_HOSTED === "1") {
    return { hosted: true, reason: "env_flag" };
  }
  // Mac is sole execution authority. Without an explicit cloud-brain break-glass,
  // treat the site as hosted so legacy Vercel paths cannot claim work.
  if (env.REVENUEOS_VERCEL_BRAIN !== "1") {
    return {
      hosted: true,
      reason: "env_flag",
      owner: "mac_sole_authority",
    };
  }
  const url = env.SUPABASE_URL?.replace(/\/$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    // FAIL CLOSED — missing claim backend must not wake cloud brain.
    return {
      hosted: true,
      reason: "env_flag",
      owner: "no_supabase_fail_closed",
    };
  }
  try {
    const native = await fetchNativeClaim(url, key, siteId);
    if (native.ok) {
      const active = activeFromRow(native.row);
      if (!active) return { hosted: false, reason: "unclaimed" };
      return {
        hosted: true,
        reason: "active_claim",
        owner: active.owner,
        leaseUntil: active.lease_until,
        storage: "native",
      };
    }
    if (!native.missing) {
      // FAIL CLOSED: Supabase errors must NOT wake the Vercel brain.
      // Dual-execution / duration storms happen when lookup_failed was treated
      // as "unhosted" and cron ran runPursuitTick during outages.
      return {
        hosted: true,
        reason: "env_flag",
        owner: "lookup_failed_fail_closed",
      };
    }

    const docRes = await fetchDocumentClaim(url, key, siteId);
    if (!docRes.ok) {
      return {
        hosted: true,
        reason: "env_flag",
        owner: "lookup_failed_fail_closed",
      };
    }
    const doc = activeFromRow(docRes.row);
    if (!doc) return { hosted: false, reason: "unclaimed" };
    return {
      hosted: true,
      reason: "active_claim",
      owner: doc.owner,
      leaseUntil: doc.lease_until,
      storage: "document",
    };
  } catch {
    // FAIL CLOSED — same as lookup_failed above.
    return {
      hosted: true,
      reason: "env_flag",
      owner: "lookup_failed_fail_closed",
    };
  }
}
