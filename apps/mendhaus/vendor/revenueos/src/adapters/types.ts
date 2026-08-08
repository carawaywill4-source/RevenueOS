import type {
  ActionResult,
  BusinessContext,
  MarketSignals,
  Observation,
  Opportunity,
  PrecursorMetric,
  SafeAction,
} from "../types";
import type { SeedLesson } from "../ledger/seed";
import type { ExperimentStore } from "../ledger/store";

/**
 * Portable plug. Every site — TributeReady, Riley, any future customer —
 * implements this and nothing else. The brain never imports a product's CMS,
 * payment, page, or domain modules. Site-specific facts enter ONLY through this
 * interface, so onboarding customer #2 means "implement SiteAdapter", never
 * "fork the brain".
 */
export interface SiteAdapter {
  id: string;
  getContext(): Promise<BusinessContext>;
  observe(): Promise<Observation>;
  listSafeActions(): SafeAction[] | Promise<SafeAction[]>;
  execute(action: SafeAction): Promise<ActionResult>;
  getExperimentStore(): ExperimentStore;

  /** Optional opportunities the site already knows about (marketplace, etc.). */
  listSiteOpportunities?(input: {
    observation: Observation;
  }): Promise<Array<Omit<Opportunity, "score">>>;

  /** Optional structured market/competitor intelligence (no scraping by brain). */
  getMarketSignals?(): Promise<MarketSignals>;

  /**
   * Optional precise read of a single precursor metric for attribution. When
   * absent, the brain derives the value from the latest Observation.
   */
  getMeasurement?(metric: PrecursorMetric): Promise<number | null>;

  /** Optional site/industry lessons to seed the ledger on first run. */
  getSeedLessons?(): SeedLesson[] | Promise<SeedLesson[]>;
}
