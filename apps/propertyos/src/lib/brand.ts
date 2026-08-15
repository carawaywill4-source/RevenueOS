import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:20:01.413Z */
export const BRAND: BrandConfig = {
  "siteId": "propertyos",
  "displayName": "PropertyOS",
  "domain": "propertyos.vercel.app",
  "industry": "property_operations",
  "businessModel": "digital_download",
  "priceBand": "50_100",
  "considerationLevel": "utilitarian",
  "brandVoice": "property-ops grounded",
  "primaryColor": "#2F3E46",
  "accentColor": "#84A98C",
  "fontDisplay": "Libre Baskerville",
  "fontBody": "Nunito Sans",
  "supportEmail": "care@propertyos.com",
  "product": {
    "id": "propertyos-pack",
    "slug": "propertyos-pack",
    "name": "PropertyOS Turn & Maintenance Wedge",
    "tagline": "Maintenance, turns, and tenant comms lack a single operating rhythm.",
    "description": "Unit turn checklist, maintenance triage, and tenant communication starters for property ops.",
    "priceUsd": 65,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "Unit turn checklist",
      "Maintenance triage matrix",
      "Tenant update templates",
      "Vendor scorecard"
    ],
    "audience": "small landlords and property managers",
    "intentKeywords": [
      "rental unit turn checklist",
      "property maintenance triage",
      "landlord tenant message templates"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "rental-unit-turn-checklist",
      "title": "rental unit turn checklist",
      "intentQuery": "rental unit turn checklist",
      "body": "Unit turn checklist, maintenance triage, and tenant communication starters for property ops.\n\nThis page targets: rental unit turn checklist"
    },
    {
      "slug": "property-maintenance-triage",
      "title": "property maintenance triage",
      "intentQuery": "property maintenance triage",
      "body": "Unit turn checklist, maintenance triage, and tenant communication starters for property ops.\n\nThis page targets: property maintenance triage"
    },
    {
      "slug": "landlord-tenant-message-templates",
      "title": "landlord tenant message templates",
      "intentQuery": "landlord tenant message templates",
      "body": "Unit turn checklist, maintenance triage, and tenant communication starters for property ops.\n\nThis page targets: landlord tenant message templates"
    }
  ],
  "sequenceIndex": 107
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
