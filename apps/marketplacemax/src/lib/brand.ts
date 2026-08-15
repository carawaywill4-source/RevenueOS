import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:48:12.998Z */
export const BRAND: BrandConfig = {
  "siteId": "marketplacemax",
  "displayName": "MarketplaceMax",
  "domain": "marketplacemax.vercel.app",
  "industry": "marketplace_listings",
  "businessModel": "digital_download",
  "priceBand": "20_50",
  "considerationLevel": "utilitarian",
  "brandVoice": "seller-operator, conversion sharp",
  "primaryColor": "#1D3557",
  "accentColor": "#E63946",
  "fontDisplay": "Archivo",
  "fontBody": "Archivo",
  "supportEmail": "care@marketplacemax.com",
  "product": {
    "id": "marketplacemax-pack",
    "slug": "marketplacemax-pack",
    "name": "MarketplaceMax Listing Pack",
    "tagline": "Listings bury benefits and lose the click-to-purchase path.",
    "description": "Title formulas, bullet frameworks, image briefs, and A+ style narrative for marketplace sellers.",
    "priceUsd": 41,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "Title & backend keyword worksheets",
      "Bullet benefit frameworks",
      "Image brief templates",
      "Competitor teardown sheet"
    ],
    "audience": "Etsy/eBay/Amazon sellers improving listing conversion",
    "intentKeywords": [
      "etsy listing optimization",
      "amazon bullet point template",
      "marketplace seo listing"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "etsy-listing-optimization",
      "title": "etsy listing optimization",
      "intentQuery": "etsy listing optimization",
      "body": "Title formulas, bullet frameworks, image briefs, and A+ style narrative for marketplace sellers.\n\nThis page targets: etsy listing optimization"
    },
    {
      "slug": "amazon-bullet-point-template",
      "title": "amazon bullet point template",
      "intentQuery": "amazon bullet point template",
      "body": "Title formulas, bullet frameworks, image briefs, and A+ style narrative for marketplace sellers.\n\nThis page targets: amazon bullet point template"
    },
    {
      "slug": "marketplace-seo-listing",
      "title": "marketplace seo listing",
      "intentQuery": "marketplace seo listing",
      "body": "Title formulas, bullet frameworks, image briefs, and A+ style narrative for marketplace sellers.\n\nThis page targets: marketplace seo listing"
    }
  ],
  "sequenceIndex": 146
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
