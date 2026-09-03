import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:20:01.235Z */
export const BRAND: BrandConfig = {
  "siteId": "linkedlift",
  "displayName": "LinkedLift",
  "domain": "linkedlift.vercel.app",
  "industry": "linkedin_optimization",
  "businessModel": "digital_download",
  "priceBand": "20_50",
  "considerationLevel": "utilitarian",
  "brandVoice": "modern professional, non-cringe",
  "primaryColor": "#0A66C2",
  "accentColor": "#F5F5F5",
  "fontDisplay": "Manrope",
  "fontBody": "Manrope",
  "supportEmail": "care@linkedlift.com",
  "product": {
    "id": "linkedlift-pack",
    "slug": "linkedlift-pack",
    "name": "LinkedLift Profile Pack",
    "tagline": "Profiles read like resumes and bury positioning.",
    "description": "Headline formulas, About-section frameworks, featured-section plans, and outreach openers for LinkedIn.",
    "priceUsd": 31,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "Headline & banner formulas",
      "About section frameworks",
      "Featured section plan",
      "Inbound DM openers"
    ],
    "audience": "professionals whose LinkedIn fails to attract inbound",
    "intentKeywords": [
      "linkedin headline examples",
      "linkedin about section template",
      "optimize linkedin profile"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "linkedin-headline-examples",
      "title": "linkedin headline examples",
      "intentQuery": "linkedin headline examples",
      "body": "Headline formulas, About-section frameworks, featured-section plans, and outreach openers for LinkedIn.\n\nThis page targets: linkedin headline examples"
    },
    {
      "slug": "linkedin-about-section-template",
      "title": "linkedin about section template",
      "intentQuery": "linkedin about section template",
      "body": "Headline formulas, About-section frameworks, featured-section plans, and outreach openers for LinkedIn.\n\nThis page targets: linkedin about section template"
    },
    {
      "slug": "optimize-linkedin-profile",
      "title": "optimize linkedin profile",
      "intentQuery": "optimize linkedin profile",
      "body": "Headline formulas, About-section frameworks, featured-section plans, and outreach openers for LinkedIn.\n\nThis page targets: optimize linkedin profile"
    }
  ],
  "sequenceIndex": 140
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
