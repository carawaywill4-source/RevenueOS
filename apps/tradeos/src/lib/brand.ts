import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:20:01.341Z */
export const BRAND: BrandConfig = {
  "siteId": "tradeos",
  "displayName": "TradeOS",
  "domain": "tradeos.vercel.app",
  "industry": "trades_operations_platform",
  "businessModel": "digital_download",
  "priceBand": "50_100",
  "considerationLevel": "utilitarian",
  "brandVoice": "operations-serious trades",
  "primaryColor": "#102A43",
  "accentColor": "#F0B429",
  "fontDisplay": "IBM Plex Serif",
  "fontBody": "IBM Plex Sans",
  "supportEmail": "care@tradeos.com",
  "product": {
    "id": "tradeos-pack",
    "slug": "tradeos-pack",
    "name": "TradeOS Job Control Wedge",
    "tagline": "Job ops live in texts and spreadsheets; nothing compounds into an operating system.",
    "description": "Starter job-control pack: job intake, crew assignment sheet, and materials checklist — the wedge into a trades OS.",
    "priceUsd": 79,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "Job intake form system",
      "Crew assignment board",
      "Materials pull sheet",
      "Customer update cadence"
    ],
    "audience": "growing trade contractors coordinating jobs, crews, and materials",
    "intentKeywords": [
      "contractor job management template",
      "trades operations checklist",
      "crew scheduling sheet"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "contractor-job-management-template",
      "title": "contractor job management template",
      "intentQuery": "contractor job management template",
      "body": "Starter job-control pack: job intake, crew assignment sheet, and materials checklist — the wedge into a trades OS.\n\nThis page targets: contractor job management template"
    },
    {
      "slug": "trades-operations-checklist",
      "title": "trades operations checklist",
      "intentQuery": "trades operations checklist",
      "body": "Starter job-control pack: job intake, crew assignment sheet, and materials checklist — the wedge into a trades OS.\n\nThis page targets: trades operations checklist"
    },
    {
      "slug": "crew-scheduling-sheet",
      "title": "crew scheduling sheet",
      "intentQuery": "crew scheduling sheet",
      "body": "Starter job-control pack: job intake, crew assignment sheet, and materials checklist — the wedge into a trades OS.\n\nThis page targets: crew scheduling sheet"
    }
  ],
  "sequenceIndex": 138
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
