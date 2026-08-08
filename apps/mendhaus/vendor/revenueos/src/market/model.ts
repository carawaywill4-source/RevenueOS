import type {
  BusinessContext,
  MarketModel,
  MarketSignals,
  Observation,
} from "../types";

/**
 * Build a portable market model from what the adapter can legally observe plus
 * funnel evidence. The brain never scrapes competitor sites; it reasons over
 * structured signals the site chooses to share.
 */
export function buildMarketModel(input: {
  context: BusinessContext;
  observation: Observation;
  signals?: MarketSignals;
}): MarketModel {
  const { context, observation, signals } = input;
  const landing = observation.funnel.landingViews;
  const purchases = observation.money.purchases;

  const demandProxy: MarketModel["demandProxy"] =
    purchases > 0
      ? "healthy"
      : landing >= 200
        ? "emerging"
        : landing >= 30
          ? "weak"
          : "unknown";

  const coverage = signals?.indexCoverage;
  const discoveryCoverage: MarketModel["discoveryCoverage"] = coverage
    ? coverage.indexedUrls === undefined
      ? coverage.knownUrls > 20
        ? "growing"
        : "thin"
      : coverage.indexedUrls === 0
        ? "none"
        : coverage.indexedUrls < coverage.knownUrls * 0.5
          ? "thin"
          : coverage.indexedUrls < coverage.knownUrls
            ? "growing"
            : "broad"
    : landing < 30
      ? "thin"
      : "growing";

  const competitors = signals?.competitors ?? [];
  const strong = competitors.filter((c) => c.strength === "high").length;
  const competitivePressure: MarketModel["competitivePressure"] =
    competitors.length === 0
      ? "unknown"
      : strong >= 2
        ? "high"
        : strong >= 1
          ? "moderate"
          : "low";

  const declared = signals?.channels ?? [];
  const channelReadiness =
    declared.length > 0
      ? declared
      : context.allowedChannels.map((channel) => ({
          channel,
          status: "open" as const,
        }));

  const notes: string[] = [];
  if (signals?.demandNotes) notes.push(...signals.demandNotes);
  if (demandProxy === "unknown") {
    notes.push("Demand is unproven; discovery must generate qualified visitors.");
  }
  if (discoveryCoverage === "none" || discoveryCoverage === "thin") {
    notes.push("Discovery coverage is thin; strangers can barely find the offer.");
  }

  return {
    demandProxy,
    discoveryCoverage,
    competitivePressure,
    channelReadiness,
    notes,
  };
}
