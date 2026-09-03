import type {
  BusinessContext,
  BusinessModel,
  FunnelStepStat,
  MoneyObservation,
  Observation,
  Opportunity,
  PrecursorMetric,
  UnitEconomics,
  WorldModel,
} from "../types";
import { CONVERSION_BASELINES } from "../knowledge/commerce";

export function countEvents(
  events: Partial<Record<string, number>> | undefined,
  name: string,
) {
  return Number(events?.[name] ?? 0);
}

export function buildFunnel(
  steps: string[],
  events: Partial<Record<string, number>> | undefined,
): FunnelStepStat[] {
  const result: FunnelStepStat[] = [];
  let previous: number | null = null;
  for (const step of steps) {
    const total = countEvents(events, step);
    const dropFromPrevious =
      previous === null ? null : Math.max(0, previous - total);
    const dropRate =
      previous && previous > 0 && dropFromPrevious !== null
        ? dropFromPrevious / previous
        : null;
    result.push({ step, count: total, dropFromPrevious, dropRate });
    previous = total;
  }
  return result;
}

export function largestDrop(steps: FunnelStepStat[]) {
  return (
    steps
      .filter(
        (step) => step.dropRate !== null && (step.dropFromPrevious ?? 0) > 0,
      )
      .sort((a, b) => (b.dropRate ?? 0) - (a.dropRate ?? 0))[0] ?? null
  );
}

export function estimateVariableCost(input: {
  purchases: number;
  priceUsd: number;
  stripePercent?: number;
  stripeFixedUsd?: number;
  draftCount?: number;
  draftCostUsd?: number;
}) {
  const stripePercent = input.stripePercent ?? 0.029;
  const stripeFixed = input.stripeFixedUsd ?? 0.3;
  const draftCost = (input.draftCount ?? 0) * (input.draftCostUsd ?? 0.02);
  const stripe =
    input.purchases * (input.priceUsd * stripePercent + stripeFixed);
  return Number((stripe + draftCost).toFixed(2));
}

export function scoreOpportunity(
  item: Omit<Opportunity, "score">,
): Opportunity {
  const score = Number(
    (
      (item.expectedImpact * item.confidence) /
      Math.max(item.effort, 0.1)
    ).toFixed(2),
  );
  return { ...item, score };
}

export function moneyFromCounts(input: {
  purchases: number;
  awaitingPayment: number;
  refunded: number;
  revenueUsd: number;
  variableCostUsd: number;
  mrr?: number;
}): MoneyObservation {
  return {
    revenueUsd: input.revenueUsd,
    purchases: input.purchases,
    awaitingPayment: input.awaitingPayment,
    refunded: input.refunded,
    estimatedVariableCostUsd: input.variableCostUsd,
    estimatedProfitUsd: Number(
      (input.revenueUsd - input.variableCostUsd).toFixed(2),
    ),
    mrr: input.mrr ?? 0,
    arr: (input.mrr ?? 0) * 12,
  };
}

/** Contribution margin per sale from the primary product offer. */
export function primaryContributionMargin(context: BusinessContext): {
  usd: number;
  ratio: number;
} {
  const product = context.products[0];
  if (!product) return { usd: 0, ratio: 0 };
  const ratio = Math.max(0, Math.min(1, product.marginEstimate));
  return { usd: Number((product.priceUsd * ratio).toFixed(2)), ratio };
}

/** Build the financial state model the brain reasons over. */
export function buildBusinessModel(
  context: BusinessContext,
  observation: Observation,
): BusinessModel {
  const { usd, ratio } = primaryContributionMargin(context);
  const purchases = observation.money.purchases;
  const recurring = observation.money.mrr > 0;
  const stage: BusinessModel["monetizationStage"] = recurring
    ? "recurring"
    : purchases === 0
      ? "pre_revenue"
      : purchases < 25
        ? "early_sales"
        : "scaling";
  const fulfillmentReliable = observation.funnel.fulfillmentFailed === 0;
  const notes: string[] = [];
  if (usd <= 0) notes.push("No positive contribution margin configured.");
  if (!fulfillmentReliable) {
    notes.push("Fulfillment is failing; delivery must be fixed before growth.");
  }
  if (stage === "pre_revenue") {
    notes.push("Pre-revenue: prioritize the first stranger purchase.");
  }
  return {
    contributionMarginUsd: usd,
    contributionMarginRatio: ratio,
    monetizationStage: stage,
    unitEconomicsHealthy: usd > 0 && ratio >= 0.2,
    fulfillmentReliable,
    notes,
  };
}

/**
 * Dollar value of one incremental unit of a precursor metric. This is what
 * chains every non-money lever back to money. Uses observed conversion where
 * available, otherwise portable knowledge baselines.
 */
export function valuePerPrecursorUnit(
  metric: PrecursorMetric,
  business: BusinessModel,
  observation: Observation,
  intentTemperature: keyof typeof CONVERSION_BASELINES = "unknown",
): number {
  const cm = business.contributionMarginUsd;
  const landing = observation.funnel.landingViews;
  const purchases = observation.money.purchases;
  const checkouts = observation.funnel.checkouts;
  const observedConv = landing > 0 ? purchases / landing : 0;
  const conv = observedConv > 0 ? observedConv : CONVERSION_BASELINES[intentTemperature];
  const checkoutToPurchase =
    checkouts > 0 ? Math.min(1, purchases / checkouts) : 0.35;

  switch (metric) {
    case "revenue":
    case "contribution_profit":
      return 1;
    case "purchases":
      return cm;
    case "checkout_started":
      return cm * checkoutToPurchase;
    case "product_started":
      return cm * Math.max(conv, checkoutToPurchase * 0.4);
    case "landing_views":
      return cm * conv;
    case "repeat_rate":
      // One point of repeat rate ≈ another purchase from an existing buyer.
      // Worth nothing until there are buyers to repeat.
      return cm * purchases * 0.5;
    case "average_order_value":
      return purchases;
    case "margin":
      return Math.max(1, observation.money.revenueUsd) / 100;
    case "fulfillment_reliability":
      // Protecting delivery only has value once there is revenue to protect.
      // Assume a ~10% breakage risk on existing sales' margin.
      return cm * purchases * 0.1;
    default:
      return cm * conv;
  }
}

/**
 * Deepened unit economics. LTV, the CAC ceiling that keeps growth profitable,
 * payback, and the break-even visitor count that turns discovery into money.
 * These make ROI reasoning and owner asks concrete instead of hand-wavy.
 */
export function buildUnitEconomics(
  context: BusinessContext,
  observation: Observation,
  world: WorldModel,
): UnitEconomics {
  const cm = world.business.contributionMarginUsd;
  // Repeat purchases per buyer (0 until proven). Recurring stage assumes more.
  const expectedRepeats =
    world.business.monetizationStage === "recurring" ? 3 : 0;
  const ltvUsd = Number((cm * (1 + expectedRepeats)).toFixed(2));
  // Keep CAC under ~30% of LTV for a healthy 3:1 LTV:CAC.
  const cacCeilingUsd = Number((ltvUsd * 0.3).toFixed(2));
  const paybackOrders = 1;

  const landing = observation.funnel.landingViews;
  const purchases = observation.money.purchases;
  const observedConv = landing > 0 ? purchases / landing : 0;
  const conv =
    observedConv > 0
      ? observedConv
      : CONVERSION_BASELINES[
          world.shopper.intentTemperature === "unknown"
            ? "unknown"
            : world.shopper.intentTemperature
        ];
  const breakEvenVisitors = conv > 0 ? Math.ceil(1 / conv) : null;

  return { contributionMarginUsd: cm, ltvUsd, cacCeilingUsd, paybackOrders, breakEvenVisitors };
}
