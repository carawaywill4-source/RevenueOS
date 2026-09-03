import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:20:01.568Z */
export const BRAND: BrandConfig = {
  "siteId": "workgraph",
  "displayName": "WorkGraph",
  "domain": "workgraph.vercel.app",
  "industry": "work_graph",
  "businessModel": "digital_download",
  "priceBand": "50_100",
  "considerationLevel": "utilitarian",
  "brandVoice": "org-design practical",
  "primaryColor": "#10002B",
  "accentColor": "#C77DFF",
  "fontDisplay": "Sora",
  "fontBody": "Sora",
  "supportEmail": "care@workgraph.com",
  "product": {
    "id": "workgraph-pack",
    "slug": "workgraph-pack",
    "name": "WorkGraph Ownership Wedge",
    "tagline": "Work ownership is unclear across SaaS sprawl.",
    "description": "Role–system ownership map and decision-rights worksheet to start a work graph.",
    "priceUsd": 64,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "Role–system ownership map",
      "Decision-rights worksheet",
      "Handoff failure log",
      "Tool sprawl inventory"
    ],
    "audience": "ops leads mapping who-does-what across tools",
    "intentKeywords": [
      "raci template for saas tools",
      "ownership map operations",
      "tool sprawl inventory"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "raci-template-for-saas-tools",
      "title": "raci template for saas tools",
      "intentQuery": "raci template for saas tools",
      "body": "Role–system ownership map and decision-rights worksheet to start a work graph.\n\nThis page targets: raci template for saas tools"
    },
    {
      "slug": "ownership-map-operations",
      "title": "ownership map operations",
      "intentQuery": "ownership map operations",
      "body": "Role–system ownership map and decision-rights worksheet to start a work graph.\n\nThis page targets: ownership map operations"
    },
    {
      "slug": "tool-sprawl-inventory",
      "title": "tool sprawl inventory",
      "intentQuery": "tool sprawl inventory",
      "body": "Role–system ownership map and decision-rights worksheet to start a work graph.\n\nThis page targets: tool sprawl inventory"
    }
  ],
  "sequenceIndex": 148
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
