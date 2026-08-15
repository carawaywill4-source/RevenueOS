import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:20:01.493Z */
export const BRAND: BrandConfig = {
  "siteId": "securesmb",
  "displayName": "SecureSMB",
  "domain": "securesmb.vercel.app",
  "industry": "smb_security",
  "businessModel": "digital_download",
  "priceBand": "50_100",
  "considerationLevel": "utilitarian",
  "brandVoice": "security-practical, calm",
  "primaryColor": "#0D1B2A",
  "accentColor": "#00B4D8",
  "fontDisplay": "IBM Plex Mono",
  "fontBody": "IBM Plex Sans",
  "supportEmail": "care@securesmb.com",
  "product": {
    "id": "securesmb-pack",
    "slug": "securesmb-pack",
    "name": "SecureSMB Hygiene Wedge",
    "tagline": "Basic cyber hygiene is ignored until incident.",
    "description": "SMB security hygiene checklist, vendor access review, and incident first-response runbook (non-alarmist, practical).",
    "priceUsd": 59,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "Hygiene checklist",
      "Vendor access review",
      "Incident first-response",
      "Employee security habits sheet"
    ],
    "audience": "SMB owners without a security team",
    "intentKeywords": [
      "small business cybersecurity checklist",
      "smb security policy template",
      "vendor access review"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "small-business-cybersecurity-checklist",
      "title": "small business cybersecurity checklist",
      "intentQuery": "small business cybersecurity checklist",
      "body": "SMB security hygiene checklist, vendor access review, and incident first-response runbook (non-alarmist, practical).\n\nThis page targets: small business cybersecurity checklist"
    },
    {
      "slug": "smb-security-policy-template",
      "title": "smb security policy template",
      "intentQuery": "smb security policy template",
      "body": "SMB security hygiene checklist, vendor access review, and incident first-response runbook (non-alarmist, practical).\n\nThis page targets: smb security policy template"
    },
    {
      "slug": "vendor-access-review",
      "title": "vendor access review",
      "intentQuery": "vendor access review",
      "body": "SMB security hygiene checklist, vendor access review, and incident first-response runbook (non-alarmist, practical).\n\nThis page targets: vendor access review"
    }
  ],
  "sequenceIndex": 103
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
