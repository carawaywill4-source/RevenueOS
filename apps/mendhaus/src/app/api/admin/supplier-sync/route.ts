import { NextResponse } from "next/server";
import { SUPPLIER_SEARCH, type SupplierListing } from "@/catalog/supplier-map";
import {
  cjConfigured,
  cjImages,
  cjUnitCostUsd,
  pickBestCjMatch,
  searchCjProducts,
} from "@/lib/cj";
import { appendJournal } from "@/lib/events";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: Request) {
  const token = process.env.OWNER_DASHBOARD_TOKEN?.trim();
  if (!token) return false;
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${token}`;
}

/**
 * POST /api/admin/supplier-sync
 * Authorization: Bearer OWNER_DASHBOARD_TOKEN
 * Body: { limit?: number, productIds?: string[] }
 *
 * Searches CJ for each catalog SKU and upserts listings into mh_supplier_listings.
 * Owner still reviews costs before setting MENDHAUS_SUPPLIER_READY=1.
 */
export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!cjConfigured()) {
    return NextResponse.json(
      {
        error: "CJ not configured",
        hint: "Set CJ_ACCESS_TOKEN, or CJ_EMAIL + CJ_API_KEY from cjdropshipping.com Authorization → API",
      },
      { status: 400 },
    );
  }

  let body: { limit?: number; productIds?: string[] } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const ids =
    body.productIds?.length ?
      body.productIds
    : Object.keys(SUPPLIER_SEARCH).slice(0, body.limit ?? 32);

  const listings: SupplierListing[] = [];
  const misses: string[] = [];

  for (const productId of ids) {
    const search = SUPPLIER_SEARCH[productId];
    if (!search) {
      misses.push(productId);
      continue;
    }
    try {
      const results = await searchCjProducts(search.query, 20);
      const best = pickBestCjMatch(results, search.query);
      if (!best?.pid) {
        misses.push(productId);
        continue;
      }
      const images = cjImages(best);
      listings.push({
        productId,
        network: search.network,
        supplierProductId: best.pid,
        supplierSku: best.sku,
        unitCostUsd: cjUnitCostUsd(best),
        stock: best.totalVerifiedInventory ?? best.warehouseInventoryNum,
        hero: images.hero,
        gallery: images.gallery,
        warehouseCountry: "US",
        lastSyncedAt: new Date().toISOString(),
        searchQuery: search.query,
      });
      // CJ QPS = 1
      await new Promise((r) => setTimeout(r, 1100));
    } catch (error) {
      misses.push(productId);
      console.error("CJ sync miss", productId, error);
    }
  }

  if (supabaseConfigured() && listings.length) {
    const sb = getSupabaseAdmin();
    for (const listing of listings) {
      await sb.from("mh_supplier_listings").upsert(
        {
          product_id: listing.productId,
          network: listing.network,
          supplier_product_id: listing.supplierProductId,
          supplier_sku: listing.supplierSku ?? null,
          unit_cost_usd: listing.unitCostUsd ?? null,
          stock: listing.stock ?? null,
          hero_url: listing.hero ?? null,
          gallery: listing.gallery,
          warehouse_country: listing.warehouseCountry ?? null,
          search_query: listing.searchQuery,
          synced_at: listing.lastSyncedAt,
          payload: listing,
        },
        { onConflict: "product_id" },
      );
    }
  }

  await appendJournal("CJ supplier sync completed", {
    mapped: listings.length,
    misses,
  });

  return NextResponse.json({
    ok: true,
    mapped: listings.length,
    misses,
    listings,
    next: "Review unit costs, then set MENDHAUS_SUPPLIER_READY=1 and NEXT_PUBLIC_MENDHAUS_CHECKOUT=1",
  });
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseConfigured()) {
    return NextResponse.json({ listings: [], cjConfigured: cjConfigured() });
  }
  const { data, error } = await getSupabaseAdmin()
    .from("mh_supplier_listings")
    .select("*")
    .order("synced_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message, cjConfigured: cjConfigured() }, { status: 500 });
  }
  return NextResponse.json({ listings: data ?? [], cjConfigured: cjConfigured() });
}
