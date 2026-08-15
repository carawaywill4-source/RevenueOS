import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:20:01.702Z */
export const BRAND: BrandConfig = {
  "siteId": "businessgraph",
  "displayName": "BusinessGraph",
  "domain": "businessgraph.vercel.app",
  "industry": "business_graph",
  "businessModel": "digital_download",
  "priceBand": "50_100",
  "considerationLevel": "utilitarian",
  "brandVoice": "operator-strategic",
  "primaryColor": "#10002B",
  "accentColor": "#7B2CBF",
  "fontDisplay": "Instrument Serif",
  "fontBody": "Instrument Sans",
  "supportEmail": "care@businessgraph.com",
  "product": {
    "id": "businessgraph-pack",
    "slug": "businessgraph-pack",
    "name": "BusinessGraph Relationship Wedge",
    "tagline": "Relationship knowledge walks out with people; no durable business graph.",
    "description": "Company relationship mapping worksheets and account history rituals to start a business graph.",
    "priceUsd": 77,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "Relationship map canvas",
      "Account history ritual",
      "Influence map",
      "Risk concentration sheet"
    ],
    "audience": "operators mapping company relationships (customers, vendors, partners)",
    "intentKeywords": [
      "business relationship map",
      "account history template",
      "customer influence mapping"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "business-relationship-map",
      "title": "business relationship map",
      "intentQuery": "business relationship map",
      "body": "Company relationship mapping worksheets and account history rituals to start a business graph.\n\nThis page targets: business relationship map"
    },
    {
      "slug": "account-history-template",
      "title": "account history template",
      "intentQuery": "account history template",
      "body": "Company relationship mapping worksheets and account history rituals to start a business graph.\n\nThis page targets: account history template"
    },
    {
      "slug": "customer-influence-mapping",
      "title": "customer influence mapping",
      "intentQuery": "customer influence mapping",
      "body": "Company relationship mapping worksheets and account history rituals to start a business graph.\n\nThis page targets: customer influence mapping"
    }
  ],
  "sequenceIndex": 140
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
