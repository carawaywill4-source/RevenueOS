import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:20:01.294Z */
export const BRAND: BrandConfig = {
  "siteId": "videobrief",
  "displayName": "VideoBrief",
  "domain": "videobrief.vercel.app",
  "industry": "short_form_video",
  "businessModel": "digital_download",
  "priceBand": "20_50",
  "considerationLevel": "utilitarian",
  "brandVoice": "production-practical",
  "primaryColor": "#0F0F0F",
  "accentColor": "#FF2E63",
  "fontDisplay": "Bebas Neue",
  "fontBody": "Helvetica Neue",
  "supportEmail": "care@videobrief.com",
  "product": {
    "id": "videobrief-pack",
    "slug": "videobrief-pack",
    "name": "VideoBrief Short-Form Pack",
    "tagline": "Video briefs are vague; editors guess the hook.",
    "description": "Shot briefs, hook scripts, and platform-native CTA patterns for short-form campaigns.",
    "priceUsd": 43,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "Hook script templates",
      "Shot brief sheets",
      "Platform CTA patterns",
      "Batch filming checklist"
    ],
    "audience": "brands and creators briefing short-form video",
    "intentKeywords": [
      "short form video script template",
      "tiktok brief template",
      "reels content brief"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "short-form-video-script-template",
      "title": "short form video script template",
      "intentQuery": "short form video script template",
      "body": "Shot briefs, hook scripts, and platform-native CTA patterns for short-form campaigns.\n\nThis page targets: short form video script template"
    },
    {
      "slug": "tiktok-brief-template",
      "title": "tiktok brief template",
      "intentQuery": "tiktok brief template",
      "body": "Shot briefs, hook scripts, and platform-native CTA patterns for short-form campaigns.\n\nThis page targets: tiktok brief template"
    },
    {
      "slug": "reels-content-brief",
      "title": "reels content brief",
      "intentQuery": "reels content brief",
      "body": "Shot briefs, hook scripts, and platform-native CTA patterns for short-form campaigns.\n\nThis page targets: reels content brief"
    }
  ],
  "sequenceIndex": 105
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
