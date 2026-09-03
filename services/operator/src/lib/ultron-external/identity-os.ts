/**
 * FIX 4+5 — Business Identity OS.
 *
 * Canonical lookup is ros_identity_profiles by business_id.
 * Reconstruct domains from live app_url OR known hosting-plane pattern.
 * Org-level sender email is not an owner blocker.
 * canAutonomouslyOperate(businessId) never claims the profile is missing
 * when it exists — it reports the exact missing fields.
 */

import type pg from "pg";
import type { Logger } from "../ultron-core/types.js";

const OWNED_HOST_SUFFIX = "130.131.15.68.sslip.io";

function extractEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = String(raw).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0].toLowerCase() : null;
}

function domainFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = url.includes("://") ? new URL(url) : new URL(`https://${url}`);
    return u.host.replace(/\/$/, "") || null;
  } catch {
    const cleaned = String(url).replace(/^https?:\/\//, "").replace(/\/$/, "");
    return cleaned || null;
  }
}

export type IdentityProfile = {
  profileId: string;
  businessId: string;
  displayName: string;
  primaryEmail: string | null;
  inboxEmail: string | null;
  domains: string[];
  usernames: Record<string, string>;
  accountRefs: string[];
  credentialRefs: string[];
  accountHealth: string;
  ownerBlockers: string[];
  missingFields: string[];
};

export async function identityFor(
  pool: pg.Pool,
  businessId: string,
): Promise<IdentityProfile | null> {
  const r = await pool.query(
    `select * from ros_identity_profiles where business_id = $1`,
    [businessId],
  );
  if (!r.rows[0]) return null;
  return rowToProfile(r.rows[0]);
}

function rowToProfile(row: Record<string, unknown>): IdentityProfile {
  const domains = Array.isArray(row.domains) ? row.domains.map(String) : [];
  const ownerBlockers = Array.isArray(row.owner_blockers) ? row.owner_blockers.map(String) : [];
  const missing: string[] = [];
  if (!row.primary_email) missing.push("primary_email");
  if (domains.length === 0) missing.push("domain");
  return {
    profileId: String(row.profile_id),
    businessId: String(row.business_id),
    displayName: String(row.display_name ?? row.business_id),
    primaryEmail: row.primary_email ? String(row.primary_email) : null,
    inboxEmail: row.inbox_email ? String(row.inbox_email) : null,
    domains,
    usernames: (row.usernames as Record<string, string>) ?? {},
    accountRefs: Array.isArray(row.account_refs) ? row.account_refs.map(String) : [],
    credentialRefs: Array.isArray(row.credential_refs) ? row.credential_refs.map(String) : [],
    accountHealth: String(row.account_health ?? "UNKNOWN"),
    ownerBlockers,
    missingFields: missing,
  };
}

export async function refreshIdentityProfiles(
  pool: pg.Pool,
  logger: Logger,
): Promise<{ profiles: number; withDomain: number; withEmail: number; ownerBlockers: number }> {
  const orgEmail =
    extractEmail(process.env.OUTREACH_FROM_EMAIL) ||
    extractEmail(process.env.RESEND_FROM_EMAIL) ||
    extractEmail(process.env.RESEND_FROM) ||
    null;

  const biz = await pool.query(
    `select site_id, display_name, industry, app_url, status, metadata
       from ros_businesses
      where status in ('active','LAUNCHED','ACCEPTED','LIVE','LAUNCHING','SOFT_RETIRED')
      limit 200`,
  );

  const orgAccounts = await pool.query(
    `select account_id, platform, credential_ref, status, identity_email, username, meta
       from ros_platform_accounts`,
  ).catch(() => ({ rows: [] as Array<Record<string, unknown>> }));

  let profiles = 0;
  let withDomain = 0;
  let withEmail = 0;
  let ownerBlockers = 0;

  for (const b of biz.rows) {
    const siteId = String(b.site_id);
    const derivedHost = `${siteId}.${OWNED_HOST_SUFFIX}`;
    const fromApp = domainFromUrl(b.app_url);
    const domains = Array.from(new Set([fromApp, derivedHost].filter(Boolean))) as string[];

    // Per-business accounts if tagged; otherwise org-level refs are informational only.
    const tagged = orgAccounts.rows.filter((a) => {
      const meta = (a.meta ?? {}) as Record<string, unknown>;
      const channels = Array.isArray(a.channel_ids) ? a.channel_ids.map(String) : [];
      return meta.business_id === siteId || channels.includes(siteId);
    });
    const usernames: Record<string, string> = {};
    const accountRefs: string[] = [];
    const credentialRefs: string[] = [];
    for (const a of tagged) {
      accountRefs.push(String(a.account_id));
      if (a.credential_ref) credentialRefs.push(String(a.credential_ref));
      if (a.username) usernames[String(a.platform)] = String(a.username);
    }

    const accountEmail = extractEmail(
      tagged.find((r) => r.identity_email)?.identity_email as string | undefined,
    );
    const primaryEmail = accountEmail || orgEmail;

    // Owner blockers: only genuine owner-only gaps, never "we failed to look at app_url".
    const blockers: string[] = [];
    // Missing domain after reconstruction would be a real data hole.
    if (domains.length === 0) blockers.push("no_derivable_domain");
    // Email: org sender is enough for outbound; inbox receiving is a capability, not owner KYC.
    // Do not escalate "no_primary_email" when RESEND_FROM exists.

    const health =
      tagged.length > 0 ? "PARTIAL" : orgAccounts.rows.length > 0 ? "ORG_CREDENTIALS" : "NONE";

    await pool.query(
      `insert into ros_identity_profiles
         (profile_id, business_id, display_name, primary_email, inbox_email,
          domains, usernames, account_refs, credential_refs,
          verification_state, account_health, owner_blockers, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10::jsonb,$11,$12, now())
       on conflict (profile_id) do update set
         display_name = excluded.display_name,
         primary_email = excluded.primary_email,
         inbox_email = excluded.inbox_email,
         domains = excluded.domains,
         usernames = excluded.usernames,
         account_refs = excluded.account_refs,
         credential_refs = excluded.credential_refs,
         verification_state = excluded.verification_state,
         account_health = excluded.account_health,
         owner_blockers = excluded.owner_blockers,
         updated_at = now()`,
      [
        `idp_${siteId}`,
        siteId,
        b.display_name ?? siteId,
        primaryEmail,
        primaryEmail,
        domains,
        JSON.stringify(usernames),
        accountRefs,
        credentialRefs,
        JSON.stringify({
          reconstructedDomain: !fromApp && domains.length > 0,
          orgEmailUsed: !accountEmail && !!orgEmail,
          appUrlPresent: !!fromApp,
        }),
        health,
        blockers,
      ],
    );
    profiles++;
    if (domains.length > 0) withDomain++;
    if (primaryEmail) withEmail++;
    if (blockers.length > 0) ownerBlockers++;
  }

  logger("info", "ultron.identity.refresh", { profiles, withDomain, withEmail, ownerBlockers });
  return { profiles, withDomain, withEmail, ownerBlockers };
}

export async function canAutonomouslyOperate(
  pool: pg.Pool,
  businessId: string,
  _platform: string,
  platformRules?: {
    allowsAutomatedRegistration?: boolean;
    requiresHumanKyc?: boolean;
    requiresPayment?: boolean;
    requiresMfaOwnerDevice?: boolean;
    explicitlyProhibitsAutomation?: boolean;
  },
): Promise<{ ok: boolean; blocker?: string; missingFields: string[]; profileExists: boolean }> {
  const identity = await identityFor(pool, businessId);
  const rules = platformRules ?? {};
  if (rules.explicitlyProhibitsAutomation) {
    return { ok: false, blocker: "explicitly_prohibits_automation", missingFields: identity?.missingFields ?? [], profileExists: !!identity };
  }
  if (rules.requiresHumanKyc) {
    return { ok: false, blocker: "requires_human_kyc", missingFields: identity?.missingFields ?? [], profileExists: !!identity };
  }
  if (rules.requiresMfaOwnerDevice) {
    return { ok: false, blocker: "requires_mfa_owner_device", missingFields: identity?.missingFields ?? [], profileExists: !!identity };
  }
  if (rules.requiresPayment) {
    return { ok: false, blocker: "requires_payment_authorization", missingFields: identity?.missingFields ?? [], profileExists: !!identity };
  }
  if (rules.allowsAutomatedRegistration === false) {
    return { ok: false, blocker: "no_automated_registration", missingFields: identity?.missingFields ?? [], profileExists: !!identity };
  }
  if (!identity) {
    return { ok: false, blocker: "no_identity_profile", missingFields: ["profile"], profileExists: false };
  }
  if (identity.ownerBlockers.length > 0) {
    return {
      ok: false,
      blocker: identity.ownerBlockers[0],
      missingFields: identity.missingFields,
      profileExists: true,
    };
  }
  return { ok: true, missingFields: identity.missingFields, profileExists: true };
}
