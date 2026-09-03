import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — 2026-08-10T05:43:51.867Z */
export const BRAND: BrandConfig = {
  "siteId": "listingpilot",
  "displayName": "ListingPilot",
  "domain": "listingpilot.vercel.app",
  "industry": "vacation_rental_listings",
  "businessModel": "digital_download",
  "priceBand": "20_50",
  "considerationLevel": "utilitarian",
  "brandVoice": "host-operator, conversion-minded",
  "primaryColor": "#16324F",
  "accentColor": "#F28482",
  "fontDisplay": "Libre Franklin",
  "fontBody": "Libre Franklin",
  "supportEmail": "care@listingpilot.com",
  "product": {
    "id": "listingpilot-pack",
    "slug": "listingpilot-pack",
    "name": "ListingPilot Optimization Pack",
    "tagline": "Titles, amenities, and photo order bury conversion.",
    "description": "Listing rewrite frameworks, amenity prioritization, photo sequencing, and guest-message starters for STR hosts.",
    "priceUsd": 47,
    "assetFiles": [
      "readme.md",
      "guide-01.md",
      "guide-02.md",
      "guide-03.md"
    ],
    "bullets": [
      "Title/subtitle formulas",
      "Amenity priority matrix",
      "Photo sequence storyboard",
      "Inquiry conversion messages"
    ],
    "audience": "Airbnb/VRBO hosts underperforming on occupancy",
    "intentKeywords": [
      "airbnb listing optimization",
      "vrbo title examples",
      "increase airbnb bookings listing"
    ]
  },
  "discoveryDoors": [
    {
      "slug": "airbnb-listing-optimization",
      "title": "airbnb listing optimization",
      "intentQuery": "airbnb listing optimization",
      "body": "Listing rewrite frameworks, amenity prioritization, photo sequencing, and guest-message starters for STR hosts.\n\nThis page targets: airbnb listing optimization"
    },
    {
      "slug": "vrbo-title-examples",
      "title": "vrbo title examples",
      "intentQuery": "vrbo title examples",
      "body": "Listing rewrite frameworks, amenity prioritization, photo sequencing, and guest-message starters for STR hosts.\n\nThis page targets: vrbo title examples"
    },
    {
      "slug": "increase-airbnb-bookings-listing",
      "title": "increase airbnb bookings listing",
      "intentQuery": "increase airbnb bookings listing",
      "body": "Listing rewrite frameworks, amenity prioritization, photo sequencing, and guest-message starters for STR hosts.\n\nThis page targets: increase airbnb bookings listing"
    }
  ],
  "sequenceIndex": 131
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
