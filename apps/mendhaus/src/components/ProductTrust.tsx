import type { Product } from "@/catalog/products";
import type { SupplierListing } from "@/catalog/supplier-map";

function hasFreshVerifiedSupplier(listing: SupplierListing | null) {
  const syncedAt = listing?.lastSyncedAt ? Date.parse(listing.lastSyncedAt) : Number.NaN;
  return Boolean(
    listing?.supplierProductId &&
      listing.supplierSku &&
      listing.warehouseCountry === "US" &&
      Number.isFinite(listing.unitCostUsd) &&
      (listing.unitCostUsd ?? 0) > 0 &&
      Number.isFinite(listing.stock) &&
      (listing.stock ?? 0) > 0 &&
      Number.isFinite(syncedAt) &&
      Date.now() - syncedAt < 24 * 60 * 60 * 1000,
  );
}

export function ProductTrust({
  product,
  listing,
}: {
  product: Product;
  listing: SupplierListing | null;
}) {
  const supplierVerified = hasFreshVerifiedSupplier(listing);

  return (
    <section className="mt-10 border-y border-line py-6" aria-labelledby="buy-with-confidence">
      <h2 id="buy-with-confidence" className="font-display text-2xl text-ink">
        Check before you buy
      </h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-sand/45 p-4">
          <p className="text-sm font-medium text-ink">
            {supplierVerified ? "Supplier variant verified" : "Supplier verification in progress"}
          </p>
          <p className="mt-1 text-sm leading-6 text-ink/70">
            {supplierVerified
              ? "Current SKU, US warehouse, stock, cost, and sync freshness passed our checkout guard."
              : "We do not represent this as a certified or safety-tested item until the supplier variant and documentation are reviewed."}
          </p>
        </div>
        <div className="rounded-2xl bg-sand/45 p-4">
          <p className="text-sm font-medium text-ink">Fit and safe-use notes</p>
          <p className="mt-1 text-sm leading-6 text-ink/70">
            Read the product questions below before installation. Check dimensions, capacity, surfaces,
            and any adhesive or electrical limitations for your home.
          </p>
        </div>
      </div>
      <p className="mt-4 text-xs leading-5 text-ink/55">
        Mendhaus does not claim a material, electrical, child-safety, or food-safety certification
        without manufacturer documentation for this exact {product.name} variant.
      </p>
    </section>
  );
}
