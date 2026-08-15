import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:28:26.012Z */
export const BRAND: BrandConfig = {
  "siteId": "leadreply",
  "displayName": "LeadReply",
  "domain": "leadreply.vercel.app",
  "industry": "lead_response",
  "businessModel": "digital_download",
  "priceBand": "20_50",
  "considerationLevel": "utilitarian",
  "brandVoice": "fast, sales-practical",
  "primaryColor": "#141414",
  "accentColor": "#2EC4B6",
  "fontDisplay": "Space Grotesk",
  "fontBody": "Inter",
  "supportEmail": "care@leadreply.com",
  "product": {
    "id": "leadreply-pack",
    "slug": "leadreply-pack",
    "name": "LeadReply Speed Pack",
    "tagline": "Slow, generic lead replies kill conversion in the first hour.",
    "description": "First-response scripts, qualification questions, and channel-specific reply templates for inbound leads.",
    "priceUsd": 29,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "5-minute first-response scripts",
      "Qualification question banks",
      "SMS + email variants",
      "No-show recovery messages"
    ],
    "audience": "sales reps and owners drowning in inbound form leads",
    "intentKeywords": [
      "lead response templates",
      "inbound lead follow up script",
      "speed to lead email"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "lead-response-templates",
      "title": "lead response templates",
      "intentQuery": "lead response templates",
      "body": "First-response scripts, qualification questions, and channel-specific reply templates for inbound leads.\n\nThis page targets: lead response templates"
    },
    {
      "slug": "inbound-lead-follow-up-script",
      "title": "inbound lead follow up script",
      "intentQuery": "inbound lead follow up script",
      "body": "First-response scripts, qualification questions, and channel-specific reply templates for inbound leads.\n\nThis page targets: inbound lead follow up script"
    },
    {
      "slug": "speed-to-lead-email",
      "title": "speed to lead email",
      "intentQuery": "speed to lead email",
      "body": "First-response scripts, qualification questions, and channel-specific reply templates for inbound leads.\n\nThis page targets: speed to lead email"
    }
  ],
  "sequenceIndex": 134
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
