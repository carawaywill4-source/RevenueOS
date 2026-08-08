/**
 * Live supplier SKU map. Empty until the owner syncs CJ/Spocket.
 * After sync, product images and costs override catalog hints.
 */

export type SupplierListing = {
  productId: string;
  network: "cj_us_warehouse" | "spocket_us" | "cj_china";
  /** Platform product / variant id */
  supplierProductId: string;
  supplierSku?: string;
  unitCostUsd?: number;
  stock?: number;
  hero?: string;
  gallery: string[];
  warehouseCountry?: string;
  lastSyncedAt?: string;
  searchQuery: string;
};

/**
 * Search queries used when syncing from CJ (countryCode=US preferred).
 * Fill `LISTINGS` via /api/admin/supplier-sync once CJ_API_KEY is set.
 */
export const SUPPLIER_SEARCH: Record<string, { query: string; network: SupplierListing["network"] }> =
  {
    "mh-under-sink-caddy": { query: "under sink organizer pull out 2 tier", network: "cj_us_warehouse" },
    "mh-roll-up-dish-rack": { query: "roll up dish drying rack over sink", network: "cj_us_warehouse" },
    "mh-fridge-bin-set": { query: "clear refrigerator organizer bins set", network: "cj_us_warehouse" },
    "mh-magnetic-spice-tins": { query: "12 Pcs Square Spice Jars", network: "cj_us_warehouse" },
    "mh-sink-sponge-caddy": { query: "sink sponge holder caddy stainless", network: "cj_us_warehouse" },
    "mh-tension-shower-caddy": { query: "tension pole shower caddy stainless", network: "cj_us_warehouse" },
    "mh-toothbrush-drip-stand": { query: "toothbrush holder drip tray", network: "cj_us_warehouse" },
    "mh-foam-soap-dispenser": { query: "foam soap dispenser automatic bathroom", network: "cj_us_warehouse" },
    "mh-toilet-paper-stand": { query: "freestanding toilet paper holder stand", network: "cj_us_warehouse" },
    "mh-laundry-basket": { query: "foldable laundry basket moisture proof", network: "cj_us_warehouse" },
    "mh-bedside-caddy": { query: "bedside caddy organizer mattress", network: "cj_us_warehouse" },
    "mh-blackout-window-liner": { query: "blackout curtain liner rod pocket", network: "cj_us_warehouse" },
    "mh-slim-velvet-hangers": { query: "velvet hangers non slip pack 30", network: "cj_us_warehouse" },
    "mh-makeup-organizer": { query: "makeup storage organizer set acrylic", network: "cj_us_warehouse" },
    "mh-hanging-closet-organizer": { query: "hanging closet organizer shelves", network: "cj_us_warehouse" },
    "mh-aluminum-laptop-riser": { query: "aluminum laptop stand riser", network: "cj_us_warehouse" },
    "mh-monitor-stand-drawer": { query: "monitor stand with drawer wood", network: "cj_us_warehouse" },
    "mh-desk-cable-clips": { query: "magnetic cable clip under desk", network: "cj_us_warehouse" },
    "mh-desk-drawer-tray": { query: "desk drawer organizer tray", network: "cj_us_warehouse" },
    "mh-cable-sleeve-kit": { query: "braided cable sleeve kit", network: "cj_us_warehouse" },
    "mh-under-cabinet-puck-lights": { query: "rechargeable under cabinet puck lights", network: "cj_us_warehouse" },
    "mh-motion-closet-light": { query: "motion sensor closet light rechargeable", network: "cj_us_warehouse" },
    "mh-clip-on-reading-light": { query: "clip on reading light rechargeable", network: "cj_us_warehouse" },
    "mh-rubber-pet-broom": { query: "rubber broom pet hair removal", network: "cj_us_warehouse" },
    "mh-flat-mop-pads": { query: "microfiber flat mop washable pads", network: "cj_us_warehouse" },
    "mh-grout-brush-set": { query: "grout brush cleaning set", network: "cj_us_warehouse" },
    "mh-washable-lint-roller": { query: "washable silicone lint roller", network: "cj_us_warehouse" },
    "mh-over-door-hook-rack": { query: "over the door hook rack coat", network: "cj_us_warehouse" },
    "mh-lumbar-pillow": { query: "memory foam lumbar pillow office chair", network: "cj_us_warehouse" },
    "mh-shower-squeegee": { query: "shower glass squeegee bathroom wiper", network: "cj_us_warehouse" },
    "mh-over-door-shoe-organizer": { query: "over door shoe organizer pockets", network: "cj_us_warehouse" },
    "mh-freestanding-coat-tree": { query: "freestanding coat rack tree metal", network: "cj_us_warehouse" },
  };

/** Populated at runtime by supplier sync into durable storage; static overrides go here. */
export const LISTINGS: Record<string, SupplierListing> = {};

export function getSupplierListing(productId: string) {
  return LISTINGS[productId] ?? null;
}

export function mappedListingCount() {
  return Object.keys(LISTINGS).filter((id) => LISTINGS[id]?.supplierProductId).length;
}
