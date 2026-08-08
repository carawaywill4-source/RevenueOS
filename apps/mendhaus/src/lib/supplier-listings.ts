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
