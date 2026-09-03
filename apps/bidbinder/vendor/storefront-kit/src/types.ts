export type BusinessModelKind =
  | "digital_download"
  | "saas_subscription"
  | "usage_software"
  | "physical_ecommerce"
  | "lead_service";

export type ConsiderationLevel =
  | "impulse"
  | "utilitarian"
  | "considered"
  | "high_ticket";

export type PriceBand =
  | "under_20"
  | "20_50"
  | "50_100"
  | "100_250"
  | "250_500"
  | "500_plus"
  | "sub_low"
  | "sub_b2b";

export type DigitalProduct = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  priceUsd: number;
  /** Files under content/product/ served after purchase */
  assetFiles: string[];
  bullets: string[];
  audience: string;
  intentKeywords: string[];
};

export type BrandConfig = {
  siteId: string;
  displayName: string;
  domain: string;
  industry: string;
  businessModel: BusinessModelKind;
  priceBand: PriceBand;
  considerationLevel: ConsiderationLevel;
  brandVoice: string;
  primaryColor: string;
  accentColor: string;
  fontDisplay: string;
  fontBody: string;
  supportEmail: string;
  product: DigitalProduct;
  discoveryDoors: Array<{
    slug: string;
    title: string;
    intentQuery: string;
    body: string;
  }>;
  sequenceIndex: number;
};

export function priceBandFor(priceUsd: number, recurring?: boolean): PriceBand {
  if (recurring) return priceUsd <= 20 ? "sub_low" : "sub_b2b";
  if (priceUsd < 20) return "under_20";
  if (priceUsd < 50) return "20_50";
  if (priceUsd < 100) return "50_100";
  if (priceUsd < 250) return "100_250";
  if (priceUsd < 500) return "250_500";
  return "500_plus";
}
