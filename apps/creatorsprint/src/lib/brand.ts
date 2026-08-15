import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:20:01.275Z */
export const BRAND: BrandConfig = {
  "siteId": "creatorsprint",
  "displayName": "CreatorSprint",
  "domain": "creatorsprint.vercel.app",
  "industry": "content_campaigns",
  "businessModel": "digital_download",
  "priceBand": "20_50",
  "considerationLevel": "utilitarian",
  "brandVoice": "creator-operator, energetic but grounded",
  "primaryColor": "#2B0A3D",
  "accentColor": "#FF9F1C",
  "fontDisplay": "Syne",
  "fontBody": "Outfit",
  "supportEmail": "care@creatorsprint.com",
  "product": {
    "id": "creatorsprint-pack",
    "slug": "creatorsprint-pack",
    "name": "CreatorSprint Campaign Pack",
    "tagline": "Content calendars sprawl without a conversion spine.",
    "description": "2-week content sprint plans, hook libraries, and CTA ladders for creators running campaigns.",
    "priceUsd": 39,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "2-week sprint planner",
      "Hook library by format",
      "CTA ladder",
      "Repurposing matrix"
    ],
    "audience": "creators and marketers planning a focused content sprint",
    "intentKeywords": [
      "content sprint plan",
      "content calendar with cta",
      "creator campaign template"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "content-sprint-plan",
      "title": "content sprint plan",
      "intentQuery": "content sprint plan",
      "body": "2-week content sprint plans, hook libraries, and CTA ladders for creators running campaigns.\n\nThis page targets: content sprint plan"
    },
    {
      "slug": "content-calendar-with-cta",
      "title": "content calendar with cta",
      "intentQuery": "content calendar with cta",
      "body": "2-week content sprint plans, hook libraries, and CTA ladders for creators running campaigns.\n\nThis page targets: content calendar with cta"
    },
    {
      "slug": "creator-campaign-template",
      "title": "creator campaign template",
      "intentQuery": "creator campaign template",
      "body": "2-week content sprint plans, hook libraries, and CTA ladders for creators running campaigns.\n\nThis page targets: creator campaign template"
    }
  ],
  "sequenceIndex": 111
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
