import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:24:08.980Z */
export const BRAND: BrandConfig = {
  "siteId": "rfpstrike",
  "displayName": "RFPStrike",
  "domain": "rfpstrike.vercel.app",
  "industry": "rfp_response",
  "businessModel": "digital_download",
  "priceBand": "50_100",
  "considerationLevel": "utilitarian",
  "brandVoice": "precise, government-adjacent professional",
  "primaryColor": "#0F2744",
  "accentColor": "#C45C26",
  "fontDisplay": "Source Serif 4",
  "fontBody": "Source Sans 3",
  "supportEmail": "care@rfpstrike.com",
  "product": {
    "id": "rfpstrike-pack",
    "slug": "rfpstrike-pack",
    "name": "RFPStrike Response Pack",
    "tagline": "RFP responses are late, generic, and miss compliance matrices.",
    "description": "RFP intake checklist, compliance matrix, win-theme narrative templates, and submission QA for services firms.",
    "priceUsd": 69,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "RFP intake & go/no-go scorecard",
      "Compliance matrix spreadsheet",
      "Win-theme narrative blocks",
      "Pink-team review checklist"
    ],
    "audience": "SMB services firms answering RFPs without a proposal team",
    "intentKeywords": [
      "rfp response template",
      "proposal compliance matrix",
      "how to answer an rfp"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "rfp-response-template",
      "title": "rfp response template",
      "intentQuery": "rfp response template",
      "body": "RFP intake checklist, compliance matrix, win-theme narrative templates, and submission QA for services firms.\n\nThis page targets: rfp response template"
    },
    {
      "slug": "proposal-compliance-matrix",
      "title": "proposal compliance matrix",
      "intentQuery": "proposal compliance matrix",
      "body": "RFP intake checklist, compliance matrix, win-theme narrative templates, and submission QA for services firms.\n\nThis page targets: proposal compliance matrix"
    },
    {
      "slug": "how-to-answer-an-rfp",
      "title": "how to answer an rfp",
      "intentQuery": "how to answer an rfp",
      "body": "RFP intake checklist, compliance matrix, win-theme narrative templates, and submission QA for services firms.\n\nThis page targets: how to answer an rfp"
    }
  ],
  "sequenceIndex": 141
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
