import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:20:01.683Z */
export const BRAND: BrandConfig = {
  "siteId": "supplybrain",
  "displayName": "SupplyBrain",
  "domain": "supplybrain.vercel.app",
  "industry": "supply_intelligence",
  "businessModel": "digital_download",
  "priceBand": "50_100",
  "considerationLevel": "utilitarian",
  "brandVoice": "supply-chain pragmatic",
  "primaryColor": "#1D3557",
  "accentColor": "#F4A261",
  "fontDisplay": "Roboto Slab",
  "fontBody": "Roboto",
  "supportEmail": "care@supplybrain.com",
  "product": {
    "id": "supplybrain-pack",
    "slug": "supplybrain-pack",
    "name": "SupplyBrain Risk Wedge",
    "tagline": "Supply risk is noticed only after stockouts.",
    "description": "Supplier risk scorecards, dual-source decision sheets, and shortage response playbooks.",
    "priceUsd": 91,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "Supplier risk scorecard",
      "Dual-source decision sheet",
      "Shortage response playbook",
      "Lead-time tracker"
    ],
    "audience": "ops leads managing critical suppliers",
    "intentKeywords": [
      "supplier risk scorecard",
      "dual sourcing decision matrix",
      "shortage response plan"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "supplier-risk-scorecard",
      "title": "supplier risk scorecard",
      "intentQuery": "supplier risk scorecard",
      "body": "Supplier risk scorecards, dual-source decision sheets, and shortage response playbooks.\n\nThis page targets: supplier risk scorecard"
    },
    {
      "slug": "dual-sourcing-decision-matrix",
      "title": "dual sourcing decision matrix",
      "intentQuery": "dual sourcing decision matrix",
      "body": "Supplier risk scorecards, dual-source decision sheets, and shortage response playbooks.\n\nThis page targets: dual sourcing decision matrix"
    },
    {
      "slug": "shortage-response-plan",
      "title": "shortage response plan",
      "intentQuery": "shortage response plan",
      "body": "Supplier risk scorecards, dual-source decision sheets, and shortage response playbooks.\n\nThis page targets: shortage response plan"
    }
  ],
  "sequenceIndex": 125
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
