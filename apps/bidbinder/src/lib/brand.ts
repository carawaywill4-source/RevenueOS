import { brandBySiteId } from "@revenueos/storefront-kit";

export const BRAND = brandBySiteId("bidbinder")!;
export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
