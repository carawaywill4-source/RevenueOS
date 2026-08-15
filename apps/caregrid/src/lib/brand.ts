import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:20:01.403Z */
export const BRAND: BrandConfig = {
  "siteId": "caregrid",
  "displayName": "CareGrid",
  "domain": "caregrid.vercel.app",
  "industry": "care_coordination",
  "businessModel": "digital_download",
  "priceBand": "50_100",
  "considerationLevel": "utilitarian",
  "brandVoice": "clinical-calm ops",
  "primaryColor": "#1D3557",
  "accentColor": "#A8DADC",
  "fontDisplay": "Literata",
  "fontBody": "Source Sans 3",
  "supportEmail": "care@caregrid.com",
  "product": {
    "id": "caregrid-pack",
    "slug": "caregrid-pack",
    "name": "CareGrid Front-Office Wedge",
    "tagline": "Front-office care coordination is ad hoc and complaint-prone.",
    "description": "Non-clinical care coordination pack: intake clarity, wait communication, and referral handoff checklists.",
    "priceUsd": 75,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "Intake clarity checklist",
      "Wait communication scripts",
      "Referral handoff sheet",
      "Complaint recovery path"
    ],
    "audience": "clinic ops leads reducing patient friction (non-clinical)",
    "intentKeywords": [
      "patient intake checklist",
      "clinic wait time communication",
      "referral handoff template"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "patient-intake-checklist",
      "title": "patient intake checklist",
      "intentQuery": "patient intake checklist",
      "body": "Non-clinical care coordination pack: intake clarity, wait communication, and referral handoff checklists.\n\nThis page targets: patient intake checklist"
    },
    {
      "slug": "clinic-wait-time-communication",
      "title": "clinic wait time communication",
      "intentQuery": "clinic wait time communication",
      "body": "Non-clinical care coordination pack: intake clarity, wait communication, and referral handoff checklists.\n\nThis page targets: clinic wait time communication"
    },
    {
      "slug": "referral-handoff-template",
      "title": "referral handoff template",
      "intentQuery": "referral handoff template",
      "body": "Non-clinical care coordination pack: intake clarity, wait communication, and referral handoff checklists.\n\nThis page targets: referral handoff template"
    }
  ],
  "sequenceIndex": 114
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
