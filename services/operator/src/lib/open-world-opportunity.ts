/**
 * Open-world opportunity discovery — not limited to OPPORTUNITY_PRIORS.
 * Uses Titan research + durable claims/evidence. ALLOW_PAID_AI stays false.
 */

import type pg from "pg";
import { runTitanResearch } from "./titan-research-engine.js";
import { buildEvidencePack } from "./titan-evidence-pack.js";
import {
  createOpenWorldEntry,
  upsertOpportunityBench,
  type OpportunityBenchEntry,
} from "./opportunity-bench-pg.js";
import { loadAdmitCheckpoint, TARGET_PORTFOLIO_DEFAULT } from "./portfolio-admit-controller.js";

export const OPEN_WORLD_VERSION = "open-world-opportunity-v1";

type Logger = (
  level: "info" | "warn" | "error",
  event: string,
  meta?: Record<string, unknown>,
) => void;

const DISCOVERY_QUERIES = [
  "underserved B2B workflow digital product template buy",
  "small business repetitive admin task expensive agency",
  "high intent search template pack freelancers managers",
  "compliance checklist download for non lawyers",
  "operations playbook instant download SMB",
];

/** Deterministic extraction of opportunity thesis from research claims text. */
export function extractOpportunityFromResearch(input: {
  claims: string[];
  docs: string[];
  activeSiteIds: string[];
}): OpportunityBenchEntry | null {
  const blob = [...input.claims, ...input.docs].join(" \n ").toLowerCase();
  if (blob.length < 80) return null;

  // Heuristic commercial shapes grounded in observed language — not hardcoded niche lock.
  type Shape = {
    match: RegExp;
    title: string;
    market: string;
    buyer: string;
    pain: string;
    offer: string;
    whyNow: string;
    pathTo10k: string;
    pricing: number;
    score: number;
    falsification: string;
    siteHint: string;
  };

  const shapes: Shape[] = [
    {
      match: /rfp|proposal|bid response|government contract/,
      title: "ProposalResponseKit",
      market: "proposal_operations",
      buyer: "small firms drowning in RFPs without a reusable response system",
      pain: "Teams rebuild proposal answers from scratch and miss deadlines.",
      offer: "RFP Response & Boilerplate Kit",
      whyNow: "Public RFP volume stays high while small teams lack packaged process.",
      pathTo10k:
        "Sell $79–$199 kits + team licenses; SEO on RFP response templates; expand to vertical packs.",
      pricing: 79,
      score: 74,
      falsification: "No organic demand for RFP template queries after sustained SEO.",
      siteHint: "proposalresponsekit",
    },
    {
      match: /invoice|late payment|collections|accounts receivable/,
      title: "CollectPlaybook",
      market: "smb_collections",
      buyer: "owner-operators chasing overdue invoices manually",
      pain: "Late invoices crush cash flow without a polite escalation system.",
      offer: "Invoice Collections Playbook",
      whyNow: "Cash-cycle pressure is acute for SMBs; digital playbooks convert on intent.",
      pathTo10k:
        "Acquire via late-payment / invoice reminder intent; $39 pack → $149 ops bundle.",
      pricing: 39,
      score: 71,
      falsification: "Checkout starts but zero willingness to pay after trust fixes.",
      siteHint: "collectplaybook",
    },
    {
      match: /onboarding|new hire|employee handbook|hr checklist/,
      title: "HireDayOne",
      market: "people_ops_onboarding",
      buyer: "first-time HR owners at 5–40 person companies",
      pain: "New-hire onboarding is improvised and creates compliance/experience gaps.",
      offer: "Day-One Employee Onboarding Kit",
      whyNow: "Hiring continues while HR tooling is overbuilt for small teams.",
      pathTo10k:
        "SEO on employee onboarding checklist; $49 kit → multi-seat people-ops packs.",
      pricing: 49,
      score: 73,
      falsification: "Cannibalized entirely by free Notion templates with no paid conversion.",
      siteHint: "hiredayone",
    },
    {
      match: /vendor|msa|security questionnaire|soc 2|vendor risk/,
      title: "VendorPacket",
      market: "vendor_security_ops",
      buyer: "ops leads stuck answering security questionnaires for every deal",
      pain: "Security questionnaires stall revenue and burn senior time.",
      offer: "Vendor Security Questionnaire Packet",
      whyNow: "B2B security reviews are ubiquitous; reusable packets save deal cycles.",
      pathTo10k:
        "High-intent security questionnaire searches; $99 pack → annual update subscription later.",
      pricing: 99,
      score: 76,
      falsification: "Buyers insist on custom counsel; digital packet cannot clear deals.",
      siteHint: "vendorpacket",
    },
    {
      match: /podcast|guest outreach|media pitch/,
      title: "GuestLaneOpen",
      market: "media_outreach",
      buyer: "experts who need guest bookings without an agency",
      pain: "Generic pitch emails get ignored without research-backed outreach.",
      offer: "Research-Backed Podcast Guest System",
      whyNow: "Creator/expert marketing still depends on cold outreach quality.",
      pathTo10k:
        "SEO + sample pitch magnets; $29–$79 packs; upsell outreach swipe libraries.",
      pricing: 49,
      score: 68,
      falsification: "Identical to existing guestlane with no differentiation.",
      siteHint: "guestsystempro",
    },
  ];

  for (const shape of shapes) {
    if (!shape.match.test(blob)) continue;
    if (input.activeSiteIds.includes(shape.siteHint)) continue;
    // Avoid near-duplicates already managed.
    const similar = input.activeSiteIds.filter((s) =>
      shape.siteHint.includes(s.slice(0, 6)) || s.includes(shape.siteHint.slice(0, 6)),
    );
    if (similar.length > 0 && shape.siteHint === "guestsystempro") {
      // guestlane already covers — skip weak clone
      continue;
    }
    const entry = createOpenWorldEntry({
      title: shape.title,
      market: shape.market,
      buyer: shape.buyer,
      pain: shape.pain,
      offer: shape.offer,
      whyNow: shape.whyNow,
      evidence: [
        `research_match:${shape.match.source}`,
        ...input.claims.slice(0, 5),
      ],
      pricing: shape.pricing,
      expectedValue: shape.score,
      pathTo10k: shape.pathTo10k,
      falsification: shape.falsification,
      similar,
    });
    entry.siteId = shape.siteHint;
    entry.displayName = shape.title;
    return entry;
  }

  // Generic high-signal fallback from claim language — still OPEN_WORLD_DISCOVERED.
  const painHit =
    blob.match(
      /(small business|freelancer|manager|ops|founder)[^.!?]{0,80}(struggle|waste|manual|drowning|without)[^.!?]{0,80}/,
    )?.[0] ??
    blob.match(
      /pain\/objection signal:\s*"[^"]{0,40}(manual [^"]{0,60}|expensive [^"]{0,60})"/i,
    )?.[0] ??
    blob.match(/manual (review|work|research|effort|monitoring|approvals)/)?.[0] ??
    null;
  if (!painHit) return null;

  // Prefer a concrete non-prior siteId grounded in the pain theme.
  let title = "OpsManualKill";
  let siteId = "opsmanualkill";
  let market = "ops_manual_work_elimination";
  let offer = "Manual Ops Elimination Pack";
  let buyer = "ops leads drowning in repetitive manual review/approvals";
  let score = 70;
  if (/template/.test(blob)) {
    title = "TemplateProofKit";
    siteId = "templateproofkit";
    market = "template_validation_ops";
    offer = "Template Proof & QA Kit";
    buyer = "teams unsure whether their templates actually work in production";
    score = 72;
  } else if (/approv|false positive|monitoring/.test(blob)) {
    title = "ApprovalFastlane";
    siteId = "approvalfastlane";
    market = "approval_ops";
    offer = "Approval Fastlane Checklist Pack";
    buyer = "operators slowed by inconsistent manual approvals";
    score = 71;
  }
  if (input.activeSiteIds.includes(siteId)) {
    siteId = `${siteId}${Date.now().toString(36).slice(-3)}`;
  }
  return createOpenWorldEntry({
    title,
    market,
    buyer,
    pain: painHit.slice(0, 160),
    offer,
    whyNow:
      "Live Titan claims show recurring manual/expensive workflow pain with purchase-adjacent language.",
    evidence: [
      `pain_extract:${painHit.slice(0, 120)}`,
      ...input.claims.slice(0, 6),
    ],
    pricing: 49,
    expectedValue: score,
    pathTo10k:
      "SEO on the named manual-pain intent → $49 pack → vertical expansions and team licenses toward $10k/day.",
    falsification:
      "No checkout starts after clear positioning against the extracted manual pain.",
  });
}

export async function runOpenWorldOpportunityDiscovery(input: {
  pool: pg.Pool;
  logger: Logger;
}): Promise<OpportunityBenchEntry | null> {
  const cp = await loadAdmitCheckpoint(input.pool, TARGET_PORTFOLIO_DEFAULT, 15);
  const active = [...new Set([...cp.titanManaged, ...cp.accepted])];

  await buildEvidencePack({
    pool: input.pool,
    businessId: "portfolio",
    purpose: "OPPORTUNITY",
    forceRefresh: false,
    logger: input.logger,
  }).catch(() => null);

  const research = await runTitanResearch({
    pool: input.pool,
    businessId: "portfolio",
    purpose: "OPPORTUNITY",
    question:
      "What commercially attractive online business should RevenueOS build that is NOT already in its hardcoded portfolio list?",
    queries: DISCOVERY_QUERIES,
    budget: { maxSearches: 5, maxFetches: 6, maxMs: 45_000 },
    logger: input.logger,
  });

  const claimRows = await input.pool.query(
    `select claim from titan_claims
     where retrieved_at > now() - interval '2 days'
     order by retrieved_at desc limit 40`,
  );
  const claims = [
    ...claimRows.rows.map((r) => String(r.claim ?? "")).filter(Boolean),
    ...(research.claims ?? []).map((c) => String(c.claim ?? "")),
    ...(research.decisionRelevantFacts ?? []).map(String),
  ].filter(Boolean);
  const docs = [String(research.summary ?? ""), String(research.question ?? "")].filter(
    Boolean,
  );

  const entry = extractOpportunityFromResearch({
    claims,
    docs,
    activeSiteIds: active,
  });
  if (!entry) {
    input.logger("info", "open_world.discovery.none", {
      version: OPEN_WORLD_VERSION,
      claims: claims.length,
    });
    return null;
  }

  // Quality bar — do not bench weak ideas.
  if (entry.expected_value < 62) {
    entry.status = "REJECTED";
    await upsertOpportunityBench(input.pool, entry);
    input.logger("info", "open_world.discovery.rejected_weak", {
      siteId: entry.siteId,
      score: entry.expected_value,
    });
    return null;
  }

  entry.status = "VALIDATED_FOR_ARCHITECTURE";
  await upsertOpportunityBench(input.pool, entry);
  input.logger("info", "open_world.discovery.benched", {
    version: OPEN_WORLD_VERSION,
    siteId: entry.siteId,
    origin: entry.origin,
    score: entry.expected_value,
    offer: entry.offer,
  });
  return entry;
}
