import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:20:01.600Z */
export const BRAND: BrandConfig = {
  "siteId": "recommerce",
  "displayName": "ReCommerce",
  "domain": "recommerce.vercel.app",
  "industry": "recommerce_ops",
  "businessModel": "digital_download",
  "priceBand": "50_100",
  "considerationLevel": "utilitarian",
  "brandVoice": "resale-ops sharp",
  "primaryColor": "#2D6A4F",
  "accentColor": "#B7E4C7",
  "fontDisplay": "Josefin Sans",
  "fontBody": "Nunito",
  "supportEmail": "care@recommerce.com",
  "product": {
    "id": "recommerce-pack",
    "slug": "recommerce-pack",
    "name": "ReCommerce Intake Wedge",
    "tagline": "Intake grading and pricing are inconsistent, killing margin.",
    "description": "Intake grading rubric, pricing bands, and listing QA for recommerce operators.",
    "priceUsd": 67,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "Grading rubric",
      "Pricing band sheet",
      "Listing QA checklist",
      "Refurb decision tree"
    ],
    "audience": "resale/refurb operators scaling intake",
    "intentKeywords": [
      "resale grading rubric",
      "recommerce pricing template",
      "refurbish or sell decision"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "resale-grading-rubric",
      "title": "resale grading rubric",
      "intentQuery": "resale grading rubric",
      "body": "Intake grading rubric, pricing bands, and listing QA for recommerce operators.\n\nThis page targets: resale grading rubric"
    },
    {
      "slug": "recommerce-pricing-template",
      "title": "recommerce pricing template",
      "intentQuery": "recommerce pricing template",
      "body": "Intake grading rubric, pricing bands, and listing QA for recommerce operators.\n\nThis page targets: recommerce pricing template"
    },
    {
      "slug": "refurbish-or-sell-decision",
      "title": "refurbish or sell decision",
      "intentQuery": "refurbish or sell decision",
      "body": "Intake grading rubric, pricing bands, and listing QA for recommerce operators.\n\nThis page targets: refurbish or sell decision"
    }
  ],
  "sequenceIndex": 134
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
