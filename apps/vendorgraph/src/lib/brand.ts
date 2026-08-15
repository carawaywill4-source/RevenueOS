import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:20:01.517Z */
export const BRAND: BrandConfig = {
  "siteId": "vendorgraph",
  "displayName": "VendorGraph",
  "domain": "vendorgraph.vercel.app",
  "industry": "vendor_management",
  "businessModel": "digital_download",
  "priceBand": "50_100",
  "considerationLevel": "utilitarian",
  "brandVoice": "procurement-practical",
  "primaryColor": "#241623",
  "accentColor": "#E0AFA0",
  "fontDisplay": "Fraunces",
  "fontBody": "Figtree",
  "supportEmail": "care@vendorgraph.com",
  "product": {
    "id": "vendorgraph-pack",
    "slug": "vendorgraph-pack",
    "name": "VendorGraph Inventory Wedge",
    "tagline": "Vendor spend and risk are invisible until renewal chaos.",
    "description": "Vendor inventory workbook, renewal calendar, and risk tiering starter for SMB vendor graphs.",
    "priceUsd": 69,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "Vendor inventory workbook",
      "Renewal calendar",
      "Risk tiering sheet",
      "Consolidation candidate list"
    ],
    "audience": "ops/finance leads with sprawling vendors",
    "intentKeywords": [
      "vendor inventory template",
      "saas renewal tracker",
      "vendor risk tiering"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "vendor-inventory-template",
      "title": "vendor inventory template",
      "intentQuery": "vendor inventory template",
      "body": "Vendor inventory workbook, renewal calendar, and risk tiering starter for SMB vendor graphs.\n\nThis page targets: vendor inventory template"
    },
    {
      "slug": "saas-renewal-tracker",
      "title": "saas renewal tracker",
      "intentQuery": "saas renewal tracker",
      "body": "Vendor inventory workbook, renewal calendar, and risk tiering starter for SMB vendor graphs.\n\nThis page targets: saas renewal tracker"
    },
    {
      "slug": "vendor-risk-tiering",
      "title": "vendor risk tiering",
      "intentQuery": "vendor risk tiering",
      "body": "Vendor inventory workbook, renewal calendar, and risk tiering starter for SMB vendor graphs.\n\nThis page targets: vendor risk tiering"
    }
  ],
  "sequenceIndex": 121
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
