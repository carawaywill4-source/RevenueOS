/**
 * FIX 13 — Account evidence ladder. Schema existence is not actuation proof.
 */

import type pg from "pg";
import type { Logger } from "../ultron-core/types.js";

export const ACCOUNT_LADDER = [
  "ACCOUNT_SCHEMA_EXISTS",
  "ACCOUNT_KNOWN",
  "ACCOUNT_CREDENTIALS_AVAILABLE",
  "ACCOUNT_SESSION_PROVEN",
  "ACCOUNT_CREATED_AUTONOMOUSLY",
  "ACCOUNT_EMAIL_VERIFIED",
  "ACCOUNT_OPERATION_PROVEN",
] as const;
export type AccountLadder = (typeof ACCOUNT_LADDER)[number];

export async function refreshAccountEvidence(
  pool: pg.Pool,
  logger: Logger,
): Promise<{ accounts: number }> {
  const rows = await pool.query(
    `select account_id, platform, status, credential_ref, session_ref, identity_email, meta
       from ros_platform_accounts`,
  ).catch(() => ({ rows: [] as Array<Record<string, unknown>> }));

  let accounts = 0;
  for (const a of rows.rows) {
    const status = String(a.status ?? "");
    const meta = (a.meta ?? {}) as Record<string, unknown>;
    let ladder: AccountLadder = "ACCOUNT_KNOWN";
    if (a.credential_ref || status === "CREDENTIAL_PRESENT") ladder = "ACCOUNT_CREDENTIALS_AVAILABLE";
    if (a.session_ref) ladder = "ACCOUNT_SESSION_PROVEN";
    if (meta.createdAutonomously === true) ladder = "ACCOUNT_CREATED_AUTONOMOUSLY";
    if (meta.emailVerified === true) ladder = "ACCOUNT_EMAIL_VERIFIED";
    if (meta.operationProven === true || status === "OPERATION_PROVEN") ladder = "ACCOUNT_OPERATION_PROVEN";
    // Env-synced credentials are KNOWN+CREDENTIALS, never CREATED_AUTONOMOUSLY.
    if (meta.source === "env_sync" && ladder === "ACCOUNT_CREATED_AUTONOMOUSLY") {
      ladder = "ACCOUNT_CREDENTIALS_AVAILABLE";
    }
    await pool.query(
      `insert into ros_account_evidence (account_id, platform, ladder, evidence, updated_at)
       values ($1,$2,$3,$4::jsonb, now())
       on conflict (account_id) do update set
         ladder = excluded.ladder, evidence = excluded.evidence, updated_at = now()`,
      [
        a.account_id,
        a.platform,
        ladder,
        JSON.stringify({ status, source: meta.source ?? null, env: !!meta.env }),
      ],
    );
    accounts++;
  }

  // Schema exists even with zero rows.
  if (accounts === 0) {
    await pool.query(
      `insert into ros_account_evidence (account_id, platform, ladder, evidence, updated_at)
       values ('schema:ros_platform_accounts','*','ACCOUNT_SCHEMA_EXISTS','{"note":"table exists, no accounts"}'::jsonb, now())
       on conflict (account_id) do update set updated_at = now()`,
    );
  }
  logger("info", "ultron.accounts.ladder", { accounts });
  return { accounts };
}
