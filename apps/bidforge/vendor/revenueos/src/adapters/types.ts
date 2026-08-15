import type {
  ActionResult,
  BusinessContext,
  DiscoveryDoor,
  DiscoveryDoorMetrics,
  MarketSignals,
  MoneyPlan,
  Observation,
  Opportunity,
  PlannerDecision,
  PrecursorMetric,
  SafeAction,
  ShortfallReport,
} from "../types";
import type { SeedLesson } from "../ledger/seed";
import type { ExperimentStore } from "../ledger/store";
import type { ProfitMandate } from "../modules/profit-maximizer";
import type { OrganicMasteryReport } from "../modules/organic-mastery";

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

  /**
   * Optional bounded AI planner supplied by the host app. The shared executor
   * validates every selected id against the opportunities it already produced.
   */
  planDecision?(input: {
    observation: Observation;
    opportunities: Opportunity[];
    safeActions: SafeAction[];
    shortfall?: ShortfallReport;
    moneyPlan?: MoneyPlan;
    profitMandate?: ProfitMandate;
    organicMastery?: OrganicMasteryReport;
  }): Promise<PlannerDecision>;

  /** Published discovery doors under governor control. */
  listDiscoveryDoors?(): Promise<DiscoveryDoor[]>;

  /** Measure on-site (and optional search) metrics for one door. */
  measureDiscoveryDoor?(door: DiscoveryDoor): Promise<DiscoveryDoorMetrics>;

  /** Explicitly declare limbs the site cannot execute yet. */
  listUnavailableCapabilities?(): Promise<
    Array<{ capability: string; reason: string }>
  >;

  /** Retire a killed discovery door so it stops receiving investment. */
  retireDiscoveryDoor?(doorId: string, reason: string): Promise<ActionResult>;

  /**
   * Durable count of buyer leads this site currently knows about. Consumed by
   * the exploration floor to force `buyer_discovery` in FCM cycles that have
   * nothing for external pursuit limbs to work with.
   */
  getBuyerLeadCount?(): Promise<number>;
}
