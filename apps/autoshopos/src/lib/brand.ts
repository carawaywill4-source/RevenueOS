import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:20:01.426Z */
export const BRAND: BrandConfig = {
  "siteId": "autoshopos",
  "displayName": "AutoShop OS",
  "domain": "autoshopos.vercel.app",
  "industry": "auto_shop_operations",
  "businessModel": "digital_download",
  "priceBand": "50_100",
  "considerationLevel": "utilitarian",
  "brandVoice": "shop-floor practical",
  "primaryColor": "#1A1A1A",
  "accentColor": "#E63946",
  "fontDisplay": "Oswald",
  "fontBody": "Open Sans",
  "supportEmail": "care@autoshopos.com",
  "product": {
    "id": "autoshopos-pack",
    "slug": "autoshopos-pack",
    "name": "AutoShop OS RO Flow Wedge",
    "tagline": "RO flow, parts, and customer updates are fragmented.",
    "description": "Repair-order flow checklists, authorization scripts, and parts-status customer updates for shops.",
    "priceUsd": 72,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "RO flow checklist",
      "Authorization scripts",
      "Parts status updates",
      "Bay utilization sheet"
    ],
    "audience": "independent auto shop owners",
    "intentKeywords": [
      "auto shop repair order process",
      "service writer authorization script",
      "shop bay utilization"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "auto-shop-repair-order-process",
      "title": "auto shop repair order process",
      "intentQuery": "auto shop repair order process",
      "body": "Repair-order flow checklists, authorization scripts, and parts-status customer updates for shops.\n\nThis page targets: auto shop repair order process"
    },
    {
      "slug": "service-writer-authorization-script",
      "title": "service writer authorization script",
      "intentQuery": "service writer authorization script",
      "body": "Repair-order flow checklists, authorization scripts, and parts-status customer updates for shops.\n\nThis page targets: service writer authorization script"
    },
    {
      "slug": "shop-bay-utilization",
      "title": "shop bay utilization",
      "intentQuery": "shop bay utilization",
      "body": "Repair-order flow checklists, authorization scripts, and parts-status customer updates for shops.\n\nThis page targets: shop bay utilization"
    }
  ],
  "sequenceIndex": 109
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
