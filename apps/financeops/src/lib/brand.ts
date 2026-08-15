import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:20:01.671Z */
export const BRAND: BrandConfig = {
  "siteId": "financeops",
  "displayName": "FinanceOps",
  "domain": "financeops.vercel.app",
  "industry": "finance_operations",
  "businessModel": "digital_download",
  "priceBand": "50_100",
  "considerationLevel": "utilitarian",
  "brandVoice": "finance-ops exacting",
  "primaryColor": "#0B3C5D",
  "accentColor": "#D9B310",
  "fontDisplay": "Source Serif 4",
  "fontBody": "Source Sans 3",
  "supportEmail": "care@financeops.com",
  "product": {
    "id": "financeops-pack",
    "slug": "financeops-pack",
    "name": "FinanceOps Close Wedge",
    "tagline": "Month-end is heroic instead of ritualized.",
    "description": "Month-end close checklist, accrual log, and cash forecast rhythm for lean finance teams.",
    "priceUsd": 82,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "Month-end close checklist",
      "Accrual log",
      "13-week cash rhythm",
      "AP/AR aging ritual"
    ],
    "audience": "startup finance leads closing books without full team",
    "intentKeywords": [
      "month end close checklist startup",
      "13 week cash flow template",
      "accrual log template"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "month-end-close-checklist-startup",
      "title": "month end close checklist startup",
      "intentQuery": "month end close checklist startup",
      "body": "Month-end close checklist, accrual log, and cash forecast rhythm for lean finance teams.\n\nThis page targets: month end close checklist startup"
    },
    {
      "slug": "13-week-cash-flow-template",
      "title": "13 week cash flow template",
      "intentQuery": "13 week cash flow template",
      "body": "Month-end close checklist, accrual log, and cash forecast rhythm for lean finance teams.\n\nThis page targets: 13 week cash flow template"
    },
    {
      "slug": "accrual-log-template",
      "title": "accrual log template",
      "intentQuery": "accrual log template",
      "body": "Month-end close checklist, accrual log, and cash forecast rhythm for lean finance teams.\n\nThis page targets: accrual log template"
    }
  ],
  "sequenceIndex": 118
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
