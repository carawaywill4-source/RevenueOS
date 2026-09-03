import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:49:34.886Z */
export const BRAND: BrandConfig = {
  "siteId": "storelift",
  "displayName": "StoreLift",
  "domain": "storelift.vercel.app",
  "industry": "ecommerce_merchandising",
  "businessModel": "digital_download",
  "priceBand": "50_100",
  "considerationLevel": "utilitarian",
  "brandVoice": "growth-merchandiser, evidence-led",
  "primaryColor": "#0B132B",
  "accentColor": "#6FFFE9",
  "fontDisplay": "Sora",
  "fontBody": "Sora",
  "supportEmail": "care@storelift.com",
  "product": {
    "id": "storelift-pack",
    "slug": "storelift-pack",
    "name": "StoreLift Merchandising Pack",
    "tagline": "Product pages lack merchandising structure and proof hierarchy.",
    "description": "PDP wire frameworks, offer stacking guides, and collection merchandising checklists for ecommerce operators.",
    "priceUsd": 55,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "PDP section hierarchy",
      "Offer & bundle stacking guide",
      "Collection page checklist",
      "CRO experiment backlog sheet"
    ],
    "audience": "DTC operators with traffic but weak PDP conversion",
    "intentKeywords": [
      "product page optimization checklist",
      "ecommerce merchandising template",
      "pdp conversion framework"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "product-page-optimization-checklist",
      "title": "product page optimization checklist",
      "intentQuery": "product page optimization checklist",
      "body": "PDP wire frameworks, offer stacking guides, and collection merchandising checklists for ecommerce operators.\n\nThis page targets: product page optimization checklist"
    },
    {
      "slug": "ecommerce-merchandising-template",
      "title": "ecommerce merchandising template",
      "intentQuery": "ecommerce merchandising template",
      "body": "PDP wire frameworks, offer stacking guides, and collection merchandising checklists for ecommerce operators.\n\nThis page targets: ecommerce merchandising template"
    },
    {
      "slug": "pdp-conversion-framework",
      "title": "pdp conversion framework",
      "intentQuery": "pdp conversion framework",
      "body": "PDP wire frameworks, offer stacking guides, and collection merchandising checklists for ecommerce operators.\n\nThis page targets: pdp conversion framework"
    }
  ],
  "sequenceIndex": 110
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
