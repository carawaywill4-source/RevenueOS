import { LISTINGS, type SupplierListing } from "@/catalog/supplier-map";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase";

let cache: { at: number; byId: Record<string, SupplierListing> } | null = null;
const TTL_MS = 60_000;

function fromStatic(): Record<string, SupplierListing> {
  return { ...LISTINGS };
}

export async function loadSupplierListings(): Promise<Record<string, SupplierListing>> {
  const staticMap = fromStatic();
  if (!supabaseConfigured()) return staticMap;

  if (cache && Date.now() - cache.at < TTL_MS) {
    return { ...staticMap, ...cache.byId };
  }

  try {
    const { data } = await getSupabaseAdmin()
      .from("mh_supplier_listings")
      .select(
        "product_id, network, supplier_product_id, supplier_sku, unit_cost_usd, stock, hero_url, gallery, warehouse_country, search_query, synced_at",
      );
    const byId: Record<string, SupplierListing> = {};
    for (const row of data ?? []) {
      byId[row.product_id as string] = {
        productId: row.product_id as string,
        network: row.network as SupplierListing["network"],
        supplierProductId: row.supplier_product_id as string,
        supplierSku: (row.supplier_sku as string) || undefined,
        unitCostUsd: row.unit_cost_usd != null ? Number(row.unit_cost_usd) : undefined,
        stock: row.stock != null ? Number(row.stock) : undefined,
        hero: (row.hero_url as string) || undefined,
        gallery: (row.gallery as string[]) || [],
        warehouseCountry: (row.warehouse_country as string) || undefined,
        lastSyncedAt: (row.synced_at as string) || undefined,
        searchQuery: (row.search_query as string) || "",
      };
    }
    cache = { at: Date.now(), byId };
    return { ...staticMap, ...byId };
  } catch {
    return staticMap;
  }
}

export async function getListingForProduct(productId: string) {
  const map = await loadSupplierListings();
  return map[productId] ?? null;
}

/**
 * Checkout must not rely on catalog placeholders or an old process cache.
 * A listing is sellable only when the supplier record itself proves a recent
 * US-stocked variant and a landed unit cost.
 */
export async function getVerifiedListingForCheckout(productId: string): Promise<{
  listing: SupplierListing | null;
  reason?: string;
}> {
  if (!supabaseConfigured()) {
    return { listing: null, reason: "Supplier inventory database is unavailable" };
  }

  const { data, error } = await getSupabaseAdmin()
    .from("mh_supplier_listings")
    .select(
      "product_id, network, supplier_product_id, supplier_sku, unit_cost_usd, stock, hero_url, gallery, warehouse_country, search_query, synced_at",
    )
    .eq("product_id", productId)
    .maybeSingle();
  if (error) throw new Error(`Could not verify supplier listing: ${error.message}`);
  if (!data) return { listing: null, reason: "No reviewed supplier variant is mapped" };

  const listing: SupplierListing = {
    productId: data.product_id,
    network: data.network,
    supplierProductId: data.supplier_product_id,
    supplierSku: data.supplier_sku ?? undefined,
    unitCostUsd: data.unit_cost_usd == null ? undefined : Number(data.unit_cost_usd),
    stock: data.stock == null ? undefined : Number(data.stock),
    hero: data.hero_url ?? undefined,
    gallery: data.gallery ?? [],
    warehouseCountry: data.warehouse_country ?? undefined,
    lastSyncedAt: data.synced_at ?? undefined,
    searchQuery: data.search_query ?? "",
  };
  const ageMs = listing.lastSyncedAt ? Date.now() - Date.parse(listing.lastSyncedAt) : Infinity;
  if (!listing.supplierProductId || !listing.supplierSku) {
    return { listing: null, reason: "Supplier variant is incomplete" };
  }
  if (listing.warehouseCountry !== "US") {
    return { listing: null, reason: "Supplier variant is not confirmed in a US warehouse" };
  }
  if (!Number.isFinite(listing.unitCostUsd) || (listing.unitCostUsd ?? 0) <= 0) {
    return { listing: null, reason: "Supplier landed cost is missing" };
  }
  if (!Number.isFinite(listing.stock) || (listing.stock ?? 0) <= 0) {
    return { listing: null, reason: "Supplier stock is unavailable" };
  }
  if (!Number.isFinite(ageMs) || ageMs > 24 * 60 * 60 * 1000) {
    return { listing: null, reason: "Supplier inventory is stale; refresh required" };
  }
  return { listing };
}
