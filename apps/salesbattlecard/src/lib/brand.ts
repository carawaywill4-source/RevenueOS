import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:20:01.329Z */
export const BRAND: BrandConfig = {
  "siteId": "salesbattlecard",
  "displayName": "SalesBattlecard",
  "domain": "salesbattlecard.vercel.app",
  "industry": "sales_intelligence",
  "businessModel": "digital_download",
  "priceBand": "50_100",
  "considerationLevel": "utilitarian",
  "brandVoice": "sales-enablement crisp",
  "primaryColor": "#14213D",
  "accentColor": "#FCA311",
  "fontDisplay": "Kanit",
  "fontBody": "Kanit",
  "supportEmail": "care@salesbattlecard.com",
  "product": {
    "id": "salesbattlecard-pack",
    "slug": "salesbattlecard-pack",
    "name": "SalesBattlecard Build Pack",
    "tagline": "Competitive talk tracks are tribal knowledge and outdated.",
    "description": "Battlecard templates, competitor teardown worksheets, and objection handling without fabricated win rates.",
    "priceUsd": 61,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "Battlecard template",
      "Competitor teardown worksheet",
      "Landmine & trap questions",
      "Honest objection handlers"
    ],
    "audience": "AEs needing battlecards without a product-marketing team",
    "intentKeywords": [
      "sales battlecard template",
      "competitive battlecard example",
      "objection handling worksheet"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "sales-battlecard-template",
      "title": "sales battlecard template",
      "intentQuery": "sales battlecard template",
      "body": "Battlecard templates, competitor teardown worksheets, and objection handling without fabricated win rates.\n\nThis page targets: sales battlecard template"
    },
    {
      "slug": "competitive-battlecard-example",
      "title": "competitive battlecard example",
      "intentQuery": "competitive battlecard example",
      "body": "Battlecard templates, competitor teardown worksheets, and objection handling without fabricated win rates.\n\nThis page targets: competitive battlecard example"
    },
    {
      "slug": "objection-handling-worksheet",
      "title": "objection handling worksheet",
      "intentQuery": "objection handling worksheet",
      "body": "Battlecard templates, competitor teardown worksheets, and objection handling without fabricated win rates.\n\nThis page targets: objection handling worksheet"
    }
  ],
  "sequenceIndex": 143
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
