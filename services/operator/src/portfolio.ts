import type { OperatorBusinessManifest } from "@revenueos/core";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Portfolio manifest for the persistent operator.
 *
 * After the owner-authorized 50-business reset, ACTIVE businesses live in
 * portfolio-dynamic.json. Prior businesses are soft-retired into
 * portfolio-retired.json (learning preserved — never deleted).
 *
 * Legacy STATIC_PORTFOLIO remains as historical seed metadata only when
 * active-mode is not dynamic_only_50.
 */

const STATIC_PORTFOLIO: OperatorBusinessManifest[] = [
  {
    siteId: "raiseready",
    displayName: "RaiseReady",
    industry: "career_negotiation",
    brandVoice: "direct, evidence-backed, calm",
    appUrl: "https://raiseready-seven.vercel.app",
    product: {
      id: "raise-brief",
      name: "RaiseReady Brief",
      priceUsd: 49,
      marginEstimate: 0.92,
      audience: "IC engineers preparing salary conversations",
    },
    businessModel: "digital_product",
    priceBand: "mid",
    considerationLevel: "medium",
    sequenceIndex: 1,
  },
  {
    siteId: "ledgerleaf",
    displayName: "LedgerLeaf",
    industry: "small_business_bookkeeping",
    brandVoice: "practical, small-business friendly",
    appUrl: "https://ledgerleaf-ashen.vercel.app",
    product: {
      id: "ledger-templates",
      name: "LedgerLeaf Templates",
      priceUsd: 39,
      marginEstimate: 0.94,
      audience: "solo operators keeping cash-basis books",
    },
    businessModel: "digital_product",
    priceBand: "low",
    considerationLevel: "low",
    sequenceIndex: 2,
  },
  {
    siteId: "depositproof",
    displayName: "DepositProof",
    industry: "renter_landlord",
    brandVoice: "firm, tenant-side, evidence-first",
    appUrl: "https://depositproof-omega.vercel.app",
    product: {
      id: "deposit-toolkit",
      name: "DepositProof Toolkit",
      priceUsd: 29,
      marginEstimate: 0.95,
      audience: "renters recovering security deposits",
    },
    businessModel: "digital_product",
    priceBand: "low",
    considerationLevel: "low",
    sequenceIndex: 3,
  },
  {
    siteId: "turnoverkit",
    displayName: "TurnoverKit",
    industry: "short_term_rentals",
    brandVoice: "operational, cleaner-first, checklist",
    appUrl: "https://turnoverkit.vercel.app",
    product: {
      id: "turnover-kit",
      name: "TurnoverKit Bundle",
      priceUsd: 59,
      marginEstimate: 0.93,
      audience: "STR hosts managing cleaner handoffs",
    },
    businessModel: "digital_product",
    priceBand: "mid",
    considerationLevel: "medium",
    sequenceIndex: 4,
  },
  {
    siteId: "listinglift",
    displayName: "ListingLift",
    industry: "real_estate_marketing",
    brandVoice: "polished, agent-professional",
    appUrl: "https://listinglift-eight.vercel.app",
    product: {
      id: "listing-lift",
      name: "ListingLift Kit",
      priceUsd: 79,
      marginEstimate: 0.92,
      audience: "solo realtors preparing new listings",
    },
    businessModel: "digital_product",
    priceBand: "mid",
    considerationLevel: "high",
    sequenceIndex: 5,
  },
  {
    siteId: "closeshift",
    displayName: "CloseShift",
    industry: "retail_ops",
    brandVoice: "shift-manager plainspoken",
    appUrl: "https://closeshift.vercel.app",
    product: {
      id: "closeshift-pack",
      name: "CloseShift Pack",
      priceUsd: 39,
      marginEstimate: 0.94,
      audience: "closing managers running nightly reconciliation",
    },
    businessModel: "digital_product",
    priceBand: "low",
    considerationLevel: "low",
    sequenceIndex: 6,
  },
  {
    siteId: "bidbinder",
    displayName: "BidBinder",
    industry: "contractor_ops",
    brandVoice: "no-nonsense contractor",
    appUrl: "https://bidbinder.vercel.app",
    product: {
      id: "bidbinder-pack",
      name: "BidBinder Pack",
      priceUsd: 49,
      marginEstimate: 0.93,
      audience: "GC/subcontractors chasing bids",
    },
    businessModel: "digital_product",
    priceBand: "low",
    considerationLevel: "medium",
    sequenceIndex: 7,
  },
  {
    siteId: "resumeforge",
    displayName: "ResumeForge",
    industry: "career_resume",
    brandVoice: "coach, plainspoken",
    appUrl: "https://resumeforge-liard.vercel.app",
    product: {
      id: "resume-forge",
      name: "ResumeForge Kit",
      priceUsd: 29,
      marginEstimate: 0.95,
      audience: "career switchers rewriting a resume",
    },
    businessModel: "digital_product",
    priceBand: "low",
    considerationLevel: "low",
    sequenceIndex: 8,
  },
  {
    siteId: "waitroom",
    displayName: "WaitRoom",
    industry: "healthcare_ops",
    brandVoice: "clinical, calm, patient-forward",
    appUrl: "https://waitroom-sepia.vercel.app",
    product: {
      id: "waitroom-pack",
      name: "WaitRoom Toolkit",
      priceUsd: 49,
      marginEstimate: 0.92,
      audience: "front-desk staff reducing wait time complaints",
    },
    businessModel: "digital_product",
    priceBand: "mid",
    considerationLevel: "medium",
    sequenceIndex: 9,
  },
  {
    siteId: "shopbeacon",
    displayName: "ShopBeacon",
    industry: "ecommerce_ops",
    brandVoice: "growth-marketer, sharp",
    appUrl: "https://shopbeacon.vercel.app",
    product: {
      id: "shopbeacon-pack",
      name: "ShopBeacon Kit",
      priceUsd: 59,
      marginEstimate: 0.93,
      audience: "DTC operators optimizing checkout",
    },
    businessModel: "digital_product",
    priceBand: "mid",
    considerationLevel: "medium",
    sequenceIndex: 10,
  },
];

type RetiredRecord = OperatorBusinessManifest & {
  retiredAt: string;
  retirementReason: string;
  retirementMode: "soft" | "archive";
};

function dir() {
  return path.dirname(fileURLToPath(import.meta.url));
}

function loadDynamic(): OperatorBusinessManifest[] {
  try {
    const p = path.join(dir(), "portfolio-dynamic.json");
    if (!existsSync(p)) return [];
    const raw = JSON.parse(readFileSync(p, "utf8")) as OperatorBusinessManifest[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function loadActiveMode(): { mode?: string } {
  try {
    const p = path.join(dir(), "portfolio-active-mode.json");
    if (!existsSync(p)) return {};
    return JSON.parse(readFileSync(p, "utf8")) as { mode?: string };
  } catch {
    return {};
  }
}

function loadRetired(): RetiredRecord[] {
  try {
    const p = path.join(dir(), "portfolio-retired.json");
    if (!existsSync(p)) return [];
    const raw = JSON.parse(readFileSync(p, "utf8")) as RetiredRecord[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

/** Live ACTIVE catalog — dynamic_only_50 after portfolio reset. */
export function getPortfolio(): OperatorBusinessManifest[] {
  const mode = loadActiveMode().mode;
  const dyn = loadDynamic();
  if (mode === "dynamic_only_50") {
    return dyn;
  }
  const seen = new Set(STATIC_PORTFOLIO.map((b) => b.siteId));
  return [...STATIC_PORTFOLIO, ...dyn.filter((b) => !seen.has(b.siteId))];
}

export function getRetiredPortfolio(): RetiredRecord[] {
  return loadRetired();
}

/** @deprecated prefer getPortfolio() — kept for existing imports */
export const PORTFOLIO: OperatorBusinessManifest[] = getPortfolio();

export function findBusiness(siteId: string): OperatorBusinessManifest | undefined {
  return getPortfolio().find((b) => b.siteId === siteId);
}

export function registerDynamicBusiness(manifest: OperatorBusinessManifest): void {
  const p = path.join(dir(), "portfolio-dynamic.json");
  const existing = loadDynamic().filter((b) => b.siteId !== manifest.siteId);
  existing.push(manifest);
  writeFileSync(p, JSON.stringify(existing, null, 2) + "\n");
}

/** Soft-retire: preserve intelligence; never delete source or ledgers. */
export function retireBusinessPreserve(
  manifest: OperatorBusinessManifest,
  meta: { retiredAt: string; reason: string; mode: "soft" | "archive" },
): void {
  const p = path.join(dir(), "portfolio-retired.json");
  const existing = loadRetired().filter((b) => b.siteId !== manifest.siteId);
  existing.push({
    ...manifest,
    retiredAt: meta.retiredAt,
    retirementReason: meta.reason,
    retirementMode: meta.mode,
  });
  writeFileSync(p, JSON.stringify(existing, null, 2) + "\n");

  // Remove from active dynamic registry if present
  const dynPath = path.join(dir(), "portfolio-dynamic.json");
  const dyn = loadDynamic().filter((b) => b.siteId !== manifest.siteId);
  writeFileSync(dynPath, JSON.stringify(dyn, null, 2) + "\n");

  // Archive snapshot under .data for durable learning continuity
  try {
    const snapDir = path.resolve(dir(), "../../../.data/portfolio-retired");
    mkdirSync(snapDir, { recursive: true });
    writeFileSync(
      path.join(snapDir, `${manifest.siteId}-${meta.retiredAt.replace(/[:.]/g, "-")}.json`),
      JSON.stringify({ manifest, meta }, null, 2) + "\n",
    );
  } catch {
    /* best effort */
  }
}

export function setActiveMode(mode: "legacy_static_plus_dynamic" | "dynamic_only_50"): void {
  writeFileSync(
    path.join(dir(), "portfolio-active-mode.json"),
    JSON.stringify({ mode, at: new Date().toISOString() }, null, 2) + "\n",
  );
}

export function replaceDynamicPortfolio(manifests: OperatorBusinessManifest[]): void {
  writeFileSync(
    path.join(dir(), "portfolio-dynamic.json"),
    JSON.stringify(manifests, null, 2) + "\n",
  );
}
