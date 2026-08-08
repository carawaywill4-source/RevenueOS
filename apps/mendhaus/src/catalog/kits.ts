import { getProductById, PRODUCTS } from "@/catalog/products";

export type Kit = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  problem: string;
  productIds: string[];
  /** Merchandising badge */
  badge: string;
};

export const KITS: Kit[] = [
  {
    id: "kit-kitchen-reset",
    slug: "kitchen-reset",
    name: "Kitchen Reset Kit",
    badge: "Best seller path",
    tagline: "Under-sink chaos, wet sponge, dishes on the counter — handled.",
    problem: "The kitchen fails in three places every night. Fix all three once.",
    productIds: ["mh-under-sink-caddy", "mh-roll-up-dish-rack", "mh-sink-sponge-caddy"],
  },
  {
    id: "kit-renter-bath",
    slug: "renter-bath",
    name: "Renter Bathroom Kit",
    badge: "No drill",
    tagline: "Shower storage, cleaner glass, foam at the sink — leave no holes.",
    problem: "Rental bathrooms look unfinished until storage and glass stop fighting you.",
    productIds: ["mh-tension-shower-caddy", "mh-shower-squeegee", "mh-foam-soap-dispenser"],
  },
  {
    id: "kit-desk-day",
    slug: "desk-day",
    name: "Desk Day Kit",
    badge: "WFH stack",
    tagline: "Screen up, back supported, cables off the floor.",
    problem: "A cheap chair and a laptop on the table burn the afternoon.",
    productIds: ["mh-aluminum-laptop-riser", "mh-lumbar-pillow", "mh-desk-cable-clips"],
  },
  {
    id: "kit-entry-clear",
    slug: "entry-clear",
    name: "Entry Clear Kit",
    badge: "Lease-safe",
    tagline: "Coats and shoes off the floor without touching the walls.",
    problem: "The entry is where the apartment starts to look crowded.",
    productIds: ["mh-freestanding-coat-tree", "mh-over-door-shoe-organizer", "mh-over-door-hook-rack"],
  },
];

export function kitProducts(kit: Kit) {
  return kit.productIds
    .map((id) => getProductById(id))
    .filter((p): p is (typeof PRODUCTS)[number] => Boolean(p));
}

export function kitPriceUsd(kit: Kit) {
  return kitProducts(kit).reduce((sum, p) => sum + p.priceUsd, 0);
}

export function kitProfitUsd(kit: Kit) {
  return kitProducts(kit).reduce((sum, p) => sum + p.estimatedGrossProfitUsd, 0);
}

/** Featured single SKUs for the $10k/day attack surface. */
export const ATTACK_FEATURED_IDS = [
  "mh-tension-shower-caddy",
  "mh-under-sink-caddy",
  "mh-freestanding-coat-tree",
  "mh-aluminum-laptop-riser",
  "mh-monitor-stand-drawer",
  "mh-rubber-pet-broom",
] as const;
