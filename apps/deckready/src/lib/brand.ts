import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:20:01.255Z */
export const BRAND: BrandConfig = {
  "siteId": "deckready",
  "displayName": "DeckReady",
  "domain": "deckready.vercel.app",
  "industry": "pitch_decks",
  "businessModel": "digital_download",
  "priceBand": "50_100",
  "considerationLevel": "utilitarian",
  "brandVoice": "founder-direct, anti-hype",
  "primaryColor": "#120D1C",
  "accentColor": "#B8C0FF",
  "fontDisplay": "Instrument Serif",
  "fontBody": "Instrument Sans",
  "supportEmail": "care@deckready.com",
  "product": {
    "id": "deckready-pack",
    "slug": "deckready-pack",
    "name": "DeckReady Narrative Pack",
    "tagline": "Decks bury the problem/insight and overclaim traction.",
    "description": "Honest pitch narrative scaffolds, slide outlines, and Q&A handlings without fabricated metrics.",
    "priceUsd": 79,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "Narrative arc outline",
      "Slide-by-slide prompts",
      "Honest traction framing",
      "Investor Q&A bank"
    ],
    "audience": "early founders preparing investor conversations",
    "intentKeywords": [
      "pitch deck outline template",
      "investor narrative framework",
      "startup pitch structure"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "pitch-deck-outline-template",
      "title": "pitch deck outline template",
      "intentQuery": "pitch deck outline template",
      "body": "Honest pitch narrative scaffolds, slide outlines, and Q&A handlings without fabricated metrics.\n\nThis page targets: pitch deck outline template"
    },
    {
      "slug": "investor-narrative-framework",
      "title": "investor narrative framework",
      "intentQuery": "investor narrative framework",
      "body": "Honest pitch narrative scaffolds, slide outlines, and Q&A handlings without fabricated metrics.\n\nThis page targets: investor narrative framework"
    },
    {
      "slug": "startup-pitch-structure",
      "title": "startup pitch structure",
      "intentQuery": "startup pitch structure",
      "body": "Honest pitch narrative scaffolds, slide outlines, and Q&A handlings without fabricated metrics.\n\nThis page targets: startup pitch structure"
    }
  ],
  "sequenceIndex": 114
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
