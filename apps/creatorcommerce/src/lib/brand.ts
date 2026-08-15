import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:20:01.640Z */
export const BRAND: BrandConfig = {
  "siteId": "creatorcommerce",
  "displayName": "CreatorCommerce",
  "domain": "creatorcommerce.vercel.app",
  "industry": "creator_commerce",
  "businessModel": "digital_download",
  "priceBand": "50_100",
  "considerationLevel": "utilitarian",
  "brandVoice": "creator-commercial honest",
  "primaryColor": "#240046",
  "accentColor": "#FF9E00",
  "fontDisplay": "Syne",
  "fontBody": "Outfit",
  "supportEmail": "care@creatorcommerce.com",
  "product": {
    "id": "creatorcommerce-pack",
    "slug": "creatorcommerce-pack",
    "name": "CreatorCommerce Offer Wedge",
    "tagline": "Creators lack a productized offer system.",
    "description": "Offer ladder design, digital product launch checklist, and audience-to-checkout path for creators.",
    "priceUsd": 57,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "Offer ladder canvas",
      "Digital product launch checklist",
      "Audience-to-checkout path",
      "Pricing experiment sheet"
    ],
    "audience": "creators monetizing beyond ads",
    "intentKeywords": [
      "creator digital product launch",
      "creator offer ladder",
      "monetize audience checklist"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "creator-digital-product-launch",
      "title": "creator digital product launch",
      "intentQuery": "creator digital product launch",
      "body": "Offer ladder design, digital product launch checklist, and audience-to-checkout path for creators.\n\nThis page targets: creator digital product launch"
    },
    {
      "slug": "creator-offer-ladder",
      "title": "creator offer ladder",
      "intentQuery": "creator offer ladder",
      "body": "Offer ladder design, digital product launch checklist, and audience-to-checkout path for creators.\n\nThis page targets: creator offer ladder"
    },
    {
      "slug": "monetize-audience-checklist",
      "title": "monetize audience checklist",
      "intentQuery": "monetize audience checklist",
      "body": "Offer ladder design, digital product launch checklist, and audience-to-checkout path for creators.\n\nThis page targets: monetize audience checklist"
    }
  ],
  "sequenceIndex": 100
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
