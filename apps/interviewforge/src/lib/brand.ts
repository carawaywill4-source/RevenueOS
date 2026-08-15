import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:20:01.225Z */
export const BRAND: BrandConfig = {
  "siteId": "interviewforge",
  "displayName": "InterviewForge",
  "domain": "interviewforge.vercel.app",
  "industry": "interview_prep",
  "businessModel": "digital_download",
  "priceBand": "20_50",
  "considerationLevel": "utilitarian",
  "brandVoice": "coach-calm, rigorous",
  "primaryColor": "#22223B",
  "accentColor": "#9A8C98",
  "fontDisplay": "Spectral",
  "fontBody": "Mulish",
  "supportEmail": "care@interviewforge.com",
  "product": {
    "id": "interviewforge-pack",
    "slug": "interviewforge-pack",
    "name": "InterviewForge Prep Pack",
    "tagline": "Interview prep is generic and forgets company-specific angles.",
    "description": "STAR story banks, company-research worksheets, and closing question libraries for interview prep.",
    "priceUsd": 35,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "STAR story workbook",
      "Company research worksheet",
      "Role-specific question drills",
      "Thank-you & follow-up scripts"
    ],
    "audience": "candidates preparing for behavioral/technical interviews",
    "intentKeywords": [
      "behavioral interview star examples",
      "interview prep worksheet",
      "company research interview"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "behavioral-interview-star-examples",
      "title": "behavioral interview star examples",
      "intentQuery": "behavioral interview star examples",
      "body": "STAR story banks, company-research worksheets, and closing question libraries for interview prep.\n\nThis page targets: behavioral interview star examples"
    },
    {
      "slug": "interview-prep-worksheet",
      "title": "interview prep worksheet",
      "intentQuery": "interview prep worksheet",
      "body": "STAR story banks, company-research worksheets, and closing question libraries for interview prep.\n\nThis page targets: interview prep worksheet"
    },
    {
      "slug": "company-research-interview",
      "title": "company research interview",
      "intentQuery": "company research interview",
      "body": "STAR story banks, company-research worksheets, and closing question libraries for interview prep.\n\nThis page targets: company research interview"
    }
  ],
  "sequenceIndex": 131
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
