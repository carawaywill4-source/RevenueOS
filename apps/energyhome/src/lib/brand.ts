import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:20:01.630Z */
export const BRAND: BrandConfig = {
  "siteId": "energyhome",
  "displayName": "EnergyHome",
  "domain": "energyhome.vercel.app",
  "industry": "home_energy",
  "businessModel": "digital_download",
  "priceBand": "20_50",
  "considerationLevel": "utilitarian",
  "brandVoice": "education-first energy",
  "primaryColor": "#1B4332",
  "accentColor": "#95D5B2",
  "fontDisplay": "Fraunces",
  "fontBody": "Source Sans 3",
  "supportEmail": "care@energyhome.com",
  "product": {
    "id": "energyhome-pack",
    "slug": "energyhome-pack",
    "name": "EnergyHome Decision Wedge",
    "tagline": "Energy upgrade decisions are vendor-led, not decision-led.",
    "description": "Home energy decision worksheets, upgrade prioritization, and vendor question lists (educational).",
    "priceUsd": 45,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "Upgrade prioritization sheet",
      "Vendor question list",
      "Bill baseline tracker",
      "Payback honesty worksheet"
    ],
    "audience": "homeowners evaluating efficiency upgrades without sales pressure",
    "intentKeywords": [
      "home energy audit checklist diy",
      "solar decision worksheet",
      "hvac replacement questions"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "home-energy-audit-checklist-diy",
      "title": "home energy audit checklist diy",
      "intentQuery": "home energy audit checklist diy",
      "body": "Home energy decision worksheets, upgrade prioritization, and vendor question lists (educational).\n\nThis page targets: home energy audit checklist diy"
    },
    {
      "slug": "solar-decision-worksheet",
      "title": "solar decision worksheet",
      "intentQuery": "solar decision worksheet",
      "body": "Home energy decision worksheets, upgrade prioritization, and vendor question lists (educational).\n\nThis page targets: solar decision worksheet"
    },
    {
      "slug": "hvac-replacement-questions",
      "title": "hvac replacement questions",
      "intentQuery": "hvac replacement questions",
      "body": "Home energy decision worksheets, upgrade prioritization, and vendor question lists (educational).\n\nThis page targets: hvac replacement questions"
    }
  ],
  "sequenceIndex": 149
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
