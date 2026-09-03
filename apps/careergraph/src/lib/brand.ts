import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:20:01.650Z */
export const BRAND: BrandConfig = {
  "siteId": "careergraph",
  "displayName": "CareerGraph",
  "domain": "careergraph.vercel.app",
  "industry": "career_graph",
  "businessModel": "digital_download",
  "priceBand": "20_50",
  "considerationLevel": "utilitarian",
  "brandVoice": "career-strategic calm",
  "primaryColor": "#0F172A",
  "accentColor": "#38BDF8",
  "fontDisplay": "Newsreader",
  "fontBody": "Inter",
  "supportEmail": "care@careergraph.com",
  "product": {
    "id": "careergraph-pack",
    "slug": "careergraph-pack",
    "name": "CareerGraph Mapping Wedge",
    "tagline": "Career planning is resume-centric, not graph-centric (skills↔roles↔proof).",
    "description": "Skills–role–proof mapping worksheets and narrative evidence plans for career graph thinking.",
    "priceUsd": 42,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "Skills↔roles map",
      "Proof portfolio planner",
      "Target role gap sheet",
      "Narrative evidence plan"
    ],
    "audience": "ambitious ICs planning multi-year career moves",
    "intentKeywords": [
      "career skills mapping",
      "role readiness worksheet",
      "career portfolio plan"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "career-skills-mapping",
      "title": "career skills mapping",
      "intentQuery": "career skills mapping",
      "body": "Skills–role–proof mapping worksheets and narrative evidence plans for career graph thinking.\n\nThis page targets: career skills mapping"
    },
    {
      "slug": "role-readiness-worksheet",
      "title": "role readiness worksheet",
      "intentQuery": "role readiness worksheet",
      "body": "Skills–role–proof mapping worksheets and narrative evidence plans for career graph thinking.\n\nThis page targets: role readiness worksheet"
    },
    {
      "slug": "career-portfolio-plan",
      "title": "career portfolio plan",
      "intentQuery": "career portfolio plan",
      "body": "Skills–role–proof mapping worksheets and narrative evidence plans for career graph thinking.\n\nThis page targets: career portfolio plan"
    }
  ],
  "sequenceIndex": 124
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
