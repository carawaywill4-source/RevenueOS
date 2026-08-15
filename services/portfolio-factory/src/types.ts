/** Durable portfolio factory record — one row per target business. */

export type PortfolioType = "cashflow" | "empire";

export type PortfolioStage =
  | "QUEUED"
  | "RESEARCHING"
  | "DESIGNING"
  | "BUILDING"
  | "TESTING"
  | "DEPLOYING"
  | "VERIFYING"
  | "LIVE"
  | "FAILED"
  | "RETRY"
  | "RETIRED";

export type StripeProductStatus = "none" | "pending" | "configured" | "live";
export type DeploymentStatus = "none" | "pending" | "deployed" | "live";
export type RevenueOsStatus = "none" | "registered" | "heartbeat_ok" | "live";
export type BuildStatus = "none" | "scaffolded" | "built" | "tested";
export type TestStatus = "none" | "local_ok" | "production_ok" | "live_verified";

export type PortfolioCompanyRecord = {
  id: string;
  name: string;
  portfolio_type: PortfolioType;
  market: string;
  customer: string;
  pain: string;
  offer: string;
  price_model: string;
  initial_price: number;
  fulfillment_type: string;
  acquisition_hypotheses: string[];
  seo_topics: string[];
  aeo_topics: string[];
  required_pages: string[];
  required_apis: string[];
  stripe_product_status: StripeProductStatus;
  deployment_status: DeploymentStatus;
  revenueos_status: RevenueOsStatus;
  build_status: BuildStatus;
  test_status: TestStatus;
  current_stage: PortfolioStage;
  failure_reason?: string;
  retry_count: number;
  production_url?: string;
  stripe_price_id?: string;
  empire_ladder?: string[];
  last_updated: string;
  live_verified_at?: string;
};

export type PortfolioManifest = {
  version: 1;
  created_at: string;
  updated_at: string;
  objective: {
    cashflow_live: number;
    empire_live: number;
    total_live: number;
  };
  checkpoint_count: number;
  last_checkpoint_at?: string;
  companies: PortfolioCompanyRecord[];
  worker?: {
    pid: number;
    started_at: string;
    last_company_id?: string;
    last_heartbeat_at?: string;
  };
};

export type ProductionValidation = {
  ok: boolean;
  production_url: string;
  home_status?: number;
  brand_hit?: boolean;
  product_hit?: boolean;
  checkout_route_present?: boolean;
  checkout_live?: boolean;
  fulfillment_assets?: boolean;
  heartbeat_ok?: boolean;
  attribution_ok?: boolean;
  detail: string;
  checks: Record<string, boolean | number | string | undefined>;
};

export const MAX_RETRY = 3;

export const DEFAULT_REQUIRED_PAGES = [
  "/",
  "/legal/terms",
  "/legal/privacy",
  "/legal/refunds",
  "/success",
];

export const DEFAULT_REQUIRED_APIS = [
  "/api/checkout",
  "/api/stripe/webhook",
  "/api/download",
  "/api/beacon",
  "/api/cron/revenueos",
];
