import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:20:01.589Z */
export const BRAND: BrandConfig = {
  "siteId": "commercegraph",
  "displayName": "CommerceGraph",
  "domain": "commercegraph.vercel.app",
  "industry": "commerce_graph",
  "businessModel": "digital_download",
  "priceBand": "50_100",
  "considerationLevel": "utilitarian",
  "brandVoice": "commerce-systems",
  "primaryColor": "#1A535C",
  "accentColor": "#FF6B6B",
  "fontDisplay": "Archivo",
  "fontBody": "Archivo",
  "supportEmail": "care@commercegraph.com",
  "product": {
    "id": "commercegraph-pack",
    "slug": "commercegraph-pack",
    "name": "CommerceGraph Catalog Truth Wedge",
    "tagline": "Commerce data is siloed per channel with no shared product truth.",
    "description": "Canonical product truth worksheet and channel mapping starter for multi-channel sellers.",
    "priceUsd": 88,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "Canonical SKU sheet",
      "Channel attribute map",
      "Price parity checker",
      "Fulfillment constraint log"
    ],
    "audience": "operators connecting catalog, channel, and fulfillment facts",
    "intentKeywords": [
      "multi channel catalog management",
      "sku source of truth template",
      "ecommerce channel mapping"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "multi-channel-catalog-management",
      "title": "multi channel catalog management",
      "intentQuery": "multi channel catalog management",
      "body": "Canonical product truth worksheet and channel mapping starter for multi-channel sellers.\n\nThis page targets: multi channel catalog management"
    },
    {
      "slug": "sku-source-of-truth-template",
      "title": "sku source of truth template",
      "intentQuery": "sku source of truth template",
      "body": "Canonical product truth worksheet and channel mapping starter for multi-channel sellers.\n\nThis page targets: sku source of truth template"
    },
    {
      "slug": "ecommerce-channel-mapping",
      "title": "ecommerce channel mapping",
      "intentQuery": "ecommerce channel mapping",
      "body": "Canonical product truth worksheet and channel mapping starter for multi-channel sellers.\n\nThis page targets: ecommerce channel mapping"
    }
  ],
  "sequenceIndex": 131
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
