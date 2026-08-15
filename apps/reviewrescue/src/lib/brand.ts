import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:40:52.832Z */
export const BRAND: BrandConfig = {
  "siteId": "reviewrescue",
  "displayName": "ReviewRescue",
  "domain": "reviewrescue.vercel.app",
  "industry": "reputation_ops",
  "businessModel": "digital_download",
  "priceBand": "20_50",
  "considerationLevel": "utilitarian",
  "brandVoice": "empathetic, reputation-steady",
  "primaryColor": "#3D0C11",
  "accentColor": "#E07A5F",
  "fontDisplay": "Cormorant Garamond",
  "fontBody": "Karla",
  "supportEmail": "care@reviewrescue.com",
  "product": {
    "id": "reviewrescue-pack",
    "slug": "reviewrescue-pack",
    "name": "ReviewRescue Response Pack",
    "tagline": "Owners freeze on negative reviews or reply emotionally.",
    "description": "Tone-safe review response templates, escalation paths, and review-request cadences for local businesses.",
    "priceUsd": 27,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "Negative review reply frameworks",
      "Positive review amplifiers",
      "Private resolution scripts",
      "Review request cadence"
    ],
    "audience": "local businesses managing Google/Yelp reviews",
    "intentKeywords": [
      "how to respond to negative google review",
      "review response templates",
      "reputation management scripts"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "how-to-respond-to-negative-google-review",
      "title": "how to respond to negative google review",
      "intentQuery": "how to respond to negative google review",
      "body": "Tone-safe review response templates, escalation paths, and review-request cadences for local businesses.\n\nThis page targets: how to respond to negative google review"
    },
    {
      "slug": "review-response-templates",
      "title": "review response templates",
      "intentQuery": "review response templates",
      "body": "Tone-safe review response templates, escalation paths, and review-request cadences for local businesses.\n\nThis page targets: review response templates"
    },
    {
      "slug": "reputation-management-scripts",
      "title": "reputation management scripts",
      "intentQuery": "reputation management scripts",
      "body": "Tone-safe review response templates, escalation paths, and review-request cadences for local businesses.\n\nThis page targets: reputation management scripts"
    }
  ],
  "sequenceIndex": 106
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
