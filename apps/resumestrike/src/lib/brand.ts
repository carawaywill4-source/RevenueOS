import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:20:01.213Z */
export const BRAND: BrandConfig = {
  "siteId": "resumestrike",
  "displayName": "ResumeStrike",
  "domain": "resumestrike.vercel.app",
  "industry": "career_resume_ats",
  "businessModel": "digital_download",
  "priceBand": "20_50",
  "considerationLevel": "utilitarian",
  "brandVoice": "coach, plainspoken, results-first",
  "primaryColor": "#101820",
  "accentColor": "#FEE715",
  "fontDisplay": "Barlow",
  "fontBody": "Barlow",
  "supportEmail": "care@resumestrike.com",
  "product": {
    "id": "resumestrike-pack",
    "slug": "resumestrike-pack",
    "name": "ResumeStrike ATS Pack",
    "tagline": "Resumes are narrative-heavy and keyword-blind.",
    "description": "ATS-safe resume frameworks, keyword mapping worksheets, and role-target rewrite guides.",
    "priceUsd": 27,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "ATS-safe resume skeletons",
      "Keyword mapping worksheet",
      "Achievement bullet formulas",
      "Role-target rewrite checklist"
    ],
    "audience": "job seekers failing ATS screens",
    "intentKeywords": [
      "ats resume template",
      "resume keyword scanner tips",
      "rewrite resume for ats"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "ats-resume-template",
      "title": "ats resume template",
      "intentQuery": "ats resume template",
      "body": "ATS-safe resume frameworks, keyword mapping worksheets, and role-target rewrite guides.\n\nThis page targets: ats resume template"
    },
    {
      "slug": "resume-keyword-scanner-tips",
      "title": "resume keyword scanner tips",
      "intentQuery": "resume keyword scanner tips",
      "body": "ATS-safe resume frameworks, keyword mapping worksheets, and role-target rewrite guides.\n\nThis page targets: resume keyword scanner tips"
    },
    {
      "slug": "rewrite-resume-for-ats",
      "title": "rewrite resume for ats",
      "intentQuery": "rewrite resume for ats",
      "body": "ATS-safe resume frameworks, keyword mapping worksheets, and role-target rewrite guides.\n\nThis page targets: rewrite resume for ats"
    }
  ],
  "sequenceIndex": 137
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
