import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:22:48.356Z */
export const BRAND: BrandConfig = {
  "siteId": "bidforge",
  "displayName": "BidForge",
  "domain": "bidforge.vercel.app",
  "industry": "contractor_estimates",
  "businessModel": "digital_download",
  "priceBand": "20_50",
  "considerationLevel": "utilitarian",
  "brandVoice": "no-nonsense contractor, clear numbers",
  "primaryColor": "#1A2332",
  "accentColor": "#E8A317",
  "fontDisplay": "IBM Plex Serif",
  "fontBody": "IBM Plex Sans",
  "supportEmail": "care@bidforge.com",
  "product": {
    "id": "bidforge-pack",
    "slug": "bidforge-pack",
    "name": "BidForge Estimate & Proposal Pack",
    "tagline": "Estimates are rebuilt from scratch each job, losing margin and looking unprofessional.",
    "description": "Branded estimate templates, scope assumptions, allowance schedules, and client-ready proposal pages for contractors — instant download.",
    "priceUsd": 49,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "Estimate workbook with labor/material/mark-up structure",
      "Client proposal narrative templates",
      "Change-order addendum language",
      "Follow-up email sequences after bid send"
    ],
    "audience": "residential GCs and specialty trades writing bids under time pressure",
    "intentKeywords": [
      "contractor estimate template",
      "construction proposal template",
      "bid proposal pack"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "contractor-estimate-template",
      "title": "contractor estimate template",
      "intentQuery": "contractor estimate template",
      "body": "Branded estimate templates, scope assumptions, allowance schedules, and client-ready proposal pages for contractors — instant download.\n\nThis page targets: contractor estimate template"
    },
    {
      "slug": "construction-proposal-template",
      "title": "construction proposal template",
      "intentQuery": "construction proposal template",
      "body": "Branded estimate templates, scope assumptions, allowance schedules, and client-ready proposal pages for contractors — instant download.\n\nThis page targets: construction proposal template"
    },
    {
      "slug": "bid-proposal-pack",
      "title": "bid proposal pack",
      "intentQuery": "bid proposal pack",
      "body": "Branded estimate templates, scope assumptions, allowance schedules, and client-ready proposal pages for contractors — instant download.\n\nThis page targets: bid proposal pack"
    }
  ],
  "sequenceIndex": 123
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
