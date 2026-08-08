import Link from "next/link";
import type { MerchState } from "@/lib/merch";

export function PromoBanner({ merch }: { merch: MerchState }) {
  if (!merch.bannerEnabled || !merch.promo) return null;
  const { promo } = merch;
  const href = promo.kitId ? "/#kits" : "/shop";

  return (
    <div className="border-b border-spruce/25 bg-spruce text-paper">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium tracking-tight">{promo.headline}</p>
          {promo.subhead ? (
            <p className="text-xs text-paper/75">{promo.subhead}</p>
          ) : null}
        </div>
        <Link
          href={href}
          className="shrink-0 text-xs font-medium uppercase tracking-[0.14em] text-paper underline-offset-4 hover:underline"
        >
          Shop the deal
        </Link>
      </div>
    </div>
  );
}
