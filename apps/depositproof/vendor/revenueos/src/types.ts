/** Risk tier for an action the brain may request. */
export type ActionRisk = "safe" | "owner_gate" | "forbidden";

/** Where a lesson may be reused. Never includes end-user PII. */
/**
 * Hierarchical lesson scopes for similarity-aware transfer.
 * Narrower scopes override broader ones when conditions match.
 */
export type LessonScope =
  | "global"
  | "business_model"
  | "industry"
  | "audience"
  | "price_band"
  | "consideration"
  | "channel"
  | "business"
  | "product"
  | "site";

/** Commercial conditions under which a lesson or experiment ran. */
export type CommercialContext = {
  businessModel?: string;
  industry?: string;
  audience?: string;
  priceBand?: string;
  considerationLevel?: string;
  channel?: string;
  productId?: string;
  priceUsd?: number;
  marginEstimate?: number;
};

/** Whether a lesson encourages or discourages a pattern. */
export type LessonSentiment = "positive" | "negative" | "neutral";

export type ExperimentStatus =
  | "proposed"
  | "running"
  | "won"
  | "lost"
  | "abandoned"
  | "blocked";

/**
 * Every activity must connect to a measurable financial precursor. These are
 * the levers the brain is allowed to reason about — all of them chain to money.
 */
export type PrecursorMetric =
  | "revenue"
  | "contribution_profit"
  | "purchases"
  | "checkout_started"
  | "product_started"
  | "landing_views"
  | "repeat_rate"
  | "average_order_value"
  | "margin"
  | "fulfillment_reliability";

/** A category of lever. Used for prioritization and learning transfer. */
export type OpportunityCategory =
  | "acquisition"
  | "conversion"
  | "pricing"
  | "retention"
  | "operations";

export type FunnelStepStat = {
  step: string;
  count: number;
  dropFromPrevious: number | null;
  dropRate: number | null;
};

export type Bottleneck = {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  label: string;
  detail: string;
};

/** A predicted, dollar-denominated return for a candidate lever. */
export type PredictedImpact = {
  precursorMetric: PrecursorMetric;
  /** Expected incremental contribution profit over the signal window. */
  expectedProfitUsd: number;
  /** 0..1 belief the prediction holds. */
  confidence: number;
  /** 1 (trivial) .. 5 (heavy). */
  effort: number;
  costUsd: number;
  timeToSignalDays: number;
};

export type Opportunity = {
  id: string;
  title: string;
  metric: string;
  category?: OpportunityCategory;
  precursorMetric?: PrecursorMetric;
  expectedImpact: number;
  confidence: number;
  effort: number;
  score: number;
  action: string;
  /** When set, the executive may attempt this via the adapter if policy allows. */
  safeActionType?: string;
  /** Dollar ROI reasoning attached during prediction. */
  predicted?: PredictedImpact;
  /** Stable key used to match against lessons for learning transfer. */
  patternKey?: string;
};

/** A bounded external-planner recommendation. It may only select existing opportunities. */
export type PlannerDecision = {
  source: "ai" | "deterministic";
  rationale: string;
  evidence: string[];
  selectedOpportunityIds: string[];
  rejectedOpportunityIds: string[];
  falsifier: string;
  fallbackReason?: string;
  usage?: { inputTokens?: number; outputTokens?: number; estimatedCostUsd?: number };
};

/** Durable audit of one planner invocation within a cycle. */
export type PlannerRunRecord = {
  id: string;
  siteId: string;
  createdAt: string;
  source: "ai" | "deterministic";
  decision: PlannerDecision;
  inputFingerprint: string;
  policyRejected: boolean;
  policyReason?: string;
  linkedExperimentIds?: string[];
  linkedActionTypes?: string[];
};

/** Persisted cycle report for owner dashboards and email linkage. */
export type CycleReportRecord = {
  id: string;
  siteId: string;
  createdAt: string;
  observedAt: string;
  reportText: string;
  plannerSource?: "ai" | "deterministic";
  executedCount: number;
  emailDelivery?: {
    status: "pending" | "sent" | "failed" | "skipped";
    providerId?: string;
    skipReason?: string;
  };
};

/** Versioned site intervention for cohort attribution. */
export type ExposureRecord = {
  id: string;
  siteId: string;
  experimentId?: string;
  actionType: string;
  exposureKey: string;
  version: string;
  startedAt: string;
  endedAt?: string;
  metadata?: Record<string, string | number | boolean>;
};

/** Registry metadata for executable safe actions. */
export type ActionRegistryEntry = {
  type: string;
  exposureKey: string;
  cooldownMinutes?: number;
  rollbackActionType?: string;
  requiresCapability?: string;
};

/** Lifecycle of a published intent / discovery door. */
export type DiscoveryDoorStatus =
  | "active"
  | "expanding"
  | "holding"
  | "killed"
  | "graduated";

/** Furthest stage proven with available metrics (proxy-first until GSC). */
export type DiscoveryDoorStage =
  | "submitted"
  | "visited"
  | "product"
  | "cart"
  | "purchase"
  | "revenue"
  | "dead_on_arrival";

export type DiscoveryDoorVerdict = "expand" | "hold" | "kill" | "investigate";

/** On-site + optional search metrics for one door. */
export type DiscoveryDoorMetrics = {
  /** Weak signal: IndexNow/sitemap accepted (not true crawl proof). */
  submitted: boolean;
  topicViews: number;
  productViews: number;
  addToCarts: number;
  checkouts: number;
  purchases: number;
  revenueUsd: number;
  /** Real SERP metrics — null until search_console_analytics capability exists. */
  indexed?: boolean | null;
  impressions?: number | null;
  clicks?: number | null;
};

export type DiscoveryDoorScore = {
  scoredAt: string;
  windowDays: number;
  metrics: DiscoveryDoorMetrics;
  stage: DiscoveryDoorStage;
  verdict: DiscoveryDoorVerdict;
  reason: string;
};

/** A published discoverable page/cluster under governor control. */
export type DiscoveryDoor = {
  id: string;
  siteId: string;
  slug: string;
  url: string;
  query: string;
  clusterKey: string;
  publishedAt: string;
  status: DiscoveryDoorStatus;
  exposureKey?: string;
  experimentId?: string;
  investigateCount?: number;
  lastScore?: DiscoveryDoorScore;
  killedAt?: string;
  killReason?: string;
};

export type GovernorDecision = {
  doorId: string;
  clusterKey: string;
  verdict: DiscoveryDoorVerdict;
  stage: DiscoveryDoorStage;
  reason: string;
  suppressPublish: boolean;
};

export type CapabilityImportance = "low" | "medium" | "high" | "critical";

/** High-EV action the brain wants but cannot execute. */
export type CapabilityGap = {
  id: string;
  siteId: string;
  desiredAction: string;
  reason: string;
  expectedValueUsd: number;
  missingCapability: string;
  timesBlocked: number;
  businessesAffected: string[];
  importance: CapabilityImportance;
  firstSeenAt: string;
  lastSeenAt: string;
  patternKey?: string;
};

export type CapabilityGapSummary = {
  missingCapability: string;
  timesBlocked: number;
  expectedValueUsd: number;
  importance: CapabilityImportance;
  businessesAffected: string[];
  desiredActions: string[];
  recommendation: string;
};

export type ProductOffer = {
  id: string;
  name: string;
  priceUsd: number;
  marginEstimate: number;
};

export type BusinessContext = {
  siteId: string;
  displayName: string;
  industry: string;
  products: ProductOffer[];
  funnelSteps: string[];
  brandVoice: string;
  allowedChannels: string[];
  autonomousDailyCapUsd: number;
  timezone: string;
  constraints: string[];
  /**
   * Optional site-declared buyer segments. Partial — the brain fills gaps from
   * portable archetypes. Only `label` is required.
   */
  audienceSegments?: Array<Partial<AudiencePersona> & { label: string }>;
  /** Portfolio commercial context for portable learning / negative transfer. */
  commercial?: CommercialContext;
  /** Launch sequence index for learning-transfer experiments (1..N). */
  portfolioSequenceIndex?: number;
};

export type MoneyObservation = {
  revenueUsd: number;
  purchases: number;
  awaitingPayment: number;
  refunded: number;
  estimatedVariableCostUsd: number;
  estimatedProfitUsd: number;
  mrr: number;
  arr: number;
};

/** Last clock-hour money pulse. A $0 hour is treated as a moral failure + overdrive. */
export type HourPulse = {
  windowStart: string;
  windowEnd: string;
  revenueUsd: number;
  purchases: number;
  landingViews: number;
  checkouts: number;
  /** True when the last hour produced $0 revenue. */
  zeroHour: boolean;
};

export type HourVerdict = "won_hour" | "thin_hour" | "zero_hour";

export type HourPlanMove = {
  title: string;
  why: string;
  ownerGated?: boolean;
};

/** Concrete next-hour profit plan + confession if the last hour was empty. */
export type HourPlan = {
  hourVerdict: HourVerdict;
  lastHourRevenueUsd: number;
  lastHourPurchases: number;
  lastHourLandingViews: number;
  lastHourCheckouts: number;
  overdrive: boolean;
  confession: string;
  nextHourMoves: HourPlanMove[];
  /** Learned from the previous hour — quitting is never the conclusion. */
  learnedFromLastHour: string;
  /** Next hour must beat this revenue (last hour + $0.01, never coast). */
  nextHourBarUsd: number;
  neverGiveUp: true;
};

export type Observation = {
  observedAt: string;
  money: MoneyObservation;
  funnel: {
    steps: FunnelStepStat[];
    largestDrop: FunnelStepStat | null;
    landingViews: number;
    checkouts: number;
    fulfillmentFailed: number;
  };
  bottleneck: Bottleneck;
  /** Opaque window aggregates the adapter may attach for reporting. */
  rawWindows?: unknown;
  /** Last 60 minutes of money, if the adapter can observe it. */
  hourPulse?: HourPulse;
  openExperimentIds: string[];
  errors: string[];
};

/**
 * Structured, portable market intelligence a site can optionally provide. The
 * brain never scrapes; the adapter supplies whatever it can observe legally.
 */
export type MarketSignals = {
  competitors?: Array<{
    name: string;
    strength?: "low" | "moderate" | "high";
    note?: string;
  }>;
  indexCoverage?: { knownUrls: number; indexedUrls?: number };
  channels?: Array<{
    channel: string;
    status: "open" | "owner_gate" | "blocked";
    note?: string;
  }>;
  demandNotes?: string[];
};

export type BusinessModel = {
  contributionMarginUsd: number;
  contributionMarginRatio: number;
  monetizationStage:
    | "pre_revenue"
    | "early_sales"
    | "scaling"
    | "recurring";
  unitEconomicsHealthy: boolean;
  fulfillmentReliable: boolean;
  notes: string[];
};

export type MarketModel = {
  demandProxy: "unknown" | "weak" | "emerging" | "healthy";
  discoveryCoverage: "none" | "thin" | "growing" | "broad";
  competitivePressure: "unknown" | "low" | "moderate" | "high";
  channelReadiness: Array<{
    channel: string;
    status: "open" | "owner_gate" | "blocked";
    note?: string;
  }>;
  notes: string[];
};

export type ShopperModel = {
  primaryFriction:
    | "trust"
    | "clarity"
    | "price"
    | "effort"
    | "discovery"
    | "none";
  intentTemperature: "cold" | "warm" | "hot" | "unknown";
  frictionHypotheses: string[];
  notes: string[];
};

/**
 * A buyer archetype ("stereotype") — a transferable model of who buys and why.
 * Portable across sites; never contains individual end-user PII.
 */
export type AudiencePersona = {
  id: string;
  label: string;
  /** Enduring characteristics (e.g. "price-sensitive", "time-poor"). */
  traits: string[];
  /** Behavioral habits (how/when/where they shop and decide). */
  habits: string[];
  /** Channel keys where this persona congregates. */
  channels: string[];
  /** What flips them from browsing to buying now. */
  triggers: string[];
  /** What stops the sale (to be neutralized truthfully). */
  objections: string[];
  /** Truthful messaging angles that resonate. */
  messagingAngles: string[];
  intentTemperature: "cold" | "warm" | "hot";
};

/** A zero-spend, in-policy acquisition channel the brain knows how to work. */
export type AcquisitionChannel = {
  key: string;
  label: string;
  /** Buyer intent typically found here. */
  intent: "high" | "medium" | "low";
  precursor: PrecursorMetric;
  effort: number;
  needsOwner: boolean;
  /** Portable how-to for working the channel legally and truthfully. */
  playbook: string;
};

/** A concrete acquisition move: a channel worked for a specific persona. */
export type ChannelPlay = {
  channel: string;
  persona: string;
  intent: "high" | "medium" | "low";
  precursor: PrecursorMetric;
  angle: string;
  /** Index of the chosen messaging angle (arm) for learning attribution. */
  angleIndex: number;
  effort: number;
  needsOwner: boolean;
  /** 0..1 static persona↔channel fit. */
  fit: number;
  /** Fit after folding in learned win-rate for this exact arm. */
  learnedFit: number;
  /** acq:{channel}:{persona}:a{angleIndex} — the finest money-making unit. */
  patternKey: string;
  rationale: string;
};

/**
 * Who we are selling to, where to reach them, and how hard the sale is. A hard
 * sell is not an excuse — it raises resolve (see resolveMultiplier).
 */
export type AudienceModel = {
  personas: AudiencePersona[];
  channelPlan: ChannelPlay[];
  /** 0 (sells itself) .. 1 (brutally hard). */
  salesDifficulty: number;
  difficultyReasons: string[];
  /** 1 (easy) .. 2 (hard) — how much harder the brain pushes on a hard sell. */
  resolveMultiplier: number;
  notes: string[];
};

export type WorldModel = {
  business: BusinessModel;
  market: MarketModel;
  shopper: ShopperModel;
  audience: AudienceModel;
};

export type Hypothesis = {
  id: string;
  title: string;
  metric: string;
  predictedDelta: string;
  confidence: number;
  effort: number;
  expectedImpact: number;
  action: string;
  safeActionType?: string;
  constraintsChecked: string[];
  category?: OpportunityCategory;
  precursorMetric?: PrecursorMetric;
  patternKey?: string;
};

export type SafeAction = {
  type: string;
  risk: ActionRisk;
  description: string;
  payload?: Record<string, string | number | boolean | string[]>;
  /** Stable key for exposure cohorts when this action mutates live site state. */
  exposureKey?: string;
};

export type ActionResult = {
  ok: boolean;
  detail: string;
  costUsd?: number;
  /** Exposure key written when the action changed live site state. */
  exposureKey?: string;
  exposureVersion?: string;
};

/** Plan describing how an experiment will be measured and when. */
export type MeasurementPlan = {
  metric: PrecursorMetric;
  baselineValue: number;
  targetDelta: number;
  timeToSignalDays: number;
  scheduledCheckAt: string;
};

export type Experiment = {
  id: string;
  siteId: string;
  status: ExperimentStatus;
  hypothesis: Hypothesis;
  actions: Array<{
    type: string;
    payload?: Record<string, unknown>;
    result?: ActionResult;
    at: string;
  }>;
  predictedOutcome: string;
  actualOutcome?: string;
  category?: OpportunityCategory;
  predicted?: PredictedImpact;
  measurement?: MeasurementPlan;
  attributionId?: string;
  lessonId?: string;
  createdAt: string;
  updatedAt: string;
  endedAt?: string;
};

export type Lesson = {
  id: string;
  scope: LessonScope;
  siteId?: string;
  industry?: string;
  patternKey: string;
  summary: string;
  evidenceCount: number;
  transferable: boolean;
  sentiment?: LessonSentiment;
  /** Multiplier applied to matching opportunities when ranking (default 1). */
  rankingWeight?: number;
  /** Do not retry the matching pattern until this ISO timestamp. */
  cooldownUntil?: string;
  /** Sites that contributed evidence (portable industry/global lessons). */
  originSiteIds?: string[];
  /** Conditions under which this lesson applies — used to prevent negative transfer. */
  commercial?: CommercialContext;
  createdAt: string;
  updatedAt: string;
};

/** Operating regime when a business has zero paying customers. */
export type FirstCustomerMode = {
  active: boolean;
  reason: string;
  priority: "buyer_exposure";
  /** Boost pattern keys that can put a real buyer in front of the offer. */
  preferredActionTypes: string[];
};

export type PortfolioBusinessSnapshot = {
  siteId: string;
  displayName: string;
  sequenceIndex: number;
  revenueUsd: number;
  contributionProfitUsd: number;
  purchases: number;
  landingViews: number;
  activePursuits: number;
  waitingForEvidence: number;
  claimableBacklog: number;
  firstCustomerMode: boolean;
  profitPerVisitor: number;
  marginalEvProxy: number;
  learningValue: number;
};

export type PortfolioAllocation = {
  generatedAt: string;
  businesses: PortfolioBusinessSnapshot[];
  /** siteIds ordered by where the next unit of effort is most valuable. */
  effortOrder: string[];
  notes: string[];
};

export type AttributionVerdict = "won" | "lost" | "inconclusive";

export type Attribution = {
  id: string;
  experimentId: string;
  siteId: string;
  metric: PrecursorMetric;
  baselineValue: number;
  postValue: number;
  delta: number;
  verdict: AttributionVerdict;
  confidence: number;
  createdAt: string;
};

/** Deepened unit economics used for ROI, CAC ceilings, and owner asks. */
export type UnitEconomics = {
  contributionMarginUsd: number;
  ltvUsd: number;
  cacCeilingUsd: number;
  paybackOrders: number;
  breakEvenVisitors: number | null;
};

/** Per-pattern explore/exploit posterior derived from experiment history. */
export type BanditStat = {
  patternKey: string;
  trials: number;
  wins: number;
  losses: number;
  posteriorWinRate: number;
};

/** How well past predictions matched reality, per category. */
export type CalibrationCell = {
  samples: number;
  predictedWinRate: number;
  actualWinRate: number;
  brier: number;
  factor: number;
};

export type CalibrationModel = {
  byCategory: Partial<Record<OpportunityCategory, CalibrationCell>>;
  overall: CalibrationCell;
};

/** Trajectory model built from the scorecard history. */
export type Forecast = {
  revenueSlopePerCycle: number;
  trafficSlopePerCycle: number;
  cyclesToFirstSale: number | null;
  /** Rough cycles to north-star day at current profit slope (null if unknown). */
  cyclesToNorthStar?: number | null;
  decelerating: boolean;
  note: string;
};

/** A detected sudden regression in a money precursor. */
export type Anomaly = {
  metric: string;
  previous: number;
  current: number;
  dropPct: number;
  severity: "low" | "medium" | "high";
  note: string;
};

/** One ordered move in a coherent multi-step plan. */
export type StrategyStep = {
  order: number;
  opportunityId: string;
  title: string;
  category?: OpportunityCategory;
  precursorMetric?: PrecursorMetric;
  expectedProfitUsd: number;
  horizonProfitUsd: number;
  rationale: string;
  blockedBy?: string;
};

/** A sequenced plan across cycles, respecting funnel dependencies. */
export type Strategy = {
  steps: StrategyStep[];
  projectedProfitUsd: number;
  horizonNote: string;
};

/** One funded line in the machine's money plan. */
export type MoneyPlanItem = {
  opportunityId: string;
  title: string;
  category?: OpportunityCategory;
  precursorMetric?: PrecursorMetric;
  effort: number;
  /** Credible monthly contribution profit if the lever performs as predicted. */
  projectedMonthlyProfitUsd: number;
  /** Monthly profit per unit of effort — the allocation ranking key. */
  profitPerEffort: number;
  patternKey?: string;
};

/**
 * The machine's plan to make money this cycle: a portfolio of levers allocated
 * by profit-per-effort under an effort budget, with a credible projected
 * monthly profit and a router for where the cheapest next dollar lives.
 */
export type MoneyPlan = {
  items: MoneyPlanItem[];
  totalProjectedMonthlyProfitUsd: number;
  effortBudget: number;
  effortUsed: number;
  /** Where the cheapest incremental dollar is right now. */
  marginalDollar: string;
  note: string;
};

/** Won only when contribution profit clears the $10k-day north star. */
export type DayVerdict = "won_day" | "lost_day";

/** Reverse-engineered requirements to hit the north-star day. */
export type NorthStarPath = {
  northStarDailyProfitUsd: number;
  ordersNeeded: number;
  visitorsNeeded: number;
  requiredConversionRate: number | null;
  contributionMarginUsd: number;
  bottleneckToClose: string;
  note: string;
};

/** Accounting for a day under (or over) the north star. */
export type ShortfallReport = {
  northStarDailyProfitUsd: number;
  currentProfitUsd: number;
  shortfallUsd: number;
  pctOfNorthStar: number;
  dayVerdict: DayVerdict;
  rootCause: string;
  lessonPatternKey: string;
  learningImperative: string;
};

export type GrowthRegime =
  | "pre_revenue"
  | "stagnation"
  | "breakout"
  | "compounding"
  | "decline";

export type RegimeReport = {
  regime: GrowthRegime;
  confidence: number;
  note: string;
};

/** Meta-policy: how hard to explore vs exploit this cycle. */
export type MetaPolicy = {
  explorationLambda: number;
  exploitBias: number;
  alwaysLearning: boolean;
  reason: string;
};

/** Active-learning curriculum: what information closes the shortfall fastest. */
export type Curriculum = {
  priority: string;
  focusCategory: OpportunityCategory;
  rationale: string;
  informationGap: string;
};

/**
 * Competitive drive aimed at a $10,000 contribution-profit day. Record-beating
 * stretch is secondary while under the north star; every lost day escalates
 * aggression and learning. It is never satisfied.
 */
export type Ambition = {
  currentProfitUsd: number;
  /** Best contribution profit ever recorded (the bar to obliterate). */
  recordProfitUsd: number;
  recordRevenueUsd: number;
  /** Stretch target — north star until cleared, then multiples of the record. */
  targetProfitUsd: number;
  /** target − current. Positive means behind and dissatisfied. */
  gapToTargetUsd: number;
  onPace: boolean;
  /** 0 = crushing the target, 3 = maximum aggression (far behind). */
  aggression: 0 | 1 | 2 | 3;
  /** Consecutive non-declining profit cycles. */
  streak: number;
  /** How many parallel bets the brain will fire this cycle. */
  concurrentBets: number;
  /** Blunt, never-satisfied assessment. */
  verdict: string;
  /** Absolute daily north star (default $10,000). */
  northStarDailyProfitUsd: number;
  /** max(0, northStar − current). */
  shortfallUsd: number;
  dayVerdict: DayVerdict;
  /** True whenever under the north star or stretch — keep adjusting. */
  alwaysLearning: boolean;
  /** Quitting is not an option. Always true. */
  neverGiveUp?: true;
  /** True when the last clock hour produced $0 revenue — max overdrive. */
  overdrive?: boolean;
  hourVerdict?: HourVerdict;
  path?: NorthStarPath;
};

export type Scorecard = {
  generatedAt: string;
  siteId: string;
  revenueUsd: number;
  contributionProfitUsd: number;
  purchases: number;
  landingViews: number;
  visitorToPurchase: number | null;
  experimentsWon: number;
  experimentsLost: number;
  openExperiments: number;
  failures: number;
  confidence: number;
  bottleneckLevel: number;
  nextAction: string;
  topOpportunities: Opportunity[];
  /** Sum of expected profit across open, measured experiments. */
  expectedProfitPipelineUsd: number;
  attributionsClosed: number;
  /** Human-readable summary of how behavior changed this cycle. */
  learningDelta: string;
  /** Present when the brain is stuck and self-diagnosing. */
  diagnosis?: string;
  unitEconomics?: UnitEconomics;
  forecast?: Forecast;
  /** Mean absolute prediction calibration error, 0 = perfectly calibrated. */
  calibrationBrier?: number;
  anomalyCount?: number;
  projectedProfitUsd?: number;
  ambition?: Ambition;
  /** Headline: credible projected monthly contribution profit from the plan. */
  projectedMonthlyProfitUsd?: number;
  shortfall?: ShortfallReport;
  regime?: RegimeReport;
  metaPolicy?: MetaPolicy;
  curriculum?: Curriculum;
  hourPlan?: HourPlan;
};

/** Persistent Revenue Pursuit Engine job states. */
export type PursuitState =
  | "DISCOVER"
  | "QUALIFY"
  | "EXECUTE"
  | "WAITING_FOR_EVIDENCE"
  | "ATTRIBUTE"
  | "LEARN"
  | "REPLENISH"
  | "DONE"
  | "FAILED";

export type PursuitKind =
  | "organic_revenue"
  | "discovery_door"
  | "conversion"
  | "ops";

export type PursuitEventType =
  | "enqueued"
  | "claimed"
  | "executed"
  | "wait"
  | "attributed"
  | "learned"
  | "replenished"
  | "failed"
  | "done";

/** Durable organic revenue work item — waiting jobs do not idle the operator. */
export type PursuitJob = {
  id: string;
  siteId: string;
  state: PursuitState;
  kind: PursuitKind;
  patternKey?: string;
  actionType?: string;
  priority: number;
  effort: number;
  experimentId?: string;
  opportunityId?: string;
  idempotencyKey: string;
  leaseOwner?: string | null;
  leaseUntil?: string | null;
  notBefore?: string | null;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  title: string;
  action: string;
  channel?: string;
  persona?: string;
  workSummary?: string;
  hypothesis?: Hypothesis;
  predicted?: PredictedImpact;
  createdAt: string;
  updatedAt: string;
};

export type PursuitEvent = {
  id: string;
  pursuitId: string;
  siteId: string;
  eventType: PursuitEventType;
  detail: Record<string, unknown>;
  createdAt: string;
};

export type PursuitLease = {
  id: string;
  siteId: string;
  kind: string;
  leaseUntil: string;
  document?: Record<string, unknown>;
  createdAt: string;
};

/** Hourly Owner Report — work done, not wake-up checklist. */
export type OwnerReportSummary = {
  siteId: string;
  windowStart: string;
  windowEnd: string;
  actionsAttempted: number;
  actionsCompleted: number;
  experimentsLaunched: number;
  experimentsStillMeasuring: number;
  attributionsClosed: number;
  lessonsLearned: number;
  doorsKilled: number;
  doorsExpanded: number;
  activePursuits: number;
  waitingForEvidence: number;
  blockedOrFailed: number;
  claimableBacklog: number;
  workLines: string[];
  ownerAsks: string[];
  nextQueue: string[];
  /** Audiences / intent queries pursued this hour. */
  audiencesPursued: string[];
  /** Published / distributed / contacted / tested surfaces. */
  distributionLines: string[];
  /** What changed because of learning. */
  learningChanges: string[];
  /** Where portfolio effort moves next. */
  effortNext: string[];
  firstCustomerMode: boolean;
  firstCustomerStage?: string;
  hourCheckouts: number;
  /** True when profit is zero, capacity existed, and almost no work progressed. */
  operationalFailure: boolean;
  operationalFailureReason?: string;
  hourRevenueUsd: number;
  hourPurchases: number;
  hourLandingViews: number;
};

export type CycleResult = {
  observedAt: string;
  observation: Observation;
  world: WorldModel;
  hypotheses: Hypothesis[];
  opportunities: Opportunity[];
  executed: Array<{ action: SafeAction; result: ActionResult }>;
  experimentsTouched: Experiment[];
  attributions: Attribution[];
  lessons: Lesson[];
  scorecard: Scorecard;
  unitEconomics: UnitEconomics;
  forecast: Forecast;
  calibration: CalibrationModel;
  strategy: Strategy;
  anomalies: Anomaly[];
  ambition: Ambition;
  moneyPlan: MoneyPlan;
  shortfall: ShortfallReport;
  regime: RegimeReport;
  metaPolicy: MetaPolicy;
  curriculum: Curriculum;
  hourPlan: HourPlan;
  pursuitsEnqueued?: number;
  pursuitsAdvanced?: number;
  /** Cycle order: money made for the customer is the only success. */
  profitMandate?: {
    northStarDailyProfitUsd: number;
    currentProfitUsd: number;
    shortfallUsd: number;
    pctOfNorthStar: number;
    focus: string;
    ordersNeeded: number;
    visitorsNeeded: number;
    contributionMarginUsd: number;
    order: string;
    why: string;
    falsifier: string;
    heartbeatActionTypes: string[];
    successDeclaration: string;
    failurePressure: number;
  };
  /** Organic mastery era — ads locked until leads→sales is a weapon. */
  organicMastery?: {
    level: string;
    score: number;
    mission: string;
    adsReadiness: string;
    drills: string[];
    gaps: string[];
    verdict: string;
  };
  plannerDecision?: PlannerDecision;
  governorDecisions?: GovernorDecision[];
  capabilityGaps?: CapabilityGap[];
  publishAllowed?: boolean;
  reportText: string;
};
