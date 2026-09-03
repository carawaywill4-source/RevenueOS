/**
 * Deterministic experiment fingerprinting + diversity rotation.
 *
 * Two experiments are the SAME experiment (system defect if re-enqueued)
 * when their (channelFamily, audienceKey, offerKey, positioningKey, product)
 * tuples match. A better subject line or a longer email body is not a new
 * experiment.
 *
 * `pickNextDiverseExperiment` walks a deterministic seed catalog and prefers
 * candidates whose fingerprints have not yet been tried in this mission.
 * When multiple candidates are untried, it picks the one that varies the
 * MOST dimensions from the most recent experiment, so the system cycles
 * through channel → audience → offer → positioning → product instead of
 * micro-tweaking one axis.
 */

import { createHash } from "node:crypto";

import type {
  ChannelFamily,
  ExperimentExecutor,
  ExperimentFingerprintInput,
  ExperimentProposal,
} from "./types.js";

export function computeFingerprint(input: ExperimentFingerprintInput): string {
  const canonical = JSON.stringify({
    channelFamily: input.channelFamily,
    audienceKey: input.audienceKey,
    offerKey: input.offerKey,
    positioningKey: input.positioningKey,
    product: input.product,
  });
  return createHash("sha1").update(canonical).digest("hex").slice(0, 16);
}

export type SeedExperiment = {
  channelFamily: ChannelFamily;
  audienceKey: string;
  offerKey: string;
  positioningKey: string;
  product: string;
  executor: ExperimentExecutor;
  hypothesis: string;
  buyer: string;
  offer: string;
  channel: string;
  expectedResult: string;
  measurement: string;
  budgetUsd: number;
};

/**
 * The deterministic starvation-recovery catalog. Intentionally covers
 * MATERIALLY different families and audiences. This is the fallback when
 * no LLM advisor has proposed anything. LLM proposals extend the catalog
 * at runtime through `MissionController.proposeExperiment`.
 *
 * IMPORTANT: no paid-ads experiments, no "buy a domain" experiments.
 * The owner has locked those levers off.
 */
export const STARVATION_CATALOG: SeedExperiment[] = [
  // BuildGrid (construction RFI/punchlist templates) — but the CEE spam channel is proven dead.
  // The mission needs to pivot AWAY from cold email as the only tactic.
  {
    channelFamily: "github_repo",
    audienceKey: "construction_devs_and_indie_pms",
    offerKey: "free_rfi_log_template_repo",
    positioningKey: "open_source_utility_with_paid_upgrade",
    product: "buildgrid",
    executor: "HARDCORE",
    hypothesis:
      "A public GitHub repo containing a free RFI log template (Markdown + CSV) with a README linking to the paid $29 pack ranks on Google for 'rfi log template github' within 2 weeks and produces at least 1 star and 1 click per week organically.",
    buyer: "General contractors and PMs searching GitHub or Google for a free RFI log template",
    offer:
      "Free MIT-licensed RFI log template (spreadsheet + markdown) — README links to $29 pack for the full punch-list + submittal set",
    channel: "github.com/revenueos-open/rfi-log-template",
    expectedResult: "1+ organic click into Gumroad within 14 days",
    measurement: "GitHub star count, referral traffic from github.com to gumroad.com",
    budgetUsd: 0,
  },
  {
    channelFamily: "seo_answer",
    audienceKey: "construction_pms_google_searchers",
    offerKey: "long_form_rfi_guide_with_paid_pack_cta",
    positioningKey: "authoritative_free_content_that_leads_to_offer",
    product: "buildgrid",
    executor: "HARDCORE",
    hypothesis:
      "A single 2000-word answer article 'How do you keep a construction RFI log without losing your mind?' hosted on a real GitHub Pages / gitbook subdomain (not sslip.io) ranks for the exact phrase within 30 days.",
    buyer: "PMs typing that phrase into Google after losing an RFI",
    offer: "Long-form free guide with $29 pack CTA at the bottom",
    channel: "GitHub Pages site, indexed via sitemap.xml + IndexNow",
    expectedResult: "1+ organic visitor within 30 days from an actual construction PM",
    measurement: "ros_traffic_events with real referrer + non-bot classification",
    budgetUsd: 0,
  },
  {
    channelFamily: "marketplace_listing",
    audienceKey: "gumroad_discover_browsers",
    offerKey: "gumroad_lite_free_lead_magnet",
    positioningKey: "free_lite_drives_paid_upsell",
    product: "buildgrid",
    executor: "CEE_V4",
    hypothesis:
      "A FREE Gumroad listing 'RFI Log Lite' collects buyer emails via Gumroad's own opt-in and Gumroad's discover surface produces incidental views the paid listing does not.",
    buyer: "Anyone browsing Gumroad discover / free products",
    offer: "Free 1-tab RFI Log spreadsheet on Gumroad — upsell to $29 full pack in the download email",
    channel: "gumroad.com free listing",
    expectedResult: "1+ Gumroad view + 1+ email captured within 14 days",
    measurement: "Gumroad dashboard views, ros_commercial_contacts email harvests",
    budgetUsd: 0,
  },
  {
    channelFamily: "community_reply",
    audienceKey: "reddit_r_construction_helpers",
    offerKey: "genuine_advice_plus_link_when_asked",
    positioningKey: "helpful_answer_first_link_only_if_relevant",
    product: "buildgrid",
    executor: "HARDCORE",
    hypothesis:
      "There exist recent r/Construction / r/GeneralContractor posts explicitly asking 'anyone got a good RFI log template?' — a genuine helpful comment answering the question (with a mention of the free GitHub repo where warranted) gets upvotes not bans.",
    buyer: "The specific PM who wrote the ask post",
    offer:
      "Free GitHub repo primarily; paid pack only if the asker follows up with 'is there a fuller version'",
    channel: "reddit.com public search for asks in the last 30 days",
    expectedResult:
      "1+ helpful non-banned reply per week; 1+ click to GitHub repo referred from reddit.com",
    measurement: "Reddit comment karma net-positive; ros_traffic_events referrer=reddit.com",
    budgetUsd: 0,
    // NOTE: This requires the owner to authorize a real Reddit account. The MissionController
    // will mark this experiment BLOCKED_NEEDS_OWNER_AUTH if no account is available.
  },
  {
    channelFamily: "storefront_evolution",
    audienceKey: "existing_site_visitors_if_any",
    offerKey: "clearer_why_buy_and_one_screenshot",
    positioningKey: "conversion_hygiene_before_more_traffic",
    product: "buildgrid",
    executor: "AUTONOMOUS_ENGINEERING",
    hypothesis:
      "The BuildGrid storefront currently fails the WHY-BUY test. A one-paragraph rewrite plus one product screenshot doubles the conversion rate on the traffic the system does eventually produce.",
    buyer: "Any human who lands on the storefront",
    offer: "Same $29 pack, better presentation",
    channel: "static-brand-build.ts / evolved-copy.json",
    expectedResult: "Storefront passes buyer-simulation gate (both models can articulate the offer)",
    measurement: "Buyer-simulation gate pass; storefront redeploy heartbeat",
    budgetUsd: 0,
  },
  {
    channelFamily: "cold_email",
    audienceKey: "trade_associations_editors",
    offerKey: "editorial_offer_free_template_for_readers",
    positioningKey: "content_partnership_not_pitch",
    product: "buildgrid",
    executor: "CEE_V4",
    hypothesis:
      "Trade association newsletter editors will feature a free RFI template as reader-value content when pitched with the template attached, generating one referral spike per feature.",
    buyer: "Editors at AGC / NAHB / Construction Dive newsletters",
    offer: "Free template + optional paid pack, no revenue share requested",
    channel: "Editorial contact addresses on trade-association sites (real people, not info@)",
    expectedResult: "1+ editor reply within 7 days",
    measurement: "Reply-received rate, referral traffic post-feature",
    budgetUsd: 0,
  },
  // Pivot candidate: try a MATERIALLY different product from the 50 portfolio if BuildGrid remains dry.
  {
    channelFamily: "github_repo",
    audienceKey: "indie_saas_devs",
    offerKey: "free_stripe_invoice_chaser_repo",
    positioningKey: "open_source_lead_gen_for_paid_saas",
    product: "invoicechaser",
    executor: "HARDCORE",
    hypothesis:
      "A free 'stripe-invoice-chaser' GitHub repo with a Cloudflare Worker template attracts indie SaaS operators who then upgrade to the hosted paid version.",
    buyer: "Indie SaaS founders with unpaid Stripe invoices",
    offer: "Free open-source dunning worker; paid hosted upgrade",
    channel: "github.com/revenueos-open/stripe-invoice-chaser",
    expectedResult: "1+ star and 1+ hosted signup within 30 days",
    measurement: "GitHub stars, hosted signups",
    budgetUsd: 0,
  },
  {
    channelFamily: "product_hunt",
    audienceKey: "producthunt_daily_readers",
    offerKey: "free_lite_launch_with_paid_pack",
    positioningKey: "product_hunt_launch_with_real_launch_metrics",
    product: "resumeforge",
    executor: "HARDCORE",
    hypothesis:
      "ResumeForge with a launch-day free-tier + paid AI upgrade is the strongest ProductHunt candidate in the portfolio due to consumer/prosumer buyer profile.",
    buyer: "ProductHunt daily digest readers looking for hiring/interview tools",
    offer: "Free tier + paid Pro; launch-day discount",
    channel: "producthunt.com",
    expectedResult: "1+ launch-day upvote and 1+ signup",
    measurement: "PH upvotes, ros_traffic_events referrer=producthunt.com",
    budgetUsd: 0,
  },
];

/**
 * Deterministic "next experiment" chooser.
 *
 * Given the mission's history of tried fingerprints and the most recent
 * experiment, pick the seed that (a) is untried, and (b) varies the most
 * dimensions from the most recent one. Ties broken by catalog order.
 *
 * When every seed has been tried, returns the least-recently-tried seed
 * so the mission never idles forever — but also returns `exhaustedCatalog:true`
 * so the caller can escalate to xAI stuck-state advice.
 */
export function pickNextDiverseExperiment(opts: {
  triedFingerprints: string[];
  mostRecent?: { fingerprint: string; input: ExperimentFingerprintInput } | null;
  preferredExecutors?: readonly string[];
  /**
   * Distribution-first ranking hint. If provided, seeds whose channel family
   * is in this set are ranked ahead of seeds that aren't (before the
   * distance tiebreaker). Used when verified_humans=0 so the mission
   * concentrates on distribution instead of endlessly re-decorating pages
   * nobody sees.
   */
  preferredFamilies?: readonly string[];
  catalog?: SeedExperiment[];
}): {
  seed: SeedExperiment;
  fingerprint: string;
  exhaustedCatalog: boolean;
} {
  const catalog = opts.catalog ?? STARVATION_CATALOG;
  const tried = new Set(opts.triedFingerprints);
  const preferredExec = opts.preferredExecutors
    ? new Set(opts.preferredExecutors)
    : null;
  const preferredFams = opts.preferredFamilies
    ? new Set(opts.preferredFamilies)
    : null;

  const scored = catalog
    .filter((s) => (preferredExec ? preferredExec.has(s.executor) : true))
    .map((seed) => {
      const fp = computeFingerprint(seed);
      const untried = !tried.has(fp);
      const preferredFamily = preferredFams ? preferredFams.has(seed.channelFamily) : false;
      let distance = 0;
      if (opts.mostRecent) {
        const prev = opts.mostRecent.input;
        if (seed.channelFamily !== prev.channelFamily) distance += 5;
        if (seed.audienceKey !== prev.audienceKey) distance += 3;
        if (seed.offerKey !== prev.offerKey) distance += 2;
        if (seed.positioningKey !== prev.positioningKey) distance += 1;
        if (seed.product !== prev.product) distance += 4;
      } else {
        distance = 10;
      }
      return { seed, fp, untried, distance, preferredFamily };
    })
    .sort((a, b) => {
      if (a.untried !== b.untried) return a.untried ? -1 : 1;
      if (preferredFams && a.preferredFamily !== b.preferredFamily) {
        return a.preferredFamily ? -1 : 1;
      }
      if (a.distance !== b.distance) return b.distance - a.distance;
      return 0;
    });

  if (!scored.length) {
    return pickNextDiverseExperiment({
      triedFingerprints: opts.triedFingerprints,
      mostRecent: opts.mostRecent,
      preferredExecutors: undefined,
      preferredFamilies: opts.preferredFamilies,
      catalog,
    });
  }

  const top = scored[0]!;
  return { seed: top.seed, fingerprint: top.fp, exhaustedCatalog: !top.untried };
}

export function seedToProposal(seed: SeedExperiment): ExperimentProposal {
  return {
    hypothesis: seed.hypothesis,
    businessId: seed.product,
    buyer: seed.buyer,
    offer: seed.offer,
    channel: seed.channel,
    channelFamily: seed.channelFamily,
    audienceKey: seed.audienceKey,
    offerKey: seed.offerKey,
    positioningKey: seed.positioningKey,
    executor: seed.executor,
    expectedResult: seed.expectedResult,
    measurement: seed.measurement,
    budgetUsd: seed.budgetUsd,
    source: "deterministic",
    meta: {
      product: seed.product,
    },
  };
}
