import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:20:01.305Z */
export const BRAND: BrandConfig = {
  "siteId": "openhousekit",
  "displayName": "OpenHouseKit",
  "domain": "openhousekit.vercel.app",
  "industry": "open_house_marketing",
  "businessModel": "digital_download",
  "priceBand": "20_50",
  "considerationLevel": "utilitarian",
  "brandVoice": "agent-field practical",
  "primaryColor": "#3E1F47",
  "accentColor": "#E0C097",
  "fontDisplay": "Cardo",
  "fontBody": "Raleway",
  "supportEmail": "care@openhousekit.com",
  "product": {
    "id": "openhousekit-pack",
    "slug": "openhousekit-pack",
    "name": "OpenHouseKit Marketing Pack",
    "tagline": "Open houses lack a promotion system beyond a yard sign.",
    "description": "Open-house promotion timelines, sign-in flows, neighbor invites, and follow-up sequences.",
    "priceUsd": 45,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "72-hour promo timeline",
      "Sign-in & qualifying sheet",
      "Neighbor invite scripts",
      "Post-open-house follow-ups"
    ],
    "audience": "realtors running weekend open houses",
    "intentKeywords": [
      "open house marketing plan",
      "open house follow up email",
      "realtor open house checklist"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "open-house-marketing-plan",
      "title": "open house marketing plan",
      "intentQuery": "open house marketing plan",
      "body": "Open-house promotion timelines, sign-in flows, neighbor invites, and follow-up sequences.\n\nThis page targets: open house marketing plan"
    },
    {
      "slug": "open-house-follow-up-email",
      "title": "open house follow up email",
      "intentQuery": "open house follow up email",
      "body": "Open-house promotion timelines, sign-in flows, neighbor invites, and follow-up sequences.\n\nThis page targets: open house follow up email"
    },
    {
      "slug": "realtor-open-house-checklist",
      "title": "realtor open house checklist",
      "intentQuery": "realtor open house checklist",
      "body": "Open-house promotion timelines, sign-in flows, neighbor invites, and follow-up sequences.\n\nThis page targets: realtor open house checklist"
    }
  ],
  "sequenceIndex": 104
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
