/** Live portfolio hosts for the single owner digest. Override with PORTFOLIO_SITES_JSON. */

export type PortfolioSiteRef = {
  siteId: string;
  displayName: string;
  url: string;
  kind: "digital" | "saas" | "legacy";
};

export const DEFAULT_PORTFOLIO_SITES: PortfolioSiteRef[] = [
  {
    siteId: "raiseready",
    displayName: "RaiseReady",
    url: "https://raiseready-seven.vercel.app",
    kind: "digital",
  },
  {
    siteId: "ledgerleaf",
    displayName: "Ledgerleaf",
    url: "https://ledgerleaf-ashen.vercel.app",
    kind: "digital",
  },
  {
    siteId: "depositproof",
    displayName: "DepositProof",
    url: "https://depositproof-omega.vercel.app",
    kind: "digital",
  },
  {
    siteId: "turnoverkit",
    displayName: "TurnoverKit",
    url: "https://turnoverkit.vercel.app",
    kind: "digital",
  },
  {
    siteId: "listinglift",
    displayName: "ListingLift",
    url: "https://listinglift-eight.vercel.app",
    kind: "digital",
  },
  {
    siteId: "closeshift",
    displayName: "CloseShift",
    url: "https://closeshift.vercel.app",
    kind: "digital",
  },
  {
    siteId: "bidbinder",
    displayName: "BidBinder",
    url: "https://bidbinder.vercel.app",
    kind: "digital",
  },
  {
    siteId: "resumeforge",
    displayName: "ResumeForge",
    url: "https://resumeforge-liard.vercel.app",
    kind: "saas",
  },
  {
    siteId: "waitroom",
    displayName: "Waitroom",
    url: "https://waitroom-sepia.vercel.app",
    kind: "saas",
  },
  {
    siteId: "shopbeacon",
    displayName: "ShopBeacon",
    url: "https://shopbeacon.vercel.app",
    kind: "saas",
  },
  {
    siteId: "tributeready",
    displayName: "TributeReady",
    url: "https://tributeready.vercel.app",
    kind: "legacy",
  },
  {
    siteId: "mendhaus",
    displayName: "Mendhaus",
    url: "https://mendhaus.vercel.app",
    kind: "legacy",
  },
];

export function resolvePortfolioSites(): PortfolioSiteRef[] {
  const raw = process.env.PORTFOLIO_SITES_JSON;
  if (!raw) return DEFAULT_PORTFOLIO_SITES;
  try {
    const parsed = JSON.parse(raw) as PortfolioSiteRef[];
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch {
    /* fall through */
  }
  return DEFAULT_PORTFOLIO_SITES;
}
