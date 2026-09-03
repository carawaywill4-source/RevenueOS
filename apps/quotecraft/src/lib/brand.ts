import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:26:58.276Z */
export const BRAND: BrandConfig = {
  "siteId": "quotecraft",
  "displayName": "QuoteCraft",
  "domain": "quotecraft.vercel.app",
  "industry": "smb_quotes",
  "businessModel": "digital_download",
  "priceBand": "20_50",
  "considerationLevel": "utilitarian",
  "brandVoice": "clean, local-business confident",
  "primaryColor": "#243010",
  "accentColor": "#F0A202",
  "fontDisplay": "DM Serif Display",
  "fontBody": "DM Sans",
  "supportEmail": "care@quotecraft.com",
  "product": {
    "id": "quotecraft-pack",
    "slug": "quotecraft-pack",
    "name": "QuoteCraft Branded Quote Pack",
    "tagline": "Quotes look unprofessional and lose deals to polished competitors.",
    "description": "Brandable quote and mini-proposal templates for service SMBs with pricing tables, terms, and follow-ups.",
    "priceUsd": 39,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "Brandable quote PDF/Doc templates",
      "Tiered pricing table layouts",
      "Terms & deposit language",
      "Win-back follow-up scripts"
    ],
    "audience": "local SMBs sending messy quotes from Word/Docs",
    "intentKeywords": [
      "business quote template",
      "service proposal template small business",
      "branded estimate template"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "business-quote-template",
      "title": "business quote template",
      "intentQuery": "business quote template",
      "body": "Brandable quote and mini-proposal templates for service SMBs with pricing tables, terms, and follow-ups.\n\nThis page targets: business quote template"
    },
    {
      "slug": "service-proposal-template-small-business",
      "title": "service proposal template small business",
      "intentQuery": "service proposal template small business",
      "body": "Brandable quote and mini-proposal templates for service SMBs with pricing tables, terms, and follow-ups.\n\nThis page targets: service proposal template small business"
    },
    {
      "slug": "branded-estimate-template",
      "title": "branded estimate template",
      "intentQuery": "branded estimate template",
      "body": "Brandable quote and mini-proposal templates for service SMBs with pricing tables, terms, and follow-ups.\n\nThis page targets: branded estimate template"
    }
  ],
  "sequenceIndex": 102
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
