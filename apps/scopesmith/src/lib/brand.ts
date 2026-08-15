import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:25:31.909Z */
export const BRAND: BrandConfig = {
  "siteId": "scopesmith",
  "displayName": "ScopeSmith",
  "domain": "scopesmith.vercel.app",
  "industry": "professional_sow",
  "businessModel": "digital_download",
  "priceBand": "20_50",
  "considerationLevel": "utilitarian",
  "brandVoice": "calm specialist, boundary-clear",
  "primaryColor": "#1B3A4B",
  "accentColor": "#D4A373",
  "fontDisplay": "Libre Baskerville",
  "fontBody": "Nunito Sans",
  "supportEmail": "care@scopesmith.com",
  "product": {
    "id": "scopesmith-pack",
    "slug": "scopesmith-pack",
    "name": "ScopeSmith SOW Studio Pack",
    "tagline": "Vague scopes create unpaid revisions and client conflict.",
    "description": "Statement-of-work templates, out-of-scope language, milestone schedules, and acceptance criteria kits for professional services.",
    "priceUsd": 45,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "SOW master templates by engagement type",
      "Out-of-scope & assumption banks",
      "Milestone + acceptance criteria",
      "Revision policy inserts"
    ],
    "audience": "consultants and agencies scoping fixed-fee work",
    "intentKeywords": [
      "statement of work template",
      "consulting sow example",
      "scope of work for freelancers"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "statement-of-work-template",
      "title": "statement of work template",
      "intentQuery": "statement of work template",
      "body": "Statement-of-work templates, out-of-scope language, milestone schedules, and acceptance criteria kits for professional services.\n\nThis page targets: statement of work template"
    },
    {
      "slug": "consulting-sow-example",
      "title": "consulting sow example",
      "intentQuery": "consulting sow example",
      "body": "Statement-of-work templates, out-of-scope language, milestone schedules, and acceptance criteria kits for professional services.\n\nThis page targets: consulting sow example"
    },
    {
      "slug": "scope-of-work-for-freelancers",
      "title": "scope of work for freelancers",
      "intentQuery": "scope of work for freelancers",
      "body": "Statement-of-work templates, out-of-scope language, milestone schedules, and acceptance criteria kits for professional services.\n\nThis page targets: scope of work for freelancers"
    }
  ],
  "sequenceIndex": 142
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
