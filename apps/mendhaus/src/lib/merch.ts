import { KITS, type Kit } from "@/catalog/kits";
import { PRODUCTS, getProductById, type Product } from "@/catalog/products";
import { FREE_SHIPPING_AT_USD } from "@/lib/brand";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase";

export type MerchFocus = "kits" | "kitchen" | "bath" | "desk" | "entry" | "default";

export type SitePromo = {
  id: string;
  label: string;
  /** Honest deal label — never "only 2 left" / fake countdown. */
  headline: string;
  subhead?: string;
  /** Percent off list price, 5–25. */
  percentOff: number;
  scope: "site" | "kit" | "products";
  kitId?: string;
  productIds?: string[];
  startsAt: string;
  endsAt: string;
  reason: string;
};

export type MerchState = {
  promo: SitePromo | null;
  bannerEnabled: boolean;
  focus: MerchFocus;
  featuredProductIds: string[];
  featuredKitIds: string[];
  freeShippingAtUsd: number;
  updatedAt?: string;
  updatedBy?: string;
  lastAction?: string;
};

const DEFAULT_STATE: MerchState = {
  promo: null,
  bannerEnabled: false,
  focus: "kits",
  featuredProductIds: [
    "mh-tension-shower-caddy",
    "mh-under-sink-caddy",
    "mh-freestanding-coat-tree",
    "mh-aluminum-laptop-riser",
    "mh-monitor-stand-drawer",
    "mh-rubber-pet-broom",
  ],
  featuredKitIds: KITS.map((k) => k.id),
  freeShippingAtUsd: FREE_SHIPPING_AT_USD,
};

let cache: { at: number; state: MerchState } | null = null;
const TTL_MS = 15_000;

export function defaultMerchState(): MerchState {
  return { ...DEFAULT_STATE, featuredProductIds: [...DEFAULT_STATE.featuredProductIds] };
}

export async function loadMerchState(): Promise<MerchState> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.state;
  if (!supabaseConfigured()) {
    cache = { at: Date.now(), state: defaultMerchState() };
    return cache.state;
  }
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("mh_merch_state")
      .select("document,updated_at,updated_by")
      .eq("id", "live")
      .maybeSingle();
    if (error || !data) {
      cache = { at: Date.now(), state: defaultMerchState() };
      return cache.state;
    }
    const doc = (data.document ?? {}) as Partial<MerchState>;
    const state: MerchState = {
      ...defaultMerchState(),
      ...doc,
      promo: normalizePromo(doc.promo ?? null),
      updatedAt: data.updated_at,
      updatedBy: data.updated_by,
    };
    if (state.promo && new Date(state.promo.endsAt).getTime() < Date.now()) {
      state.promo = null;
      state.bannerEnabled = false;
    }
    cache = { at: Date.now(), state };
    return state;
  } catch {
    cache = { at: Date.now(), state: defaultMerchState() };
    return cache.state;
  }
}

export async function saveMerchState(
  next: MerchState,
  updatedBy = "revenueos",
): Promise<MerchState> {
  const document: MerchState = {
    ...next,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };
  if (!supabaseConfigured()) {
    cache = { at: Date.now(), state: document };
    return document;
  }
  const { error } = await getSupabaseAdmin().from("mh_merch_state").upsert({
    id: "live",
    document,
    updated_at: document.updatedAt,
    updated_by: updatedBy,
  });
  if (error) throw new Error(`Could not persist merchandising change: ${error.message}`);
  cache = { at: Date.now(), state: document };
  return document;
}

function normalizePromo(promo: SitePromo | null): SitePromo | null {
  if (!promo) return null;
  const now = Date.now();
  if (
    !promo.startsAt ||
    !promo.endsAt ||
    new Date(promo.startsAt).getTime() > now ||
    new Date(promo.endsAt).getTime() < now
  ) {
    return null;
  }
  return promo;
}

export function promoAppliesToProduct(promo: SitePromo | null, productId: string): boolean {
  if (!promo) return false;
  if (promo.scope === "site") return true;
  if (promo.scope === "products") return (promo.productIds ?? []).includes(productId);
  // A kit deal is earned only by buying the complete kit. Product pages and
  // individual cart lines must never imply that a component is discounted.
  return false;
}

export function kitPromoAppliesToCart(
  promo: SitePromo | null,
  productIds: readonly string[],
): boolean {
  if (!promo || promo.scope !== "kit" || !promo.kitId) return false;
  const kit = KITS.find((candidate) => candidate.id === promo.kitId);
  return Boolean(kit && kit.productIds.every((id) => productIds.includes(id)));
}

/** Sale price that still clears the SKU margin floor after fees/ship/COGS. */
export function maxSafePercentOff(product: Product): number {
  const feeAtPrice = (price: number) => price * 0.029 + 0.3;
  for (let pct = 25; pct >= 0; pct -= 1) {
    const price = Number((product.priceUsd * (1 - pct / 100)).toFixed(2));
    const profit = Number(
      (
        price -
        product.cogsUsd -
        product.shippingCostUsd -
        product.fulfillmentFeeUsd -
        feeAtPrice(price)
      ).toFixed(2),
    );
    if (profit >= product.minMarginUsd && price >= product.cogsUsd + 3) return pct;
  }
  return 0;
}

export function effectiveUnitPrice(product: Product, promo: SitePromo | null): number {
  if (!promoAppliesToProduct(promo, product.id) || !promo) return product.priceUsd;
  const capped = Math.min(promo.percentOff, maxSafePercentOff(product));
  if (capped <= 0) return product.priceUsd;
  return Number((product.priceUsd * (1 - capped / 100)).toFixed(2));
}

/** Final unit price after verifying a kit is complete in the cart. */
export function effectiveCartUnitPrice(
  product: Product,
  promo: SitePromo | null,
  cartProductIds: readonly string[],
): number {
  if (!kitPromoAppliesToCart(promo, cartProductIds)) {
    return effectiveUnitPrice(product, promo);
  }
  const kit = KITS.find((candidate) => candidate.id === promo?.kitId);
  if (!kit?.productIds.includes(product.id) || !promo) return product.priceUsd;
  const capped = Math.min(promo.percentOff, maxSafePercentOff(product));
  return capped > 0
    ? Number((product.priceUsd * (1 - capped / 100)).toFixed(2))
    : product.priceUsd;
}

export function effectiveCompareAt(product: Product, promo: SitePromo | null): number | undefined {
  const sale = effectiveUnitPrice(product, promo);
  if (sale < product.priceUsd) return product.priceUsd;
  return product.compareAtUsd;
}

export function createKitPromo(kit: Kit, percentOff: number, hours = 48, reason: string): SitePromo {
  const safe = Math.min(
    percentOff,
    ...kit.productIds.map((id) => {
      const p = getProductById(id);
      return p ? maxSafePercentOff(p) : 0;
    }),
  );
  if (safe < 5) {
    throw new Error(`No margin-safe discount exists for every ${kit.name} item`);
  }
  const now = Date.now();
  return {
    id: `promo-${kit.id}-${now}`,
    label: `${kit.name} deal`,
    headline: `${safe}% off the ${kit.name}`,
    subhead: "Real markdown on list price. Ends when the window closes — no fake stock counters.",
    percentOff: safe,
    scope: "kit",
    kitId: kit.id,
    startsAt: new Date(now).toISOString(),
    endsAt: new Date(now + hours * 3600_000).toISOString(),
    reason,
  };
}

export function createSitePromo(percentOff: number, hours = 36, reason: string): SitePromo {
  const safe = Math.min(percentOff, ...PRODUCTS.map((p) => maxSafePercentOff(p)).filter((n) => n > 0));
  if (safe < 5) throw new Error("No margin-safe sitewide discount exists");
  const pct = Math.min(15, safe);
  const now = Date.now();
  return {
    id: `promo-site-${now}`,
    label: "Site deal",
    headline: `${pct}% off sitewide`,
    subhead: "Applies at checkout. Only SKUs that still clear our margin floor are discounted.",
    percentOff: pct,
    scope: "site",
    startsAt: new Date(now).toISOString(),
    endsAt: new Date(now + hours * 3600_000).toISOString(),
    reason,
  };
}

export function kitByFocus(focus: MerchFocus): string[] {
  switch (focus) {
    case "kitchen":
      return ["kit-kitchen-reset"];
    case "bath":
      return ["kit-renter-bath"];
    case "desk":
      return ["kit-desk-day"];
    case "entry":
      return ["kit-entry-clear"];
    case "kits":
    default:
      return KITS.map((k) => k.id);
  }
}
