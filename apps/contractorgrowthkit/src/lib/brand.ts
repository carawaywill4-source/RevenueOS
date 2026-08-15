import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:20:01.318Z */
export const BRAND: BrandConfig = {
  "siteId": "contractorgrowthkit",
  "displayName": "ContractorGrowthKit",
  "domain": "contractorgrowthkit.vercel.app",
  "industry": "trades_marketing",
  "businessModel": "digital_download",
  "priceBand": "50_100",
  "considerationLevel": "utilitarian",
  "brandVoice": "trades-plainspoken, growth-minded",
  "primaryColor": "#1C1C1C",
  "accentColor": "#FFB703",
  "fontDisplay": "Roboto Slab",
  "fontBody": "Roboto",
  "supportEmail": "care@contractorgrowthkit.com",
  "product": {
    "id": "contractorgrowthkit-pack",
    "slug": "contractorgrowthkit-pack",
    "name": "ContractorGrowthKit Campaign Pack",
    "tagline": "Trades rely on word-of-mouth with no repeatable campaign system.",
    "description": "Local campaign calendars, offer framing, review-ask scripts, and neighborhood flyer briefs for trades.",
    "priceUsd": 52,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "90-day local campaign calendar",
      "Offer framing worksheets",
      "Review-ask scripts",
      "Neighborhood flyer briefs"
    ],
    "audience": "trade contractors needing local lead campaigns",
    "intentKeywords": [
      "contractor marketing plan",
      "how contractors get local leads",
      "trades advertising ideas"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "contractor-marketing-plan",
      "title": "contractor marketing plan",
      "intentQuery": "contractor marketing plan",
      "body": "Local campaign calendars, offer framing, review-ask scripts, and neighborhood flyer briefs for trades.\n\nThis page targets: contractor marketing plan"
    },
    {
      "slug": "how-contractors-get-local-leads",
      "title": "how contractors get local leads",
      "intentQuery": "how contractors get local leads",
      "body": "Local campaign calendars, offer framing, review-ask scripts, and neighborhood flyer briefs for trades.\n\nThis page targets: how contractors get local leads"
    },
    {
      "slug": "trades-advertising-ideas",
      "title": "trades advertising ideas",
      "intentQuery": "trades advertising ideas",
      "body": "Local campaign calendars, offer framing, review-ask scripts, and neighborhood flyer briefs for trades.\n\nThis page targets: trades advertising ideas"
    }
  ],
  "sequenceIndex": 119
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
