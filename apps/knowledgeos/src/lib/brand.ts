import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:20:01.660Z */
export const BRAND: BrandConfig = {
  "siteId": "knowledgeos",
  "displayName": "KnowledgeOS",
  "domain": "knowledgeos.vercel.app",
  "industry": "knowledge_operations",
  "businessModel": "digital_download",
  "priceBand": "50_100",
  "considerationLevel": "utilitarian",
  "brandVoice": "knowledge-ops disciplined",
  "primaryColor": "#1A1A2E",
  "accentColor": "#E94560",
  "fontDisplay": "IBM Plex Serif",
  "fontBody": "IBM Plex Sans",
  "supportEmail": "care@knowledgeos.com",
  "product": {
    "id": "knowledgeos-pack",
    "slug": "knowledgeos-pack",
    "name": "KnowledgeOS Freshness Wedge",
    "tagline": "Knowledge bases rot because ownership and freshness rituals are missing.",
    "description": "Knowledge ownership matrix, freshness SLAs, and page lifecycle templates.",
    "priceUsd": 58,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "Ownership matrix",
      "Freshness SLA",
      "Page lifecycle template",
      "Search fail log"
    ],
    "audience": "teams whose wiki is stale and unused",
    "intentKeywords": [
      "knowledge base ownership matrix",
      "documentation freshness sla",
      "wiki lifecycle template"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "knowledge-base-ownership-matrix",
      "title": "knowledge base ownership matrix",
      "intentQuery": "knowledge base ownership matrix",
      "body": "Knowledge ownership matrix, freshness SLAs, and page lifecycle templates.\n\nThis page targets: knowledge base ownership matrix"
    },
    {
      "slug": "documentation-freshness-sla",
      "title": "documentation freshness sla",
      "intentQuery": "documentation freshness sla",
      "body": "Knowledge ownership matrix, freshness SLAs, and page lifecycle templates.\n\nThis page targets: documentation freshness sla"
    },
    {
      "slug": "wiki-lifecycle-template",
      "title": "wiki lifecycle template",
      "intentQuery": "wiki lifecycle template",
      "body": "Knowledge ownership matrix, freshness SLAs, and page lifecycle templates.\n\nThis page targets: wiki lifecycle template"
    }
  ],
  "sequenceIndex": 137
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
