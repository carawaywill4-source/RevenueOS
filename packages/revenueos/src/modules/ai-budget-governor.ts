/**
 * Central AI budget governor — every RevenueOS model call must pass through this.
 *
 * Bootstrap policy (until real revenue + explicit owner authorization):
 *   PAID AI BUDGET = $0
 *   DENY any request that would create paid usage.
 *   Complimentary/free calls only when evidence says they qualify.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/** Priority 1 = highest (customer/payment) … 10 = lowest (reporting). */
export type AiPriority = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/**
 * Narrow allowlist of complimentary-AI purposes.
 * Generic reasons like "needed" / "revenueos" are rejected.
 */
export const COMPLIMENTARY_AI_PURPOSES = [
  "acquisition_diagnosis",
  "channel_selection",
  "messaging_variant",
  "landing_page_diagnosis",
  "search_intent_analysis",
  "conversion_diagnosis",
  "experiment_selection",
] as const;

export type ComplimentaryAiPurpose = (typeof COMPLIMENTARY_AI_PURPOSES)[number];

export function isApprovedComplimentaryPurpose(
  purpose: unknown,
): purpose is ComplimentaryAiPurpose {
  return (
    typeof purpose === "string" &&
    (COMPLIMENTARY_AI_PURPOSES as readonly string[]).includes(purpose)
  );
}

export type AiCallJustification = {
  businessId?: string | null;
  /** portfolio | business | platform | repair */
  scope?: "portfolio" | "business" | "platform" | "repair";
  subsystem?: string;
  /**
   * Required approved purpose from COMPLIMENTARY_AI_PURPOSES.
   * This is the allowlist gate — not a free-form string.
   */
  purpose: ComplimentaryAiPurpose;
  /** Why this call needs model reasoning (not "tick fired"). */
  reason: string;
  priority?: AiPriority;
  /**
   * Fingerprint of commercial state. If identical to a recent reasoned state,
   * the governor reuses the cached decision and does not call the model.
   */
  stateHash?: string;
  /** Optional human-readable bottleneck / observation tags for metrics. */
  tags?: string[];
};

export type AiGovernorDecision =
  | { allow: true; billing: "complimentary" | "paid"; model: string; mode: AiGovernorMode }
  | {
      allow: false;
      code:
        | "paid_ai_disabled"
        | "paid_budget_exhausted"
        | "complimentary_unproven"
        | "complimentary_unusable"
        | "model_not_complimentary"
        | "priority_too_low"
        | "no_material_change"
        | "missing_justification"
        | "conservation_reserve"
        | "cache_reuse";
      reason: string;
      mode: AiGovernorMode;
      cached?: AiCachedDecision;
    };

export type AiGovernorMode =
  | "BOOTSTRAP"
  | "CONSERVATION"
  | "AI_DEGRADED_FREE_LIMIT"
  | "NORMAL";

export type AiCachedDecision = {
  stateHash: string;
  at: string;
  model: string;
  businessId: string | null;
  reason: string;
  /** Opaque prior model payload (JSON-serializable). */
  data: unknown;
  usage?: { input_tokens: number; output_tokens: number; total: number };
};

export type AiBudgetMetrics = {
  updatedAt: string;
  AI_CALLS: number;
  AI_TOKENS: number;
  AI_FREE_TOKENS: number;
  AI_PAID_COST_USD: number;
  AI_CALLS_AVOIDED_BY_CACHE: number;
  AI_CALLS_AVOIDED_BY_DETERMINISTIC_LOGIC: number;
  AI_CALLS_DENIED_PAID: number;
  AI_CALLS_DENIED_OTHER: number;
  REVENUE_ATTRIBUTED_TO_AI_ASSISTED_DECISIONS: number;
  lastCallAt: string | null;
  lastDenyAt: string | null;
  lastDenyCode: string | null;
  paidCostSinceGovernorEnabledUsd: number;
};

export type AiBudgetStatus = {
  bootstrapAiMode: boolean;
  paidAiAllowed: boolean;
  paidAiBudgetUsd: number;
  complimentaryProgram: "unknown" | "enrolled" | "not_enrolled";
  complimentaryUsable: boolean;
  /** Config flag before runtime paid-leak kill-switch. */
  complimentaryConfigUsable: boolean;
  runtimePaidFallthroughBlocked: boolean;
  dailyFreeSoftCap: number;
  complimentaryEligibleModels: string[];
  defaultModel: string;
  escalationModel: string;
  mode: AiGovernorMode;
  cacheActive: boolean;
  stateChangeTriggering: boolean;
  deterministicFirst: boolean;
  internetFirst: boolean;
  tokenLimitsActive: boolean;
  metrics: AiBudgetMetrics;
  note: string;
};

/** Models documented as eligible for OpenAI data-sharing complimentary daily tokens. */
export const COMPLIMENTARY_MINI_MODELS = [
  "gpt-5-mini",
  "gpt-5-nano",
  "gpt-4.1-mini",
  "gpt-4.1-nano",
  "gpt-4o-mini",
  "o1-mini",
  "o3-mini",
  "o4-mini",
  "codex-mini-latest",
] as const;

export const COMPLIMENTARY_FLAGSHIP_MODELS = [
  "gpt-5",
  "gpt-5-chat-latest",
  "gpt-4.1",
  "gpt-4o",
  "o1",
  "o3",
] as const;

const CACHE_TTL_MS = 6 * 60 * 60_000;
const MAX_CACHE = 400;
const DEFAULT_MAX_OUTPUT = 600;
/**
 * Soft daily free-token ceiling for background use.
 * Well below OpenAI mini complimentary quotas (2.5M–10M/day) so we stop
 * BEFORE the provider allowance is exhausted. The prepaid balance is a gate
 * reserve, not a spend budget.
 */
const DEFAULT_DAILY_FREE_SOFT_CAP = 500_000;
/**
 * Hard preflight cap on prompt size for complimentary calls.
 * Live evidence: small gpt-5-mini calls bill payer=openai; large strategist
 * prompts (~1.3k+ input tokens) bill payer=developer even with minimal
 * reasoning. Never send oversized prompts while paid AI is disabled.
 */
const DEFAULT_COMPLIMENTARY_MAX_INPUT_CHARS = 2_000;

/** Runtime kill-switch if provider bills developer while paid AI is disabled. */
let runtimeComplimentaryBlocked = false;
let runtimeComplimentaryBlockReason: string | null = null;

type GovernorConfig = {
  bootstrap: boolean;
  allowPaid: boolean;
  paidBudgetUsd: number;
  complimentaryProgram: "unknown" | "enrolled" | "not_enrolled";
  /** Owner-attested: enrolled AND positive prepaid balance AND project sharing on. */
  complimentaryUsable: boolean;
  dailyFreeSoftCap: number;
  complimentaryMaxInputChars: number;
  defaultModel: string;
  escalationModel: string;
};

function envBool(name: string, fallback: boolean): boolean {
  const v = process.env[name]?.trim();
  if (v == null || v === "") return fallback;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

function envNum(name: string, fallback: number): number {
  const v = process.env[name]?.trim();
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function readComplimentaryProgram(): "unknown" | "enrolled" | "not_enrolled" {
  const v = (
    process.env.OPENAI_COMPLIMENTARY_PROGRAM ||
    process.env.COMPLIMENTARY_TOKEN_PROGRAM ||
    "unknown"
  )
    .trim()
    .toLowerCase();
  if (v === "enrolled" || v === "yes" || v === "true" || v === "1") return "enrolled";
  if (v === "not_enrolled" || v === "no" || v === "false" || v === "0") {
    return "not_enrolled";
  }
  return "unknown";
}

export function loadAiGovernorConfig(): GovernorConfig {
  const bootstrap = envBool("BOOTSTRAP_AI_MODE", true);
  const allowPaid = envBool("ALLOW_PAID_AI", false);
  const paidBudgetUsd = envNum("PAID_AI_BUDGET_USD", 0);
  return {
    bootstrap,
    allowPaid: allowPaid && paidBudgetUsd > 0,
    paidBudgetUsd: allowPaid ? paidBudgetUsd : 0,
    complimentaryProgram: readComplimentaryProgram(),
    complimentaryUsable: envBool("OPENAI_COMPLIMENTARY_USABLE", false),
    dailyFreeSoftCap: envNum("AI_DAILY_FREE_SOFT_CAP", DEFAULT_DAILY_FREE_SOFT_CAP),
    complimentaryMaxInputChars: envNum(
      "AI_COMPLIMENTARY_MAX_INPUT_CHARS",
      DEFAULT_COMPLIMENTARY_MAX_INPUT_CHARS,
    ),
    defaultModel:
      process.env.REVENUEOS_LLM_MODEL ||
      process.env.OPENAI_MODEL ||
      "gpt-5-mini",
    escalationModel:
      process.env.REVENUEOS_STRATEGIST_MODEL ||
      process.env.OPENAI_STRATEGIST_MODEL ||
      "gpt-5-mini",
  };
}

function dataDir(): string {
  return (
    process.env.REVENUEOS_DATA_DIR ||
    process.env.REVENUEOS_DATA ||
    path.join(process.cwd(), ".data")
  );
}

function metricsPath(): string {
  return path.join(dataDir(), "ai-budget-metrics.json");
}

function cachePath(): string {
  return path.join(dataDir(), "ai-reasoning-cache.json");
}

function emptyMetrics(): AiBudgetMetrics {
  return {
    updatedAt: new Date().toISOString(),
    AI_CALLS: 0,
    AI_TOKENS: 0,
    AI_FREE_TOKENS: 0,
    AI_PAID_COST_USD: 0,
    AI_CALLS_AVOIDED_BY_CACHE: 0,
    AI_CALLS_AVOIDED_BY_DETERMINISTIC_LOGIC: 0,
    AI_CALLS_DENIED_PAID: 0,
    AI_CALLS_DENIED_OTHER: 0,
    REVENUE_ATTRIBUTED_TO_AI_ASSISTED_DECISIONS: 0,
    lastCallAt: null,
    lastDenyAt: null,
    lastDenyCode: null,
    paidCostSinceGovernorEnabledUsd: 0,
  };
}

let metrics: AiBudgetMetrics = emptyMetrics();
let metricsLoaded = false;
const cache = new Map<string, AiCachedDecision>();
let cacheLoaded = false;
let freeTokensToday = 0;
let freeTokensDayKey = utcDayKey();

function utcDayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function ensureLoaded() {
  if (!metricsLoaded) {
    metricsLoaded = true;
    try {
      if (existsSync(metricsPath())) {
        const raw = JSON.parse(readFileSync(metricsPath(), "utf8")) as AiBudgetMetrics;
        metrics = { ...emptyMetrics(), ...raw };
      }
    } catch {
      metrics = emptyMetrics();
    }
  }
  if (!cacheLoaded) {
    cacheLoaded = true;
    try {
      if (existsSync(cachePath())) {
        const arr = JSON.parse(readFileSync(cachePath(), "utf8")) as AiCachedDecision[];
        const cutoff = Date.now() - CACHE_TTL_MS;
        for (const row of arr) {
          if (Date.parse(row.at) >= cutoff) cache.set(row.stateHash, row);
        }
      }
    } catch {
      /* empty */
    }
  }
  const day = utcDayKey();
  if (day !== freeTokensDayKey) {
    freeTokensDayKey = day;
    freeTokensToday = 0;
  }
}

function persistMetrics() {
  ensureLoaded();
  metrics.updatedAt = new Date().toISOString();
  try {
    mkdirSync(dataDir(), { recursive: true });
    writeFileSync(metricsPath(), JSON.stringify(metrics, null, 2));
  } catch {
    /* non-fatal */
  }
}

function persistCache() {
  try {
    mkdirSync(dataDir(), { recursive: true });
    writeFileSync(cachePath(), JSON.stringify([...cache.values()].slice(-MAX_CACHE), null, 2));
  } catch {
    /* non-fatal */
  }
}

export function buildCommercialStateHash(parts: Record<string, unknown>): string {
  const normalized = JSON.stringify(parts, Object.keys(parts).sort());
  return createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}

export function isComplimentaryEligibleModel(model: string): boolean {
  const base = model.toLowerCase().split(":")[0] ?? model.toLowerCase();
  const all = [...COMPLIMENTARY_MINI_MODELS, ...COMPLIMENTARY_FLAGSHIP_MODELS];
  return all.some((m) => base === m || base.startsWith(`${m}-`));
}

export function pickGovernedModel(
  requested: string | undefined,
  priority: AiPriority,
  cfg: GovernorConfig = loadAiGovernorConfig(),
): string {
  const want = (requested || cfg.defaultModel).trim();
  // Bootstrap: never escalate to flagship unless complimentary usable AND high priority.
  if (!cfg.allowPaid) {
    if (
      cfg.complimentaryUsable &&
      priority <= 4 &&
      isComplimentaryEligibleModel(cfg.escalationModel) &&
      COMPLIMENTARY_FLAGSHIP_MODELS.some((m) =>
        cfg.escalationModel.toLowerCase().startsWith(m),
      )
    ) {
      // Still prefer mini for most work; only use escalation model if requested.
      if (want && isComplimentaryEligibleModel(want)) return want;
    }
    if (want && isComplimentaryEligibleModel(want)) return want;
    return cfg.defaultModel;
  }
  return want || cfg.defaultModel;
}

function complimentaryEffectivelyUsable(cfg: GovernorConfig): boolean {
  return cfg.complimentaryUsable && !runtimeComplimentaryBlocked;
}

function resolveMode(cfg: GovernorConfig): AiGovernorMode {
  if (cfg.bootstrap || !cfg.allowPaid) {
    if (!complimentaryEffectivelyUsable(cfg)) return "AI_DEGRADED_FREE_LIMIT";
    if (freeTokensToday >= cfg.dailyFreeSoftCap * 0.8) return "CONSERVATION";
    return "BOOTSTRAP";
  }
  return "NORMAL";
}

/**
 * Observe Responses API `billing.payer`.
 * - openai → complimentary (no prepaid draw)
 * - developer → paid; if ALLOW_PAID_AI=false, hard-block further model calls
 */
export function noteProviderBillingPayer(
  payer: string | null | undefined,
  meta?: { model?: string; requestId?: string },
): "complimentary" | "paid" | "unknown" {
  ensureLoaded();
  const normalized = String(payer ?? "")
    .trim()
    .toLowerCase();
  if (normalized === "openai") return "complimentary";
  if (normalized === "developer") {
    const cfg = loadAiGovernorConfig();
    if (!cfg.allowPaid) {
      runtimeComplimentaryBlocked = true;
      runtimeComplimentaryBlockReason =
        "OpenAI billing.payer=developer while PAID_AI_ALLOWED=false — complimentary fallthrough blocked; prepaid reserve protected";
      metrics.AI_CALLS_DENIED_PAID += 1;
      metrics.lastDenyAt = new Date().toISOString();
      metrics.lastDenyCode = "paid_ai_disabled";
      persistMetrics();
      try {
        console.warn(
          JSON.stringify({
            at: new Date().toISOString(),
            level: "warn",
            event: "ai.governor.paid_fallthrough_blocked",
            payer: normalized,
            model: meta?.model ?? null,
            requestId: meta?.requestId ?? null,
          }),
        );
      } catch {
        /* ignore */
      }
    }
    return "paid";
  }
  return "unknown";
}

/** Clear runtime paid-leak block (e.g. after operator restart / verified complimentary). */
export function clearComplimentaryRuntimeBlock(): void {
  runtimeComplimentaryBlocked = false;
  runtimeComplimentaryBlockReason = null;
}

/**
 * Record that deterministic / internet-first logic answered without an LLM.
 */
export function noteDeterministicAiAvoidance(count = 1): void {
  ensureLoaded();
  metrics.AI_CALLS_AVOIDED_BY_DETERMINISTIC_LOGIC += count;
  persistMetrics();
}

export function getCachedAiDecision(stateHash: string): AiCachedDecision | null {
  ensureLoaded();
  const hit = cache.get(stateHash);
  if (!hit) return null;
  if (Date.now() - Date.parse(hit.at) > CACHE_TTL_MS) {
    cache.delete(stateHash);
    return null;
  }
  return hit;
}

export function storeCachedAiDecision(entry: AiCachedDecision): void {
  ensureLoaded();
  cache.set(entry.stateHash, entry);
  while (cache.size > MAX_CACHE) {
    const first = cache.keys().next().value;
    if (first == null) break;
    cache.delete(first);
  }
  persistCache();
}

export function recordAiCallOutcome(input: {
  ok: boolean;
  billing: "complimentary" | "paid" | "none";
  usage?: { input_tokens: number; output_tokens: number; total: number };
  paidCostUsd?: number;
}): void {
  ensureLoaded();
  if (input.ok) {
    metrics.AI_CALLS += 1;
    metrics.lastCallAt = new Date().toISOString();
    const tokens = input.usage?.total ?? 0;
    metrics.AI_TOKENS += tokens;
    if (input.billing === "complimentary") {
      metrics.AI_FREE_TOKENS += tokens;
      freeTokensToday += tokens;
    }
    if (input.billing === "paid") {
      const cost = input.paidCostUsd ?? 0;
      metrics.AI_PAID_COST_USD += cost;
      metrics.paidCostSinceGovernorEnabledUsd += cost;
    }
  }
  persistMetrics();
}

/**
 * Authorize a model call. Does NOT perform the HTTP request.
 * Callers (only callOpenAI) must deny when allow=false.
 */
export function authorizeAiCall(input: {
  justification?: AiCallJustification | null;
  requestedModel?: string;
  /** Approximate prompt size (messages + schema) for complimentary preflight. */
  estimatedInputChars?: number;
}): AiGovernorDecision {
  ensureLoaded();
  const cfg = loadAiGovernorConfig();
  const mode = resolveMode(cfg);
  const j = input.justification;

  if (
    !j?.reason ||
    !String(j.reason).trim() ||
    !isApprovedComplimentaryPurpose(j.purpose)
  ) {
    metrics.AI_CALLS_DENIED_OTHER += 1;
    metrics.lastDenyAt = new Date().toISOString();
    metrics.lastDenyCode = "missing_justification";
    persistMetrics();
    return {
      allow: false,
      code: "missing_justification",
      reason:
        "AI governor: missing justification — require approved purpose " +
        `(${COMPLIMENTARY_AI_PURPOSES.join("|")}) plus a material reason`,
      mode,
    };
  }

  const priority = (j.priority ?? 9) as AiPriority;

  if (j.stateHash) {
    const hit = getCachedAiDecision(j.stateHash);
    if (hit) {
      metrics.AI_CALLS_AVOIDED_BY_CACHE += 1;
      persistMetrics();
      return {
        allow: false,
        code: "cache_reuse",
        reason: "AI governor: identical commercial state already reasoned — reusing cache",
        mode,
        cached: hit,
      };
    }
  }

  // Paid path only when explicitly authorized with budget.
  if (cfg.allowPaid && cfg.paidBudgetUsd > 0) {
    if (metrics.AI_PAID_COST_USD >= cfg.paidBudgetUsd) {
      metrics.AI_CALLS_DENIED_PAID += 1;
      metrics.lastDenyAt = new Date().toISOString();
      metrics.lastDenyCode = "paid_budget_exhausted";
      persistMetrics();
      return {
        allow: false,
        code: "paid_budget_exhausted",
        reason: `AI governor: paid budget exhausted ($${cfg.paidBudgetUsd})`,
        mode,
      };
    }
    const model = pickGovernedModel(input.requestedModel, priority, cfg);
    return { allow: true, billing: "paid", model, mode: "NORMAL" };
  }

  // Bootstrap / paid disabled: only complimentary with evidence.
  if (!complimentaryEffectivelyUsable(cfg)) {
    metrics.AI_CALLS_DENIED_PAID += 1;
    metrics.lastDenyAt = new Date().toISOString();
    const code =
      runtimeComplimentaryBlocked
        ? ("complimentary_unusable" as const)
        : cfg.complimentaryProgram === "unknown"
          ? ("complimentary_unproven" as const)
          : ("complimentary_unusable" as const);
    metrics.lastDenyCode = code;
    persistMetrics();
    return {
      allow: false,
      code,
      reason:
        runtimeComplimentaryBlockReason ??
        "AI governor: paid AI disabled; complimentary allowance not proven usable " +
          `(program=${cfg.complimentaryProgram}, usable=${cfg.complimentaryUsable}). ` +
          "OpenAI complimentary daily tokens require enrollment + positive prepaid balance; " +
          "with $0 paid budget we will not risk a billed request.",
      mode: "AI_DEGRADED_FREE_LIMIT",
    };
  }

  if (mode === "CONSERVATION" && priority > 5) {
    metrics.AI_CALLS_DENIED_OTHER += 1;
    metrics.lastDenyAt = new Date().toISOString();
    metrics.lastDenyCode = "conservation_reserve";
    persistMetrics();
    return {
      allow: false,
      code: "conservation_reserve",
      reason: "AI governor: CONSERVATION mode — reserve free tokens for high-priority decisions",
      mode,
    };
  }

  // Low-priority calls need an approved commercial purpose (already gated) plus
  // a non-generic reason. Purpose allowlist is the primary filter.
  if (
    priority >= 9 &&
    !(
      j.purpose === "acquisition_diagnosis" ||
      j.purpose === "channel_selection" ||
      j.purpose === "conversion_diagnosis" ||
      j.purpose === "experiment_selection" ||
      j.purpose === "landing_page_diagnosis" ||
      j.purpose === "search_intent_analysis" ||
      j.purpose === "messaging_variant"
    )
  ) {
    metrics.AI_CALLS_DENIED_OTHER += 1;
    metrics.lastDenyAt = new Date().toISOString();
    metrics.lastDenyCode = "priority_too_low";
    persistMetrics();
    return {
      allow: false,
      code: "priority_too_low",
      reason: "AI governor: priority too low for bootstrap free-token spend",
      mode,
    };
  }

  const model = pickGovernedModel(input.requestedModel, priority, cfg);
  if (!isComplimentaryEligibleModel(model)) {
    metrics.AI_CALLS_DENIED_PAID += 1;
    metrics.lastDenyAt = new Date().toISOString();
    metrics.lastDenyCode = "model_not_complimentary";
    persistMetrics();
    return {
      allow: false,
      code: "model_not_complimentary",
      reason: `AI governor: model ${model} is not on the complimentary eligible list — denied under $0 paid budget`,
      mode,
    };
  }

  const estimated = input.estimatedInputChars ?? 0;
  if (estimated > cfg.complimentaryMaxInputChars) {
    metrics.AI_CALLS_DENIED_PAID += 1;
    metrics.lastDenyAt = new Date().toISOString();
    metrics.lastDenyCode = "paid_ai_disabled";
    persistMetrics();
    return {
      allow: false,
      code: "paid_ai_disabled",
      reason:
        `AI governor: prompt ~${estimated} chars exceeds complimentary safe cap ` +
        `${cfg.complimentaryMaxInputChars} — denied preflight (large prompts observed as billing.payer=developer)`,
      mode,
    };
  }

  if (freeTokensToday >= cfg.dailyFreeSoftCap) {
    metrics.AI_CALLS_DENIED_OTHER += 1;
    metrics.lastDenyAt = new Date().toISOString();
    metrics.lastDenyCode = "conservation_reserve";
    persistMetrics();
    return {
      allow: false,
      code: "conservation_reserve",
      reason: "AI governor: daily complimentary soft cap reached — AI_DEGRADED_FREE_LIMIT",
      mode: "AI_DEGRADED_FREE_LIMIT",
    };
  }

  return { allow: true, billing: "complimentary", model, mode };
}

export function getAiBudgetStatus(): AiBudgetStatus {
  ensureLoaded();
  const cfg = loadAiGovernorConfig();
  const mode = resolveMode(cfg);
  return {
    bootstrapAiMode: cfg.bootstrap || !cfg.allowPaid,
    paidAiAllowed: cfg.allowPaid,
    paidAiBudgetUsd: cfg.paidBudgetUsd,
    complimentaryProgram: cfg.complimentaryProgram,
    complimentaryUsable: complimentaryEffectivelyUsable(cfg),
    complimentaryConfigUsable: cfg.complimentaryUsable,
    runtimePaidFallthroughBlocked: runtimeComplimentaryBlocked,
    dailyFreeSoftCap: cfg.dailyFreeSoftCap,
    complimentaryEligibleModels: [
      ...COMPLIMENTARY_MINI_MODELS,
      ...COMPLIMENTARY_FLAGSHIP_MODELS,
    ],
    defaultModel: cfg.defaultModel,
    escalationModel: cfg.escalationModel,
    mode,
    cacheActive: true,
    stateChangeTriggering: true,
    deterministicFirst: true,
    internetFirst: true,
    tokenLimitsActive: true,
    metrics: { ...metrics },
    note:
      mode === "AI_DEGRADED_FREE_LIMIT"
        ? runtimeComplimentaryBlockReason ??
          "Paid AI disabled; complimentary path unproven/unusable — generative limbs denied at governor; non-LLM brain continues"
        : mode === "CONSERVATION"
          ? "Complimentary soft-cap conservation — high-priority AI only"
          : mode === "BOOTSTRAP"
            ? "Bootstrap AI economy — complimentary-only when attested usable"
            : "Normal paid AI within budget",
  };
}

export function boundedMaxOutputTokens(requested?: number): number {
  const cap = envNum("AI_MAX_OUTPUT_TOKENS", DEFAULT_MAX_OUTPUT);
  if (requested == null) return Math.min(DEFAULT_MAX_OUTPUT, cap);
  return Math.min(requested, cap);
}

/** Test helper — reset in-memory governor state. */
export function __resetAiGovernorForTests(): void {
  metrics = emptyMetrics();
  metricsLoaded = true;
  cache.clear();
  cacheLoaded = true;
  freeTokensToday = 0;
  freeTokensDayKey = utcDayKey();
  runtimeComplimentaryBlocked = false;
  runtimeComplimentaryBlockReason = null;
}
