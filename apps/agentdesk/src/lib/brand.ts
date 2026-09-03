import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:20:01.358Z */
export const BRAND: BrandConfig = {
  "siteId": "agentdesk",
  "displayName": "AgentDesk",
  "domain": "agentdesk.vercel.app",
  "industry": "agent_productivity_platform",
  "businessModel": "digital_download",
  "priceBand": "50_100",
  "considerationLevel": "utilitarian",
  "brandVoice": "agent-efficiency polished",
  "primaryColor": "#2D132C",
  "accentColor": "#EEA243",
  "fontDisplay": "Playfair Display",
  "fontBody": "Source Sans 3",
  "supportEmail": "care@agentdesk.com",
  "product": {
    "id": "agentdesk-pack",
    "slug": "agentdesk-pack",
    "name": "AgentDesk Transaction Wedge",
    "tagline": "Transaction admin steals selling time without a lightweight system.",
    "description": "Transaction checklist OS starter: listing-to-close tasks, client updates, and document trackers.",
    "priceUsd": 69,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "Listing-to-close checklist",
      "Client update cadence",
      "Document tracker",
      "Vendor handoff sheet"
    ],
    "audience": "producing realtors drowning in admin between showings",
    "intentKeywords": [
      "real estate transaction checklist",
      "realtor admin system",
      "listing to close tracker"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "real-estate-transaction-checklist",
      "title": "real estate transaction checklist",
      "intentQuery": "real estate transaction checklist",
      "body": "Transaction checklist OS starter: listing-to-close tasks, client updates, and document trackers.\n\nThis page targets: real estate transaction checklist"
    },
    {
      "slug": "realtor-admin-system",
      "title": "realtor admin system",
      "intentQuery": "realtor admin system",
      "body": "Transaction checklist OS starter: listing-to-close tasks, client updates, and document trackers.\n\nThis page targets: realtor admin system"
    },
    {
      "slug": "listing-to-close-tracker",
      "title": "listing to close tracker",
      "intentQuery": "listing to close tracker",
      "body": "Transaction checklist OS starter: listing-to-close tasks, client updates, and document trackers.\n\nThis page targets: listing to close tracker"
    }
  ],
  "sequenceIndex": 144
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
