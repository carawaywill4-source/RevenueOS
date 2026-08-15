import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:42:04.859Z */
export const BRAND: BrandConfig = {
  "siteId": "locallaunch",
  "displayName": "LocalLaunch",
  "domain": "locallaunch.vercel.app",
  "industry": "local_seo_profiles",
  "businessModel": "digital_download",
  "priceBand": "20_50",
  "considerationLevel": "utilitarian",
  "brandVoice": "local-growth practical",
  "primaryColor": "#1F3D2B",
  "accentColor": "#F4D35E",
  "fontDisplay": "Fraunces",
  "fontBody": "Source Sans 3",
  "supportEmail": "care@locallaunch.com",
  "product": {
    "id": "locallaunch-pack",
    "slug": "locallaunch-pack",
    "name": "LocalLaunch Profile Optimization Pack",
    "tagline": "Profiles are incomplete, inconsistent, and invisible in local pack.",
    "description": "GBP setup checklist, category strategy, photo briefs, and weekly posting prompts for local businesses.",
    "priceUsd": 35,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "GBP launch checklist",
      "Category & service menu guide",
      "Photo shot list",
      "12-week post prompts"
    ],
    "audience": "owners launching or fixing Google Business Profiles",
    "intentKeywords": [
      "google business profile checklist",
      "optimize google my business",
      "local seo profile tips"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "google-business-profile-checklist",
      "title": "google business profile checklist",
      "intentQuery": "google business profile checklist",
      "body": "GBP setup checklist, category strategy, photo briefs, and weekly posting prompts for local businesses.\n\nThis page targets: google business profile checklist"
    },
    {
      "slug": "optimize-google-my-business",
      "title": "optimize google my business",
      "intentQuery": "optimize google my business",
      "body": "GBP setup checklist, category strategy, photo briefs, and weekly posting prompts for local businesses.\n\nThis page targets: optimize google my business"
    },
    {
      "slug": "local-seo-profile-tips",
      "title": "local seo profile tips",
      "intentQuery": "local seo profile tips",
      "body": "GBP setup checklist, category strategy, photo briefs, and weekly posting prompts for local businesses.\n\nThis page targets: local seo profile tips"
    }
  ],
  "sequenceIndex": 116
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
