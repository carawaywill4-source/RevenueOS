import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:29:56.706Z */
export const BRAND: BrandConfig = {
  "siteId": "coldforge",
  "displayName": "ColdForge",
  "domain": "coldforge.vercel.app",
  "industry": "b2b_outreach",
  "businessModel": "digital_download",
  "priceBand": "50_100",
  "considerationLevel": "utilitarian",
  "brandVoice": "sharp, anti-spam, research-first",
  "primaryColor": "#0D1B2A",
  "accentColor": "#778DA9",
  "fontDisplay": "Playfair Display",
  "fontBody": "Work Sans",
  "supportEmail": "care@coldforge.com",
  "product": {
    "id": "coldforge-pack",
    "slug": "coldforge-pack",
    "name": "ColdForge Research-to-Send Pack",
    "tagline": "Cold outreach is either spammy or takes hours of research per account.",
    "description": "Account research worksheets, personalization frameworks, and compliant sequence skeletons for B2B outbound.",
    "priceUsd": 59,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "Account research worksheet",
      "Personalization angle library",
      "3-touch compliant sequences",
      "Objection reply bank"
    ],
    "audience": "founders and AEs running compliant outbound",
    "intentKeywords": [
      "cold email template b2b",
      "outbound sequence template",
      "account research framework"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "cold-email-template-b2b",
      "title": "cold email template b2b",
      "intentQuery": "cold email template b2b",
      "body": "Account research worksheets, personalization frameworks, and compliant sequence skeletons for B2B outbound.\n\nThis page targets: cold email template b2b"
    },
    {
      "slug": "outbound-sequence-template",
      "title": "outbound sequence template",
      "intentQuery": "outbound sequence template",
      "body": "Account research worksheets, personalization frameworks, and compliant sequence skeletons for B2B outbound.\n\nThis page targets: outbound sequence template"
    },
    {
      "slug": "account-research-framework",
      "title": "account research framework",
      "intentQuery": "account research framework",
      "body": "Account research worksheets, personalization frameworks, and compliant sequence skeletons for B2B outbound.\n\nThis page targets: account research framework"
    }
  ],
  "sequenceIndex": 121
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
