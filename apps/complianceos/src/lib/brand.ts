import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:20:01.504Z */
export const BRAND: BrandConfig = {
  "siteId": "complianceos",
  "displayName": "ComplianceOS",
  "domain": "complianceos.vercel.app",
  "industry": "compliance_operations",
  "businessModel": "digital_download",
  "priceBand": "50_100",
  "considerationLevel": "utilitarian",
  "brandVoice": "compliance-clear, non-legal-advice",
  "primaryColor": "#1C2541",
  "accentColor": "#5C6B73",
  "fontDisplay": "Source Serif 4",
  "fontBody": "Source Sans 3",
  "supportEmail": "care@complianceos.com",
  "product": {
    "id": "complianceos-pack",
    "slug": "complianceos-pack",
    "name": "ComplianceOS Evidence Wedge",
    "tagline": "Compliance evidence is scrambled across folders before audits.",
    "description": "Evidence binder structure, control owners matrix, and audit request response templates.",
    "priceUsd": 99,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "Evidence binder structure",
      "Control owners matrix",
      "Audit request response kit",
      "Policy review calendar"
    ],
    "audience": "ops leads facing recurring policy/evidence requests",
    "intentKeywords": [
      "compliance evidence binder",
      "audit request response template",
      "control owner matrix"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "compliance-evidence-binder",
      "title": "compliance evidence binder",
      "intentQuery": "compliance evidence binder",
      "body": "Evidence binder structure, control owners matrix, and audit request response templates.\n\nThis page targets: compliance evidence binder"
    },
    {
      "slug": "audit-request-response-template",
      "title": "audit request response template",
      "intentQuery": "audit request response template",
      "body": "Evidence binder structure, control owners matrix, and audit request response templates.\n\nThis page targets: audit request response template"
    },
    {
      "slug": "control-owner-matrix",
      "title": "control owner matrix",
      "intentQuery": "control owner matrix",
      "body": "Evidence binder structure, control owners matrix, and audit request response templates.\n\nThis page targets: control owner matrix"
    }
  ],
  "sequenceIndex": 115
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
