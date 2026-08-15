import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:20:01.371Z */
export const BRAND: BrandConfig = {
  "siteId": "merchantbrain",
  "displayName": "MerchantBrain",
  "domain": "merchantbrain.vercel.app",
  "industry": "merchant_intelligence",
  "businessModel": "digital_download",
  "priceBand": "50_100",
  "considerationLevel": "utilitarian",
  "brandVoice": "merchant-analytic",
  "primaryColor": "#051923",
  "accentColor": "#00A6A6",
  "fontDisplay": "Space Grotesk",
  "fontBody": "IBM Plex Sans",
  "supportEmail": "care@merchantbrain.com",
  "product": {
    "id": "merchantbrain-pack",
    "slug": "merchantbrain-pack",
    "name": "MerchantBrain Assortment Wedge",
    "tagline": "Merchants lack a decision system for what to stock, promote, or kill.",
    "description": "Assortment decision worksheets and weekly merchandising review ritual for growing merchants.",
    "priceUsd": 85,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "SKU kill/keep/scorecard",
      "Weekly merch review ritual",
      "Promo calendar skeleton",
      "Supplier renegotiation prompts"
    ],
    "audience": "multi-SKU ecommerce operators guessing assortment",
    "intentKeywords": [
      "ecommerce assortment planning",
      "sku rationalization template",
      "merchandising review checklist"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "ecommerce-assortment-planning",
      "title": "ecommerce assortment planning",
      "intentQuery": "ecommerce assortment planning",
      "body": "Assortment decision worksheets and weekly merchandising review ritual for growing merchants.\n\nThis page targets: ecommerce assortment planning"
    },
    {
      "slug": "sku-rationalization-template",
      "title": "sku rationalization template",
      "intentQuery": "sku rationalization template",
      "body": "Assortment decision worksheets and weekly merchandising review ritual for growing merchants.\n\nThis page targets: sku rationalization template"
    },
    {
      "slug": "merchandising-review-checklist",
      "title": "merchandising review checklist",
      "intentQuery": "merchandising review checklist",
      "body": "Assortment decision worksheets and weekly merchandising review ritual for growing merchants.\n\nThis page targets: merchandising review checklist"
    }
  ],
  "sequenceIndex": 147
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
