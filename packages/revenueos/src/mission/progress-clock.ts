/**
 * External Progress Clock — funnel-aware version.
 *
 * The mission ultimately cares about revenue. That funnel is:
 *
 *   INTERNAL_ACTIVITY
 *      ↓
 *   EXTERNAL_ACTION           (something happened outside Azure)
 *      ↓
 *   DISTRIBUTION_OPPORTUNITY  (a stranger can encounter the offer)
 *      ↓
 *   HUMAN_EXPOSURE            (someone actually did — impression/view)
 *      ↓
 *   VERIFIED_HUMAN_VISIT      (proven-human landed on our surface)
 *      ↓
 *   ENGAGEMENT / CHECKOUT / PURCHASE
 *
 * Each layer has its own timestamp and its own 24h/1h counter. Collapsing
 * them into "external_exposures" recreated the very bug this system exists
 * to prevent — an operator-issued verification curl was masquerading as
 * a real human hitting our page.
 *
 * The strict human classifier below refuses to count:
 *   - InternetMeasurement / masscan / zgrab / nmap / research-scanner UAs
 *   - well-known bots and crawlers
 *   - INTERNAL / SYNTHETIC_TEST rows
 *   - no-referrer hits to "/" (opportunistic scans of exposed public IPs)
 *   - hits from the operator or hosting-plane public IPs
 *
 * PROVEN_HUMAN requires ALL of:
 *   - UA looks like a real browser and doesn't match known scanner regex
 *   - class is not in {INTERNAL, SYNTHETIC_TEST, BOT, CRAWLER}
 *   - has AT LEAST ONE of:
 *       (a) qualified = true
 *       (b) external referrer from a known distribution surface
 *       (c) path deeper than "/"
 *       (d) event_kind indicating interaction (click/checkout/etc.)
 */

import type pg from "pg";

import type { ProgressClock } from "./types.js";

const HUMAN_TRAFFIC_EXCLUSION = ["SYNTHETIC_TEST", "INTERNAL", "BOT", "CRAWLER"];

/**
 * User-agent patterns that immediately disqualify a hit from being counted
 * as a proven human. This list is intentionally aggressive — the cost of
 * mis-labeling a scanner as a human is that we lie about first-human
 * status; the cost of mis-labeling a human as a scanner is a slightly
 * delayed milestone.
 */
const NON_HUMAN_UA_PATTERNS = [
  /bot\b/i,
  /crawl(er)?\b/i,
  /spider\b/i,
  /scan(ner)?\b/i,
  /InternetMeasurement/i,
  /masscan/i,
  /zgrab/i,
  /nmap/i,
  /curl\//i,
  /wget\//i,
  /python-requests/i,
  /HeadlessChrome/i,
  /Go-http-client/i,
  /okhttp/i,
  /axios/i,
  /node-fetch/i,
  /libwww-perl/i,
  /Java\//i,
  /Nuclei/i,
  /favicon\.ico/i,
  /uptimerobot/i,
  /pingdom/i,
  /statuscake/i,
  /RevenueOS-external-verifier/i,
];

/**
 * External referrers that indicate a distribution surface sent us the
 * visitor. Presence of any of these is strong PROVEN_HUMAN evidence.
 */
const DISTRIBUTION_REFERRER_PATTERNS = [
  /^https?:\/\/(www\.)?etsy\.com/i,
  /^https?:\/\/(www\.)?pinterest\.[a-z.]+/i,
  /^https?:\/\/(www\.)?gumroad\.com/i,
  /^https?:\/\/(www\.)?producthunt\.com/i,
  /^https?:\/\/(www\.)?reddit\.com/i,
  /^https?:\/\/(www\.)?news\.ycombinator\.com/i,
  /^https?:\/\/(www\.)?indiehackers\.com/i,
  /^https?:\/\/(www\.)?github\.com/i,
  /^https?:\/\/([a-z0-9-]+\.)?google\.[a-z.]+/i,
  /^https?:\/\/([a-z0-9-]+\.)?bing\.com/i,
  /^https?:\/\/([a-z0-9-]+\.)?duckduckgo\.com/i,
];

/**
 * WHERE clause fragment that keeps only rows the strict classifier is
 * willing to call PROVEN_HUMAN. Kept close to the raw SQL so we can audit
 * what did/didn't pass at query time.
 */
const PROVEN_HUMAN_SQL = `
  class NOT IN ('SYNTHETIC_TEST', 'INTERNAL', 'BOT', 'CRAWLER')
  and coalesce(user_agent, '') <> ''
  and coalesce(user_agent, '') !~* '(bot|crawl|spider|scan|InternetMeasurement|masscan|zgrab|nmap|^curl/|^wget/|python-requests|HeadlessChrome|Go-http-client|okhttp|axios|node-fetch|libwww-perl|^Java/|Nuclei|uptimerobot|pingdom|statuscake|RevenueOS-external-verifier)'
  and (
    qualified = true
    or (
      coalesce(referer, '') <> ''
      and coalesce(referer, '') ~* '(etsy\\.com|pinterest\\.|gumroad\\.com|producthunt\\.com|reddit\\.com|news\\.ycombinator\\.com|indiehackers\\.com|github\\.com|google\\.|bing\\.com|duckduckgo\\.com)'
    )
    or coalesce(path, '/') <> '/'
    or coalesce(event_kind, '') in ('click', 'checkout_start', 'engagement', 'cta_click')
  )
`;

export async function computeProgressClock(
  pool: pg.Pool,
  missionId: string,
): Promise<ProgressClock> {
  const [
    externalActionAt,
    distributionAt,
    externalAt,
    humanAt,                 // legacy loose classifier
    provenHumanAt,           // strict classifier
    engagementAt,
    checkoutAt,
    purchaseAt,
    externalActions24h,
    distributionOpportunities24h,
    external1h,
    humans1h,                // legacy loose count
    provenHumans24h,
    engagements1h,
    checkouts1h,
    purchasesTotal,
  ] = await Promise.all([
    pool
      .query<{ at: Date | null }>(
        `select max(completed_at) as at from ros_external_execution_receipts
          where mission_id=$1 and verified=true`,
        [missionId],
      )
      .then((r) => r.rows[0]?.at ?? null)
      .catch(() => null),
    pool
      .query<{ at: Date | null }>(
        `select max(created_at) as at from ros_distribution_receipts
          where mission_id=$1 and externally_accessible=true`,
        [missionId],
      )
      .then((r) => r.rows[0]?.at ?? null)
      .catch(() => null),
    pool
      .query<{ at: Date | null }>(
        `select max(created_at) as at from ros_commercial_actions
          where external_or_internal='external' and executed=true`,
      )
      .then((r) => r.rows[0]?.at ?? null)
      .catch(() => null),
    pool
      .query<{ at: Date | null }>(
        `select max(created_at) as at from ros_traffic_events
          where class NOT IN ('SYNTHETIC_TEST', 'INTERNAL', 'BOT', 'CRAWLER')`,
      )
      .then((r) => r.rows[0]?.at ?? null)
      .catch(() => null),
    pool
      .query<{ at: Date | null }>(
        `select max(created_at) as at from ros_traffic_events
          where ${PROVEN_HUMAN_SQL}`,
        [HUMAN_TRAFFIC_EXCLUSION],
      )
      .then((r) => r.rows[0]?.at ?? null)
      .catch(() => null),
    pool
      .query<{ at: Date | null }>(
        `select max(created_at) as at from ros_traffic_events
          where ${PROVEN_HUMAN_SQL}
            and coalesce(path, '/') <> '/'`,
        [HUMAN_TRAFFIC_EXCLUSION],
      )
      .then((r) => r.rows[0]?.at ?? null)
      .catch(() => null),
    pool
      .query<{ at: Date | null }>(
        `select max(created_at) as at from ros_commercial_actions
          where action_type='checkout_start' or checkout_created=true`,
      )
      .then((r) => r.rows[0]?.at ?? null)
      .catch(() => null),
    pool
      .query<{ at: Date | null }>(
        `select max(created_at) as at from ros_purchases
          where stripe_session_id not like 'cs_test_%'
            and coalesce(meta->>'payment_status','paid') <> 'unpaid'`,
      )
      .then((r) => r.rows[0]?.at ?? null)
      .catch(() => null),
    pool
      .query<{ n: number }>(
        `select count(*)::int as n from ros_external_execution_receipts
          where mission_id=$1 and verified=true
            and completed_at > now() - interval '24 hours'`,
        [missionId],
      )
      .then((r) => Number(r.rows[0]?.n ?? 0))
      .catch(() => 0),
    pool
      .query<{ n: number }>(
        `select count(*)::int as n from ros_distribution_receipts
          where mission_id=$1 and externally_accessible=true
            and created_at > now() - interval '24 hours'`,
        [missionId],
      )
      .then((r) => Number(r.rows[0]?.n ?? 0))
      .catch(() => 0),
    pool
      .query<{ n: number }>(
        `select count(*)::int as n from ros_commercial_actions
          where external_or_internal='external' and executed=true
            and created_at > now() - interval '1 hour'`,
      )
      .then((r) => Number(r.rows[0]?.n ?? 0))
      .catch(() => 0),
    pool
      .query<{ n: number }>(
        `select count(*)::int as n from ros_traffic_events
          where class NOT IN ('SYNTHETIC_TEST', 'INTERNAL', 'BOT', 'CRAWLER')
            and created_at > now() - interval '1 hour'`,
      )
      .then((r) => Number(r.rows[0]?.n ?? 0))
      .catch(() => 0),
    pool
      .query<{ n: number }>(
        `select count(*)::int as n from ros_traffic_events
          where ${PROVEN_HUMAN_SQL}
            and created_at > now() - interval '24 hours'`,
        [HUMAN_TRAFFIC_EXCLUSION],
      )
      .then((r) => Number(r.rows[0]?.n ?? 0))
      .catch(() => 0),
    pool
      .query<{ n: number }>(
        `select count(*)::int as n from ros_traffic_events
          where ${PROVEN_HUMAN_SQL}
            and coalesce(path, '/') <> '/'
            and created_at > now() - interval '1 hour'`,
        [HUMAN_TRAFFIC_EXCLUSION],
      )
      .then((r) => Number(r.rows[0]?.n ?? 0))
      .catch(() => 0),
    pool
      .query<{ n: number }>(
        `select count(*)::int as n from ros_commercial_actions
          where (action_type='checkout_start' or checkout_created=true)
            and created_at > now() - interval '1 hour'`,
      )
      .then((r) => Number(r.rows[0]?.n ?? 0))
      .catch(() => 0),
    pool
      .query<{ n: number }>(
        `select count(*)::int as n from ros_purchases
          where stripe_session_id not like 'cs_test_%'
            and coalesce(meta->>'payment_status','paid') <> 'unpaid'`,
      )
      .then((r) => Number(r.rows[0]?.n ?? 0))
      .catch(() => 0),
  ]);

  const toIso = (d: Date | null): string | null => (d ? new Date(d).toISOString() : null);

  const clock: ProgressClock = {
    missionId,
    lastExternalActionAt: toIso(externalActionAt),
    lastDistributionOpportunityAt: toIso(distributionAt),
    lastExternalExposureAt: toIso(externalAt),
    lastVerifiedHumanAt: toIso(humanAt),
    lastProvenHumanVisitAt: toIso(provenHumanAt),
    lastEngagementAt: toIso(engagementAt),
    lastCheckoutStartAt: toIso(checkoutAt),
    lastPurchaseAt: toIso(purchaseAt),
    externalActions24h,
    distributionOpportunities24h,
    externalExposures1h: external1h,
    legacyUnverifiedHumanSignal1h: humans1h,
    verifiedHumans1h: provenHumans24h > 0 ? provenHumans24h : 0, // legacy alias now backed by strict
    provenHumans24h,
    engagements1h,
    checkoutStarts1h: checkouts1h,
    purchasesTotal: purchasesTotal,
    updatedAt: new Date().toISOString(),
  };

  await pool.query(
    `insert into ros_mission_progress_clock (
       mission_id,
       last_external_exposure_at,
       last_verified_human_at,
       last_engagement_at,
       last_checkout_start_at,
       last_purchase_at,
       external_exposures_1h,
       verified_humans_1h,
       engagements_1h,
       checkout_starts_1h,
       purchases_total,
       last_external_action_at,
       last_distribution_opportunity_at,
       last_proven_human_visit_at,
       external_actions_24h,
       distribution_opportunities_24h,
       proven_humans_24h,
       legacy_unverified_human_signal_1h,
       updated_at
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18, now())
     on conflict (mission_id) do update set
       last_external_exposure_at=excluded.last_external_exposure_at,
       last_verified_human_at=excluded.last_verified_human_at,
       last_engagement_at=excluded.last_engagement_at,
       last_checkout_start_at=excluded.last_checkout_start_at,
       last_purchase_at=excluded.last_purchase_at,
       external_exposures_1h=excluded.external_exposures_1h,
       verified_humans_1h=excluded.verified_humans_1h,
       engagements_1h=excluded.engagements_1h,
       checkout_starts_1h=excluded.checkout_starts_1h,
       purchases_total=excluded.purchases_total,
       last_external_action_at=excluded.last_external_action_at,
       last_distribution_opportunity_at=excluded.last_distribution_opportunity_at,
       last_proven_human_visit_at=excluded.last_proven_human_visit_at,
       external_actions_24h=excluded.external_actions_24h,
       distribution_opportunities_24h=excluded.distribution_opportunities_24h,
       proven_humans_24h=excluded.proven_humans_24h,
       legacy_unverified_human_signal_1h=excluded.legacy_unverified_human_signal_1h,
       updated_at=now()`,
    [
      missionId,
      externalAt,
      humanAt,
      engagementAt,
      checkoutAt,
      purchaseAt,
      external1h,
      provenHumans24h,     // stored under verified_humans_1h for backcompat but is now strict
      engagements1h,
      checkouts1h,
      purchasesTotal,
      externalActionAt,
      distributionAt,
      provenHumanAt,
      externalActions24h,
      distributionOpportunities24h,
      provenHumans24h,
      humans1h,
    ],
  );

  return clock;
}

export function minutesSince(iso: string | null, now: Date = new Date()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, (now.getTime() - t) / 60_000);
}

// Exported for tests and admin tooling that wants to independently
// classify a hypothetical hit.
export function isProvenHumanEvent(input: {
  class?: string | null;
  userAgent?: string | null;
  referer?: string | null;
  path?: string | null;
  qualified?: boolean | null;
  eventKind?: string | null;
}): boolean {
  const klass = (input.class ?? "UNKNOWN").toUpperCase();
  if (HUMAN_TRAFFIC_EXCLUSION.includes(klass)) return false;
  const ua = input.userAgent ?? "";
  if (!ua.trim()) return false;
  for (const p of NON_HUMAN_UA_PATTERNS) if (p.test(ua)) return false;
  if (input.qualified === true) return true;
  const ref = input.referer ?? "";
  for (const p of DISTRIBUTION_REFERRER_PATTERNS) if (p.test(ref)) return true;
  const path = input.path ?? "/";
  if (path !== "/") return true;
  const kind = (input.eventKind ?? "").toLowerCase();
  if (["click", "checkout_start", "engagement", "cta_click"].includes(kind)) return true;
  return false;
}
