import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:20:01.579Z */
export const BRAND: BrandConfig = {
  "siteId": "revenuecloud",
  "displayName": "RevenueCloud",
  "domain": "revenuecloud.vercel.app",
  "industry": "revenue_operations",
  "businessModel": "digital_download",
  "priceBand": "50_100",
  "considerationLevel": "utilitarian",
  "brandVoice": "revops-precise",
  "primaryColor": "#03045E",
  "accentColor": "#00B4D8",
  "fontDisplay": "Manrope",
  "fontBody": "Manrope",
  "supportEmail": "care@revenuecloud.com",
  "product": {
    "id": "revenuecloud-pack",
    "slug": "revenuecloud-pack",
    "name": "RevenueCloud Ritual Wedge",
    "tagline": "Pipeline definitions and revenue rituals are inconsistent.",
    "description": "Pipeline stage definitions, weekly revenue ritual, and forecast hygiene worksheets.",
    "priceUsd": 79,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "Pipeline stage dictionary",
      "Weekly revenue ritual",
      "Forecast hygiene sheet",
      "Leakage autopsy template"
    ],
    "audience": "founders/RevOps without a full RevOps hire",
    "intentKeywords": [
      "pipeline stages definition template",
      "weekly revenue meeting agenda",
      "forecast hygiene checklist"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "pipeline-stages-definition-template",
      "title": "pipeline stages definition template",
      "intentQuery": "pipeline stages definition template",
      "body": "Pipeline stage definitions, weekly revenue ritual, and forecast hygiene worksheets.\n\nThis page targets: pipeline stages definition template"
    },
    {
      "slug": "weekly-revenue-meeting-agenda",
      "title": "weekly revenue meeting agenda",
      "intentQuery": "weekly revenue meeting agenda",
      "body": "Pipeline stage definitions, weekly revenue ritual, and forecast hygiene worksheets.\n\nThis page targets: weekly revenue meeting agenda"
    },
    {
      "slug": "forecast-hygiene-checklist",
      "title": "forecast hygiene checklist",
      "intentQuery": "forecast hygiene checklist",
      "body": "Pipeline stage definitions, weekly revenue ritual, and forecast hygiene worksheets.\n\nThis page targets: forecast hygiene checklist"
    }
  ],
  "sequenceIndex": 127
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
