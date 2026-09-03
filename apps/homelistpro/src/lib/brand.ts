import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:45:27.519Z */
export const BRAND: BrandConfig = {
  "siteId": "homelistpro",
  "displayName": "HomeList Pro",
  "domain": "homelistpro.vercel.app",
  "industry": "real_estate_listing_marketing",
  "businessModel": "digital_download",
  "priceBand": "50_100",
  "considerationLevel": "utilitarian",
  "brandVoice": "polished agent-professional",
  "primaryColor": "#2C1A4D",
  "accentColor": "#C9A227",
  "fontDisplay": "Cormorant",
  "fontBody": "Lato",
  "supportEmail": "care@homelistpro.com",
  "product": {
    "id": "homelistpro-pack",
    "slug": "homelistpro-pack",
    "name": "HomeList Pro Launch Kit",
    "tagline": "Listing launches lack a repeatable marketing kit.",
    "description": "Listing launch timeline, social/email copy, open-house assets, and seller update templates for realtors.",
    "priceUsd": 59,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "7-day listing launch timeline",
      "Social + email copy blocks",
      "Seller update cadence",
      "Flyer & just-listed scripts"
    ],
    "audience": "solo agents marketing new listings fast",
    "intentKeywords": [
      "real estate listing marketing plan",
      "just listed social media templates",
      "listing launch checklist"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "real-estate-listing-marketing-plan",
      "title": "real estate listing marketing plan",
      "intentQuery": "real estate listing marketing plan",
      "body": "Listing launch timeline, social/email copy, open-house assets, and seller update templates for realtors.\n\nThis page targets: real estate listing marketing plan"
    },
    {
      "slug": "just-listed-social-media-templates",
      "title": "just listed social media templates",
      "intentQuery": "just listed social media templates",
      "body": "Listing launch timeline, social/email copy, open-house assets, and seller update templates for realtors.\n\nThis page targets: just listed social media templates"
    },
    {
      "slug": "listing-launch-checklist",
      "title": "listing launch checklist",
      "intentQuery": "listing launch checklist",
      "body": "Listing launch timeline, social/email copy, open-house assets, and seller update templates for realtors.\n\nThis page targets: listing launch checklist"
    }
  ],
  "sequenceIndex": 132
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
