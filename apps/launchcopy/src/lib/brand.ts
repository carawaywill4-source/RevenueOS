import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:20:01.264Z */
export const BRAND: BrandConfig = {
  "siteId": "launchcopy",
  "displayName": "LaunchCopy",
  "domain": "launchcopy.vercel.app",
  "industry": "website_copy",
  "businessModel": "digital_download",
  "priceBand": "20_50",
  "considerationLevel": "utilitarian",
  "brandVoice": "clear commercial writer",
  "primaryColor": "#1A1A1A",
  "accentColor": "#FF6B35",
  "fontDisplay": "Libre Bodoni",
  "fontBody": "Schibsted Grotesk",
  "supportEmail": "care@launchcopy.com",
  "product": {
    "id": "launchcopy-pack",
    "slug": "launchcopy-pack",
    "name": "LaunchCopy Site Pack",
    "tagline": "Homepages explain features instead of buyer outcomes.",
    "description": "Homepage, pricing, and about-page copy frameworks with CTA variants for commercial sites.",
    "priceUsd": 49,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "Homepage narrative scaffold",
      "Pricing page copy blocks",
      "About page truth framework",
      "CTA variant library"
    ],
    "audience": "founders launching a site without a copywriter",
    "intentKeywords": [
      "homepage copy template",
      "saas website copy framework",
      "pricing page copy examples"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "homepage-copy-template",
      "title": "homepage copy template",
      "intentQuery": "homepage copy template",
      "body": "Homepage, pricing, and about-page copy frameworks with CTA variants for commercial sites.\n\nThis page targets: homepage copy template"
    },
    {
      "slug": "saas-website-copy-framework",
      "title": "saas website copy framework",
      "intentQuery": "saas website copy framework",
      "body": "Homepage, pricing, and about-page copy frameworks with CTA variants for commercial sites.\n\nThis page targets: saas website copy framework"
    },
    {
      "slug": "pricing-page-copy-examples",
      "title": "pricing page copy examples",
      "intentQuery": "pricing page copy examples",
      "body": "Homepage, pricing, and about-page copy frameworks with CTA variants for commercial sites.\n\nThis page targets: pricing page copy examples"
    }
  ],
  "sequenceIndex": 121
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
