import { buildBusinessModel } from "./modules/economics";
import { buildShopperModel } from "./modules/conversion";
import { buildAudienceModel } from "./modules/audience";
import { buildMarketModel } from "./market/model";
import type {
  BanditStat,
  BusinessContext,
  MarketSignals,
  Observation,
  WorldModel,
} from "./types";

/**
 * Compose the three portable models the executive reasons over. Pure function of
 * context + observation + optional market signals — no site imports.
 */
export function buildWorldModel(input: {
  context: BusinessContext;
  observation: Observation;
  signals?: MarketSignals;
  banditStats?: Map<string, BanditStat>;
}): WorldModel {
  const business = buildBusinessModel(input.context, input.observation);
  const market = buildMarketModel(input);
  const shopper = buildShopperModel(input.observation);
  const audience = buildAudienceModel({
    context: input.context,
    observation: input.observation,
    world: { business, market, shopper },
    signals: input.signals,
    banditStats: input.banditStats,
  });
  return { business, market, shopper, audience };
}
