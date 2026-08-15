import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:20:01.382Z */
export const BRAND: BrandConfig = {
  "siteId": "buildgrid",
  "displayName": "BuildGrid",
  "domain": "buildgrid.vercel.app",
  "industry": "construction_coordination",
  "businessModel": "digital_download",
  "priceBand": "50_100",
  "considerationLevel": "utilitarian",
  "brandVoice": "field PM precise",
  "primaryColor": "#1B4332",
  "accentColor": "#D8F3DC",
  "fontDisplay": "Roboto Slab",
  "fontBody": "Roboto",
  "supportEmail": "care@buildgrid.com",
  "product": {
    "id": "buildgrid-pack",
    "slug": "buildgrid-pack",
    "name": "BuildGrid Coordination Wedge",
    "tagline": "RFIs, schedules, and punch lists live in email chaos.",
    "description": "RFI log, look-ahead schedule, and punch-list system starters for build coordination.",
    "priceUsd": 89,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "RFI log template",
      "3-week look-ahead",
      "Punch list system",
      "Submittal tracker"
    ],
    "audience": "project managers coordinating subcontractors on small/mid builds",
    "intentKeywords": [
      "construction rfi log template",
      "look ahead schedule construction",
      "punch list template"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "construction-rfi-log-template",
      "title": "construction rfi log template",
      "intentQuery": "construction rfi log template",
      "body": "RFI log, look-ahead schedule, and punch-list system starters for build coordination.\n\nThis page targets: construction rfi log template"
    },
    {
      "slug": "look-ahead-schedule-construction",
      "title": "look ahead schedule construction",
      "intentQuery": "look ahead schedule construction",
      "body": "RFI log, look-ahead schedule, and punch-list system starters for build coordination.\n\nThis page targets: look ahead schedule construction"
    },
    {
      "slug": "punch-list-template",
      "title": "punch list template",
      "intentQuery": "punch list template",
      "body": "RFI log, look-ahead schedule, and punch-list system starters for build coordination.\n\nThis page targets: punch list template"
    }
  ],
  "sequenceIndex": 132
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
