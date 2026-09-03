import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:20:01.615Z */
export const BRAND: BrandConfig = {
  "siteId": "homegrid",
  "displayName": "HomeGrid",
  "domain": "homegrid.vercel.app",
  "industry": "home_systems",
  "businessModel": "digital_download",
  "priceBand": "20_50",
  "considerationLevel": "utilitarian",
  "brandVoice": "home-ops calm",
  "primaryColor": "#3D405B",
  "accentColor": "#81B29A",
  "fontDisplay": "Literata",
  "fontBody": "Nunito Sans",
  "supportEmail": "care@homegrid.com",
  "product": {
    "id": "homegrid-pack",
    "slug": "homegrid-pack",
    "name": "HomeGrid Maintenance Wedge",
    "tagline": "Home maintenance and vendor history is tribal/forgotten.",
    "description": "Home systems inventory, seasonal maintenance calendar, and vendor history log.",
    "priceUsd": 39,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "Home systems inventory",
      "Seasonal maintenance calendar",
      "Vendor history log",
      "Emergency info sheet"
    ],
    "audience": "proactive homeowners and property pros coordinating home systems",
    "intentKeywords": [
      "home maintenance calendar",
      "home systems inventory",
      "home vendor list template"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "home-maintenance-calendar",
      "title": "home maintenance calendar",
      "intentQuery": "home maintenance calendar",
      "body": "Home systems inventory, seasonal maintenance calendar, and vendor history log.\n\nThis page targets: home maintenance calendar"
    },
    {
      "slug": "home-systems-inventory",
      "title": "home systems inventory",
      "intentQuery": "home systems inventory",
      "body": "Home systems inventory, seasonal maintenance calendar, and vendor history log.\n\nThis page targets: home systems inventory"
    },
    {
      "slug": "home-vendor-list-template",
      "title": "home vendor list template",
      "intentQuery": "home vendor list template",
      "body": "Home systems inventory, seasonal maintenance calendar, and vendor history log.\n\nThis page targets: home vendor list template"
    }
  ],
  "sequenceIndex": 114
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
