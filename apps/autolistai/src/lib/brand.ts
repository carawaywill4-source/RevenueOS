import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:46:44.944Z */
export const BRAND: BrandConfig = {
  "siteId": "autolistai",
  "displayName": "AutoList AI",
  "domain": "autolistai.vercel.app",
  "industry": "vehicle_listings",
  "businessModel": "digital_download",
  "priceBand": "20_50",
  "considerationLevel": "utilitarian",
  "brandVoice": "straight-talk automotive",
  "primaryColor": "#111827",
  "accentColor": "#F97316",
  "fontDisplay": "Oswald",
  "fontBody": "Open Sans",
  "supportEmail": "care@autolistai.com",
  "product": {
    "id": "autolistai-pack",
    "slug": "autolistai-pack",
    "name": "AutoList Listing Optimization Pack",
    "tagline": "Vehicle listings miss trust signals and price justification.",
    "description": "Vehicle listing copy frameworks, photo checklists, disclosure language, and buyer Q&A scripts.",
    "priceUsd": 33,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "Listing copy by vehicle class",
      "Photo & detail checklist",
      "Disclosure language bank",
      "Buyer negotiation Q&A"
    ],
    "audience": "private sellers and small dealers listing cars online",
    "intentKeywords": [
      "how to write a car listing",
      "sell my car listing template",
      "vehicle listing photos checklist"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "how-to-write-a-car-listing",
      "title": "how to write a car listing",
      "intentQuery": "how to write a car listing",
      "body": "Vehicle listing copy frameworks, photo checklists, disclosure language, and buyer Q&A scripts.\n\nThis page targets: how to write a car listing"
    },
    {
      "slug": "sell-my-car-listing-template",
      "title": "sell my car listing template",
      "intentQuery": "sell my car listing template",
      "body": "Vehicle listing copy frameworks, photo checklists, disclosure language, and buyer Q&A scripts.\n\nThis page targets: sell my car listing template"
    },
    {
      "slug": "vehicle-listing-photos-checklist",
      "title": "vehicle listing photos checklist",
      "intentQuery": "vehicle listing photos checklist",
      "body": "Vehicle listing copy frameworks, photo checklists, disclosure language, and buyer Q&A scripts.\n\nThis page targets: vehicle listing photos checklist"
    }
  ],
  "sequenceIndex": 143
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
