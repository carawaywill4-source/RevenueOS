import { KITS } from "@/catalog/kits";
import { appendJournal } from "@/lib/events";
import {
  createKitPromo,
  createSitePromo,
  kitByFocus,
  loadMerchState,
  saveMerchState,
  type MerchFocus,
  type MerchState,
} from "@/lib/merch";
import { getLastHourPulse, getWindowSnapshot } from "@/lib/metrics";

/**
 * Autonomous merchandising brain. Runs each RevenueOS cycle.
 * Never discounts below margin floor (enforced in create*Promo).
 * Never uses fake scarcity copy.
 */
export async function runMerchOptimize(): Promise<{ ok: boolean; detail: string }> {
  const [state, hour, week] = await Promise.all([
    loadMerchState(),
    getLastHourPulse(),
    getWindowSnapshot(7),
  ]);

  const views = hour.landingViews;
  const checkouts = hour.checkouts;
  const purchases = hour.purchases;
  const weekViews = week.events.landing_view ?? 0;
  // Do not train the sales system on three clicks. A real price test needs
  // enough exposure to distinguish demand from ordinary hourly noise.
  const hasPromoSample = weekViews >= 100 || views >= 25;

  const next: MerchState = { ...state };
  let action = "hold";

  // Expired promo cleanup
  if (next.promo && new Date(next.promo.endsAt).getTime() < Date.now()) {
    next.promo = null;
    next.bannerEnabled = false;
    action = "clear_expired_promo";
  }

  // Zero-hour / no checkout: run a kit deal to lift conversion, not fake urgency.
  if (purchases === 0 && checkouts === 0 && hasPromoSample && !next.promo) {
    const kit = KITS[Math.floor(Date.now() / 3_600_000) % KITS.length];
    next.promo = createKitPromo(kit, 12, 48, "zero_sales_hour_kit_deal");
    next.bannerEnabled = true;
    next.focus = kitFocus(kit.id);
    next.featuredKitIds = [kit.id, ...next.featuredKitIds.filter((id) => id !== kit.id)];
    action = `activate_kit_deal:${kit.id}`;
  } else if (purchases === 0 && checkouts >= 3 && hasPromoSample && !next.promo) {
    // Checkout started but no buy — lighter sitewide within margin.
    next.promo = createSitePromo(8, 24, "checkout_friction_soft_sale");
    next.bannerEnabled = true;
    action = "activate_site_promo_8";
  } else if (purchases > 0 && next.promo && next.promo.percentOff >= 12) {
    // Something sold on a deep deal — taper to protect margin.
    next.promo = { ...next.promo, percentOff: 8, label: "Extended deal", headline: "8% off continuing" };
    action = "taper_promo_to_8";
  } else if (views < 2 && weekViews > 20) {
    // Traffic soft this hour — rotate focus to a different kit story.
    const focuses: MerchFocus[] = ["kitchen", "bath", "desk", "entry"];
    const idx = focuses.indexOf(next.focus);
    next.focus = focuses[(idx + 1) % focuses.length] ?? "kits";
    next.featuredKitIds = kitByFocus(next.focus);
    action = `rotate_focus:${next.focus}`;
  } else if (purchases >= 2 && next.promo) {
    // Strong hour — end promo early to protect contribution.
    next.promo = null;
    next.bannerEnabled = false;
    action = "end_promo_strong_hour";
  } else if (!next.promo && views >= 25 && checkouts === 0) {
    next.promo = createKitPromo(KITS[0], 10, 36, "traffic_no_checkout_kitchen_push");
    next.bannerEnabled = true;
    next.focus = "kitchen";
    next.featuredKitIds = kitByFocus("kitchen");
    action = "activate_kitchen_deal";
  }

  // Free shipping lever: if AOV soft and no promo, nudge threshold down slightly.
  if (!next.promo && purchases === 0 && hasPromoSample) {
    next.freeShippingAtUsd = 69;
    if (action === "hold") action = "free_shipping_69";
  } else if (purchases > 0) {
    next.freeShippingAtUsd = 79;
  }

  next.lastAction = action;
  await saveMerchState(next, "revenueos:merch_optimize");
  await appendJournal(`Merch: ${action}`, {
    promo: next.promo,
    focus: next.focus,
    freeShippingAtUsd: next.freeShippingAtUsd,
    hour: { views, checkouts, purchases },
  });

  return { ok: true, detail: action };
}

function kitFocus(kitId: string): MerchFocus {
  if (kitId.includes("kitchen")) return "kitchen";
  if (kitId.includes("bath")) return "bath";
  if (kitId.includes("desk")) return "desk";
  if (kitId.includes("entry")) return "entry";
  return "kits";
}

export async function activateNamedKitDeal(kitId: string, percentOff = 12) {
  const kit = KITS.find((k) => k.id === kitId);
  if (!kit) return { ok: false as const, detail: `Unknown kit ${kitId}` };
  const state = await loadMerchState();
  const promo = createKitPromo(kit, percentOff, 48, `bet:activate_kit_deal:${kitId}`);
  const next: MerchState = {
    ...state,
    promo,
    bannerEnabled: true,
    focus: kitFocus(kit.id),
    featuredKitIds: [kit.id, ...state.featuredKitIds.filter((id) => id !== kit.id)],
    lastAction: `activate_kit_deal:${kit.id}`,
  };
  await saveMerchState(next, "revenueos:activate_kit_deal");
  await appendJournal(`Merch deal: ${promo.headline}`, { promo });
  return { ok: true as const, detail: promo.headline };
}

export async function clearActivePromo(reason: string) {
  const state = await loadMerchState();
  const next = {
    ...state,
    promo: null,
    bannerEnabled: false,
    lastAction: `clear_promo:${reason}`,
  };
  await saveMerchState(next, "revenueos:clear_promo");
  await appendJournal(`Merch cleared: ${reason}`, {});
  return { ok: true as const, detail: reason };
}

export async function setHomepageFocus(focus: MerchFocus) {
  const state = await loadMerchState();
  const next = {
    ...state,
    focus,
    featuredKitIds: kitByFocus(focus),
    lastAction: `set_focus:${focus}`,
  };
  await saveMerchState(next, "revenueos:set_homepage_focus");
  await appendJournal(`Merch focus → ${focus}`, { focus });
  return { ok: true as const, detail: focus };
}

export async function setFreeShippingThreshold(usd: number) {
  const capped = Math.min(99, Math.max(49, Math.round(usd)));
  const state = await loadMerchState();
  const next = {
    ...state,
    freeShippingAtUsd: capped,
    lastAction: `free_shipping:${capped}`,
  };
  await saveMerchState(next, "revenueos:set_free_shipping_threshold");
  await appendJournal(`Merch free shipping → $${capped}`, { freeShippingAtUsd: capped });
  return { ok: true as const, detail: `$${capped}` };
}
