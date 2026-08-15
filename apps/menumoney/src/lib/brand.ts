import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:51:08.348Z */
export const BRAND: BrandConfig = {
  "siteId": "menumoney",
  "displayName": "MenuMoney",
  "domain": "menumoney.vercel.app",
  "industry": "restaurant_menus",
  "businessModel": "digital_download",
  "priceBand": "20_50",
  "considerationLevel": "utilitarian",
  "brandVoice": "hospitality-practical, margin-aware",
  "primaryColor": "#3C1518",
  "accentColor": "#F2CC8F",
  "fontDisplay": "Josefin Slab",
  "fontBody": "Nunito",
  "supportEmail": "care@menumoney.com",
  "product": {
    "id": "menumoney-pack",
    "slug": "menumoney-pack",
    "name": "MenuMoney Menu Engineering Pack",
    "tagline": "Menus bury high-margin items and confuse guests.",
    "description": "Menu engineering worksheets, item naming guides, and pricing psychology layouts for restaurants.",
    "priceUsd": 37,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "Menu engineering matrix",
      "Item naming & description guide",
      "Margin-aware pricing worksheet",
      "QR menu content brief"
    ],
    "audience": "independent restaurant owners redesigning menus for margin",
    "intentKeywords": [
      "menu engineering template",
      "restaurant menu pricing psychology",
      "rewrite restaurant menu"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "menu-engineering-template",
      "title": "menu engineering template",
      "intentQuery": "menu engineering template",
      "body": "Menu engineering worksheets, item naming guides, and pricing psychology layouts for restaurants.\n\nThis page targets: menu engineering template"
    },
    {
      "slug": "restaurant-menu-pricing-psychology",
      "title": "restaurant menu pricing psychology",
      "intentQuery": "restaurant menu pricing psychology",
      "body": "Menu engineering worksheets, item naming guides, and pricing psychology layouts for restaurants.\n\nThis page targets: restaurant menu pricing psychology"
    },
    {
      "slug": "rewrite-restaurant-menu",
      "title": "rewrite restaurant menu",
      "intentQuery": "rewrite restaurant menu",
      "body": "Menu engineering worksheets, item naming guides, and pricing psychology layouts for restaurants.\n\nThis page targets: rewrite restaurant menu"
    }
  ],
  "sequenceIndex": 135
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
