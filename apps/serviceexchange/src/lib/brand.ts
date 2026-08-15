import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:20:01.557Z */
export const BRAND: BrandConfig = {
  "siteId": "serviceexchange",
  "displayName": "ServiceExchange",
  "domain": "serviceexchange.vercel.app",
  "industry": "service_exchange",
  "businessModel": "digital_download",
  "priceBand": "20_50",
  "considerationLevel": "utilitarian",
  "brandVoice": "partnership-clear",
  "primaryColor": "#2B2D42",
  "accentColor": "#EF233C",
  "fontDisplay": "Syne",
  "fontBody": "Work Sans",
  "supportEmail": "care@serviceexchange.com",
  "product": {
    "id": "serviceexchange-pack",
    "slug": "serviceexchange-pack",
    "name": "ServiceExchange Handoff Wedge",
    "tagline": "Overflow referral handoffs are informal and quality-blind.",
    "description": "Partner handoff briefs, quality SLAs, and revenue-share worksheets for service exchanges.",
    "priceUsd": 49,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "Partner handoff brief",
      "Quality SLA sheet",
      "Revenue-share worksheet",
      "Dispute prevention language"
    ],
    "audience": "agencies and freelancers swapping overflow work",
    "intentKeywords": [
      "freelancer referral agreement template",
      "agency overflow handoff",
      "white label sla template"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "freelancer-referral-agreement-template",
      "title": "freelancer referral agreement template",
      "intentQuery": "freelancer referral agreement template",
      "body": "Partner handoff briefs, quality SLAs, and revenue-share worksheets for service exchanges.\n\nThis page targets: freelancer referral agreement template"
    },
    {
      "slug": "agency-overflow-handoff",
      "title": "agency overflow handoff",
      "intentQuery": "agency overflow handoff",
      "body": "Partner handoff briefs, quality SLAs, and revenue-share worksheets for service exchanges.\n\nThis page targets: agency overflow handoff"
    },
    {
      "slug": "white-label-sla-template",
      "title": "white label sla template",
      "intentQuery": "white label sla template",
      "body": "Partner handoff briefs, quality SLAs, and revenue-share worksheets for service exchanges.\n\nThis page targets: white label sla template"
    }
  ],
  "sequenceIndex": 135
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
