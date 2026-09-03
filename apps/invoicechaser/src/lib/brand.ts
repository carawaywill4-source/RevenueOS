import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:52:35.752Z */
export const BRAND: BrandConfig = {
  "siteId": "invoicechaser",
  "displayName": "InvoiceChaser",
  "domain": "invoicechaser.vercel.app",
  "industry": "receivables_followup",
  "businessModel": "digital_download",
  "priceBand": "20_50",
  "considerationLevel": "utilitarian",
  "brandVoice": "firm, respectful, cash-focused",
  "primaryColor": "#1B1B1E",
  "accentColor": "#90BE6D",
  "fontDisplay": "Newsreader",
  "fontBody": "Figtree",
  "supportEmail": "care@invoicechaser.com",
  "product": {
    "id": "invoicechaser-pack",
    "slug": "invoicechaser-pack",
    "name": "InvoiceChaser Follow-Up Pack",
    "tagline": "Awkward payment follow-ups get delayed or aggressive.",
    "description": "Polite-to-firm invoice chase sequences, phone scripts, and late-fee policy language.",
    "priceUsd": 29,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "7-touch chase sequence",
      "Phone & SMS scripts",
      "Late-fee & pause-work language",
      "Payment plan offer templates"
    ],
    "audience": "freelancers and SMBs with overdue invoices",
    "intentKeywords": [
      "overdue invoice email template",
      "how to chase invoice politely",
      "accounts receivable follow up"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "overdue-invoice-email-template",
      "title": "overdue invoice email template",
      "intentQuery": "overdue invoice email template",
      "body": "Polite-to-firm invoice chase sequences, phone scripts, and late-fee policy language.\n\nThis page targets: overdue invoice email template"
    },
    {
      "slug": "how-to-chase-invoice-politely",
      "title": "how to chase invoice politely",
      "intentQuery": "how to chase invoice politely",
      "body": "Polite-to-firm invoice chase sequences, phone scripts, and late-fee policy language.\n\nThis page targets: how to chase invoice politely"
    },
    {
      "slug": "accounts-receivable-follow-up",
      "title": "accounts receivable follow up",
      "intentQuery": "accounts receivable follow up",
      "body": "Polite-to-firm invoice chase sequences, phone scripts, and late-fee policy language.\n\nThis page targets: accounts receivable follow up"
    }
  ],
  "sequenceIndex": 143
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
