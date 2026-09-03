import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:20:01.464Z */
export const BRAND: BrandConfig = {
  "siteId": "fleetbrain",
  "displayName": "FleetBrain",
  "domain": "fleetbrain.vercel.app",
  "industry": "fleet_operations",
  "businessModel": "digital_download",
  "priceBand": "50_100",
  "considerationLevel": "utilitarian",
  "brandVoice": "fleet-ops analytical",
  "primaryColor": "#0B132B",
  "accentColor": "#5BC0BE",
  "fontDisplay": "IBM Plex Sans",
  "fontBody": "IBM Plex Sans",
  "supportEmail": "care@fleetbrain.com",
  "product": {
    "id": "fleetbrain-pack",
    "slug": "fleetbrain-pack",
    "name": "FleetBrain Utilization Wedge",
    "tagline": "Maintenance and utilization decisions are reactive.",
    "description": "Fleet utilization scorecards, preventive maintenance calendars, and driver issue logs.",
    "priceUsd": 95,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "Utilization scorecard",
      "PM calendar",
      "Driver issue log",
      "Replacement decision sheet"
    ],
    "audience": "ops managers of small commercial fleets",
    "intentKeywords": [
      "fleet utilization KPI",
      "preventive maintenance calendar fleet",
      "small fleet management checklist"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "fleet-utilization-kpi",
      "title": "fleet utilization KPI",
      "intentQuery": "fleet utilization KPI",
      "body": "Fleet utilization scorecards, preventive maintenance calendars, and driver issue logs.\n\nThis page targets: fleet utilization KPI"
    },
    {
      "slug": "preventive-maintenance-calendar-fleet",
      "title": "preventive maintenance calendar fleet",
      "intentQuery": "preventive maintenance calendar fleet",
      "body": "Fleet utilization scorecards, preventive maintenance calendars, and driver issue logs.\n\nThis page targets: preventive maintenance calendar fleet"
    },
    {
      "slug": "small-fleet-management-checklist",
      "title": "small fleet management checklist",
      "intentQuery": "small fleet management checklist",
      "body": "Fleet utilization scorecards, preventive maintenance calendars, and driver issue logs.\n\nThis page targets: small fleet management checklist"
    }
  ],
  "sequenceIndex": 103
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
