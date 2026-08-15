import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:20:01.530Z */
export const BRAND: BrandConfig = {
  "siteId": "localmarket",
  "displayName": "LocalMarket",
  "domain": "localmarket.vercel.app",
  "industry": "local_marketplace",
  "businessModel": "digital_download",
  "priceBand": "50_100",
  "considerationLevel": "utilitarian",
  "brandVoice": "civic-commercial practical",
  "primaryColor": "#1B4332",
  "accentColor": "#F4A261",
  "fontDisplay": "DM Serif Display",
  "fontBody": "DM Sans",
  "supportEmail": "care@localmarket.com",
  "product": {
    "id": "localmarket-pack",
    "slug": "localmarket-pack",
    "name": "LocalMarket Directory Wedge",
    "tagline": "Local supply/demand matching lacks a credible lightweight start.",
    "description": "Local directory quality standards, category taxonomy, and merchant onboarding checklist — marketplace wedge.",
    "priceUsd": 55,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "Category taxonomy",
      "Merchant quality standards",
      "Onboarding checklist",
      "Trust signal policy (no fake reviews)"
    ],
    "audience": "local service aggregators and chamber-style organizers",
    "intentKeywords": [
      "local business directory template",
      "merchant onboarding checklist",
      "local marketplace categories"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "local-business-directory-template",
      "title": "local business directory template",
      "intentQuery": "local business directory template",
      "body": "Local directory quality standards, category taxonomy, and merchant onboarding checklist — marketplace wedge.\n\nThis page targets: local business directory template"
    },
    {
      "slug": "merchant-onboarding-checklist",
      "title": "merchant onboarding checklist",
      "intentQuery": "merchant onboarding checklist",
      "body": "Local directory quality standards, category taxonomy, and merchant onboarding checklist — marketplace wedge.\n\nThis page targets: merchant onboarding checklist"
    },
    {
      "slug": "local-marketplace-categories",
      "title": "local marketplace categories",
      "intentQuery": "local marketplace categories",
      "body": "Local directory quality standards, category taxonomy, and merchant onboarding checklist — marketplace wedge.\n\nThis page targets: local marketplace categories"
    }
  ],
  "sequenceIndex": 121
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
