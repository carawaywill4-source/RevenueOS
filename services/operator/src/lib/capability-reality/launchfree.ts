/**
 * LaunchFree migration + capability registration.
 * Historical Cursor-led TributeReady acceptance cannot be used until credentials exist.
 */

import type pg from "pg";
import { searchDuckDuckGo } from "../titan-research-engine.js";

type Logger = (
  level: "info" | "warn" | "error",
  event: string,
  meta?: Record<string, unknown>,
) => void;

export async function migrateLaunchFreeCapability(
  pool: pg.Pool,
  logger: Logger,
): Promise<{
  credentialsFound: boolean;
  listingUrl: string | null;
  status: string;
}> {
  const envUser = process.env.LAUNCHFREE_USERNAME || process.env.LAUNCHFREE_EMAIL;
  const envPass = process.env.LAUNCHFREE_PASSWORD;
  const envCookie = process.env.LAUNCHFREE_SESSION_COOKIE;
  const credentialsFound = Boolean((envUser && envPass) || envCookie);

  // Discover public TributeReady listing if indexed
  let listingUrl: string | null = null;
  try {
    const hits = await searchDuckDuckGo("TributeReady site:launchfree.io", 5);
    for (const h of hits) {
      if (/launchfree\.io/i.test(h.url) && /tribute/i.test(`${h.url} ${h.title}`)) {
        listingUrl = h.url;
        break;
      }
    }
    if (!listingUrl) {
      const hits2 = await searchDuckDuckGo("TributeReady LaunchFree", 5);
      for (const h of hits2) {
        if (/launchfree/i.test(h.url)) {
          listingUrl = h.url;
          break;
        }
      }
    }
  } catch {
    /* ignore */
  }

  await pool.query(
    `insert into aq_channel_surfaces (
       channel_surface_id, channel_family, platform, surface_name, surface_url,
       canonical_key, audience, business_fit, commercial_intent, cost,
       account_required, credential_required, api_available, automation_allowed,
       manual_action_required, risk, execution_class, executor_type, status, confidence,
       meta
     ) values (
       'launchfree_directory', 'directories', 'launchfree', 'LaunchFree',
       $1, 'launchfree:directory', 'founders seeking free launch directories',
       0.7, 0.6, 'free', true, true, false, false, true, 'medium',
       $2, 'DIRECTORY_LISTING', $3, 0.55,
       $4::jsonb
     )
     on conflict (channel_surface_id) do update set
       surface_url=excluded.surface_url,
       execution_class=excluded.execution_class,
       status=excluded.status,
       meta=excluded.meta,
       updated_at=now()`,
    [
      listingUrl || "https://www.launchfree.io/",
      credentialsFound ? "CREDENTIAL_REQUIRED" : "OWNER_ACCOUNT_REQUIRED",
      credentialsFound ? "READY" : "BLOCKED",
      JSON.stringify({
        historicalAcceptanceClaimed: true,
        credentialsMigrated: credentialsFound,
        listingUrl,
      }),
    ],
  );

  await pool.query(
    `insert into ros_platform_accounts
       (account_id, platform, identity_email, status, rule_class, credential_ref,
        channel_ids, meta, updated_at)
     values ('launchfree:pending', 'launchfree', $1, $2,
             'UNKNOWN_NEEDS_RESEARCH', $3, $4::text[], $5::jsonb, now())
     on conflict (account_id) do update set
       status=excluded.status,
       meta=excluded.meta,
       updated_at=now()`,
    [
      envUser ?? null,
      credentialsFound ? "CREDENTIAL_PRESENT" : "MISSING",
      credentialsFound ? "launchfree_env" : null,
      ["launchfree_directory"],
      JSON.stringify({
        historicalNote:
          "Cursor-led TributeReady LaunchFree submission reportedly accepted/published; credentials were never stored in Titan vault",
        listingUrl,
        migration: credentialsFound ? "env_present" : "blocked_missing_credentials",
      }),
    ],
  );

  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ('launchfree_migration', $1::jsonb, now(), 'CAPABILITY_REALITY')
     on conflict (key) do update set
       value=excluded.value, updated_at=now(), provenance='CAPABILITY_REALITY'`,
    [
      JSON.stringify({
        version: "launchfree-migration-v1",
        credentialsFound,
        listingUrl,
        status: credentialsFound
          ? "CREDENTIALS_PRESENT_AWAITING_AUTH_PROOF"
          : "OWNER_ACTION_REQUIRED",
        ownerAction: credentialsFound
          ? null
          : {
              action: "Provide LaunchFree login to RevenueOS vault",
              screen: "LaunchFree account settings / login",
              enter:
                "Set LAUNCHFREE_EMAIL + LAUNCHFREE_PASSWORD (or LAUNCHFREE_SESSION_COOKIE) in /etc/revenueos/revenueos.env — do not paste into chat",
              unlocks:
                "Authenticated LaunchFree listing management + referral monitoring for TributeReady and frontier businesses where permitted",
            },
        updatedAt: new Date().toISOString(),
      }),
    ],
  );

  logger(
    credentialsFound ? "info" : "warn",
    "launchfree.migration",
    { credentialsFound, listingUrl },
  );

  return {
    credentialsFound,
    listingUrl,
    status: credentialsFound
      ? "CREDENTIALS_PRESENT_AWAITING_AUTH_PROOF"
      : "OWNER_ACTION_REQUIRED",
  };
}
