/**
 * Product media for the storefront.
 * - `editorial`: curated lifestyle photography until a live supplier image is mapped
 * - `supplier`: CJ/Spocket image URL after owner sync (see supplier-map.ts)
 */

import type { ProductCategory } from "@/catalog/products";
import type { SupplierListing } from "@/catalog/supplier-map";

export type ProductMedia = {
  hero: string;
  gallery: string[];
  alt: string;
  source: "editorial" | "supplier";
};

const U = (id: string, w = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

/** Category atmosphere — used when a product has no specific override. */
const CATEGORY_HERO: Record<ProductCategory, string> = {
  kitchen: U("photo-1556911220-bff31c812dba"),
  bathroom: U("photo-1620626011761-996317b8d101"),
  bedroom: U("photo-1616594039964-ae9021a400a0"),
  closet: U("photo-1558618666-fcd25c85cd64"),
  desk: U("photo-1497366216548-37526070297c"),
  cleaning: U("photo-1581578731548-c64695cc6952"),
  lighting: U("photo-1565814636199-ae5429e39cd4"),
  renter: U("photo-1502672260266-1c1ef2d93688"),
};

const PRODUCT_HERO: Record<string, string> = {
  "mh-under-sink-caddy": U("photo-1556911220-bff31c812dba"),
  "mh-roll-up-dish-rack": U("photo-1556910103-1c02745aae4d"),
  "mh-fridge-bin-set": U("photo-1571175443880-49e1d25b2bc5"),
  "mh-magnetic-spice-tins": U("photo-1596797038530-2c107229654b"),
  "mh-sink-sponge-caddy": U("photo-1563453392212-326f5e854473"),
  "mh-tension-shower-caddy": U("photo-1552321554-5fefe8c9ef14"),
  "mh-toothbrush-drip-stand": U("photo-1620626011761-996317b8d101"),
  "mh-foam-soap-dispenser": U("photo-1584622650111-993a426fbf0a"),
  "mh-toilet-paper-stand": U("photo-1584622781867-64310d764f43"),
  "mh-laundry-basket": U("photo-1522771739844-6a9f6d5f14af"),
  "mh-bedside-caddy": U("photo-1616594039964-ae9021a400a0"),
  "mh-blackout-window-liner": U("photo-1513694203232-719a280e022f"),
  "mh-slim-velvet-hangers": U("photo-1558618666-fcd25c85cd64"),
  "mh-makeup-organizer": U("photo-1595428774223-ef52624120d2"),
  "mh-hanging-closet-organizer": U("photo-1618220179428-22790b461013"),
  "mh-aluminum-laptop-riser": U("photo-1497215728101-856f4ea42174"),
  "mh-monitor-stand-drawer": U("photo-1593062096033-9a2bde35b1f0"),
  "mh-desk-cable-clips": U("photo-1558618047-3c8c76ca7d13"),
  "mh-desk-drawer-tray": U("photo-1486312338219-ce68d2c6f44d"),
  "mh-cable-sleeve-kit": U("photo-1544197150-b99a5804d0fa"),
  "mh-under-cabinet-puck-lights": U("photo-1513506003901-1e6a229e2d15"),
  "mh-motion-closet-light": U("photo-1507473885765-e6ed057f782c"),
  "mh-clip-on-reading-light": U("photo-1543198126-a8ad8e47fb22"),
  "mh-rubber-pet-broom": U("photo-1583337130417-3346a1be7dee"),
  "mh-flat-mop-pads": U("photo-1527515637462-cff94eecc1ac"),
  "mh-grout-brush-set": U("photo-1584622650111-993a426fbf0a"),
  "mh-washable-lint-roller": U("photo-1516734212186-a967f81ad0d7"),
  "mh-over-door-hook-rack": U("photo-1502672260266-1c1ef2d93688"),
  "mh-lumbar-pillow": U("photo-1497366216548-37526070297c"),
  "mh-shower-squeegee": U("photo-1552321554-5fefe8c9ef14"),
  "mh-over-door-shoe-organizer": U("photo-1543163521-1bf539c55dd2"),
  "mh-freestanding-coat-tree": U("photo-1556909114-f6e7ad7d3136"),
};

export function getProductMedia(
  productId: string,
  category: ProductCategory,
  name: string,
  listing?: SupplierListing | null,
): ProductMedia {
  if (listing?.hero) {
    return {
      hero: listing.hero,
      gallery: listing.gallery.length ? listing.gallery : [listing.hero],
      alt: name,
      source: "supplier",
    };
  }
  const hero = PRODUCT_HERO[productId] ?? CATEGORY_HERO[category];
  return {
    hero,
    gallery: [hero],
    alt: `${name} — lifestyle context`,
    source: "editorial",
  };
}

export const SITE_HERO = "/images/hero.jpg";
