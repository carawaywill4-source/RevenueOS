/**
 * Zero-dependency OpenAI client (uses global fetch).
 *
 * Thin deterministic surface: structured-JSON output, per-call timeout,
 * bounded retries for rate limits, and precise degradation codes.
 *
 * Every model request MUST pass the central AI budget governor first.
 * In bootstrap mode (PAID_AI_BUDGET=$0) the governor denies any call that
 * would create paid usage; complimentary calls require attested evidence.
 *
 * RevenueOS must keep operating without OpenAI — but must NOT pretend full
 * intelligence is available when the provider is degraded, and must NOT
 * collapse every 429 into "no_credits".
 */

import {
  authorizeAiCall,
  boundedMaxOutputTokens,
  getAiBudgetStatus,
  noteProviderBillingPayer,
  recordAiCallOutcome,
  storeCachedAiDecision,
  type AiCallJustification,
  type AiCachedDecision,
} from "./ai-budget-governor.js";

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};

export type OpenAIErrorCode =
  | "missing_key"
  | "rate_limited"
  | "no_credits"
  | "invalid_key"
  | "project_restricted"
  | "model_unavailable"
  | "network_failure"
  | "provider_failure"
  | "error";

/** External taxonomy requested for ops / repair. */
export type OpenAIPublicErrorCode =
  | "OPENAI_RATE_LIMIT"
  | "OPENAI_INSUFFICIENT_QUOTA"
  | "OPENAI_INVALID_KEY"
  | "OPENAI_PROJECT_RESTRICTED"
  | "OPENAI_MODEL_UNAVAILABLE"
  | "OPENAI_NETWORK_FAILURE"
  | "OPENAI_PROVIDER_FAILURE";

export type OpenAICallOptions = {
  model?: string;
  messages: ChatMessage[];
  jsonSchema?: unknown;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  webSearch?: boolean;
  /** Required for live model calls under the AI budget governor. */
  justification?: AiCallJustification;
};

export type OpenAICallResult<T> =
  | {
      ok: true;
      data: T;
      raw: unknown;
      usage?: { input_tokens: number; output_tokens: number; total: number };
      /** Present when governor served a prior decision without a new model call. */
      fromCache?: boolean;
      billing?: "complimentary" | "paid" | "none";
    }
  | {
      ok: false;
      reason: string;
      code?: OpenAIErrorCode;
      publicCode?: OpenAIPublicErrorCode;
      httpStatus?: number;
      providerType?: string | null;
      providerCode?: string | null;
      governorDenied?: boolean;
    };

export type OpenAICapabilityStatus = {
  status: "ok" | "degraded" | "unavailable";
  reason: string | null;
  code: "ok" | OpenAIErrorCode;
  publicCode?: OpenAIPublicErrorCode | null;
  /** Actions that require generative OpenAI and should be skipped while degraded. */
  degradedActionTypes: string[];
  lastFailureAt: string | null;
  cooldownUntil: string | null;
  note: string;
};

function resolveDefaultModel(): string {
  return (
    process.env.REVENUEOS_LLM_MODEL ||
    process.env.OPENAI_MODEL ||
    "gpt-5-mini"
  );
}

function resolveStrategistModel(): string {
  return (
    process.env.REVENUEOS_STRATEGIST_MODEL ||
    process.env.OPENAI_STRATEGIST_MODEL ||
    process.env.OPENAI_MODEL ||
    "gpt-5-mini"
  );
}

/** Hard-fail generative actions when OpenAI is unavailable / hard-degraded. */
export const OPENAI_DEPENDENT_ACTIONS = [
  "web_research",
  "buyer_discovery",
  "deep_content_generate",
  "llm_hypothesize",
  "email_cold_outreach",
  "public_form_outreach",
  "reddit_helpful_reply",
  "producthunt_helpful_reply",
  "indiehackers_product_listing_draft",
  "indiehackers_community_post_draft",
  "hackernews_show_hn_draft",
] as const;

type DegradationState = {
  code: OpenAIErrorCode | null;
  publicCode: OpenAIPublicErrorCode | null;
  reason: string | null;
  lastFailureAt: number | null;
  cooldownUntil: number | null;
};

const state: DegradationState = {
  code: null,
  publicCode: null,
  reason: null,
  lastFailureAt: null,
  cooldownUntil: null,
};

export function hasOpenAIKey(): boolean {
  return (
    typeof process.env.OPENAI_API_KEY === "string" &&
    process.env.OPENAI_API_KEY.length > 20
  );
}

function parseProviderError(body: string): {
  type: string | null;
  code: string | null;
  message: string;
} {
  try {
    const err = (JSON.parse(body) as { error?: Record<string, unknown> }).error;
    if (!err || typeof err !== "object") {
      return { type: null, code: null, message: body.slice(0, 200) };
    }
    return {
      type: typeof err.type === "string" ? err.type : null,
      code: typeof err.code === "string" ? err.code : null,
      message: typeof err.message === "string" ? err.message : body.slice(0, 200),
    };
  } catch {
    return { type: null, code: null, message: body.slice(0, 200) };
  }
}

export function toPublicOpenAICode(
  code: OpenAIErrorCode,
): OpenAIPublicErrorCode | null {
  switch (code) {
    case "rate_limited":
      return "OPENAI_RATE_LIMIT";
    case "no_credits":
      return "OPENAI_INSUFFICIENT_QUOTA";
    case "invalid_key":
    case "missing_key":
      return "OPENAI_INVALID_KEY";
    case "project_restricted":
      return "OPENAI_PROJECT_RESTRICTED";
    case "model_unavailable":
      return "OPENAI_MODEL_UNAVAILABLE";
    case "network_failure":
      return "OPENAI_NETWORK_FAILURE";
    case "provider_failure":
    case "error":
      return "OPENAI_PROVIDER_FAILURE";
    default:
      return null;
  }
}

/**
 * Classify from HTTP status + raw provider body.
 * Do NOT collapse all 429s into no_credits.
 */
export function classifyOpenAIFailure(
  status: number,
  body: string,
): {
  code: OpenAIErrorCode;
  publicCode: OpenAIPublicErrorCode;
  reason: string;
  providerType: string | null;
  providerCode: string | null;
} {
  const provider = parseProviderError(body);
  const lower = `${provider.message} ${provider.type ?? ""} ${provider.code ?? ""} ${body}`.toLowerCase();
  const pCode = (provider.code ?? "").toLowerCase();
  const pType = (provider.type ?? "").toLowerCase();

  if (
    status === 401 ||
    pCode === "invalid_api_key" ||
    lower.includes("incorrect api key") ||
    lower.includes("invalid api key")
  ) {
    return {
      code: "invalid_key",
      publicCode: "OPENAI_INVALID_KEY",
      reason: `openai invalid_key (${status}): ${provider.message.slice(0, 160)}`,
      providerType: provider.type,
      providerCode: provider.code,
    };
  }

  if (
    status === 429 &&
    (pCode === "insufficient_quota" ||
      pCode === "credit_balance_exhausted" ||
      pType === "insufficient_quota" ||
      lower.includes("insufficient_quota") ||
      lower.includes("credit_balance_exhausted") ||
      lower.includes("no credits remaining") ||
      lower.includes("exceeded your current quota"))
  ) {
    return {
      code: "no_credits",
      publicCode: "OPENAI_INSUFFICIENT_QUOTA",
      reason: `openai insufficient_quota (${status}/${pCode || pType}): ${provider.message.slice(0, 160)}`,
      providerType: provider.type,
      providerCode: provider.code,
    };
  }

  if (status === 429 || pCode === "rate_limit_exceeded") {
    return {
      code: "rate_limited",
      publicCode: "OPENAI_RATE_LIMIT",
      reason: `openai rate_limit (${status}/${pCode || "429"}): ${provider.message.slice(0, 160)}`,
      providerType: provider.type,
      providerCode: provider.code,
    };
  }

  if (
    status === 403 ||
    pCode === "project_unavailable" ||
    lower.includes("project does not have access") ||
    lower.includes("not authorized for this project")
  ) {
    return {
      code: "project_restricted",
      publicCode: "OPENAI_PROJECT_RESTRICTED",
      reason: `openai project_restricted (${status}): ${provider.message.slice(0, 160)}`,
      providerType: provider.type,
      providerCode: provider.code,
    };
  }

  if (
    status === 404 ||
    pCode === "model_not_found" ||
    lower.includes("model_not_found") ||
    lower.includes("does not exist") ||
    lower.includes("unsupported parameter") ||
    lower.includes("not supported with this model")
  ) {
    // Unsupported params (e.g. temperature on gpt-5*) are model-surface issues.
    if (
      lower.includes("unsupported parameter") ||
      lower.includes("not supported with this model") ||
      pCode === "model_not_found" ||
      status === 404
    ) {
      return {
        code: "model_unavailable",
        publicCode: "OPENAI_MODEL_UNAVAILABLE",
        reason: `openai model_unavailable (${status}): ${provider.message.slice(0, 160)}`,
        providerType: provider.type,
        providerCode: provider.code,
      };
    }
  }

  if (status >= 500) {
    return {
      code: "provider_failure",
      publicCode: "OPENAI_PROVIDER_FAILURE",
      reason: `openai provider_failure (${status}): ${provider.message.slice(0, 160)}`,
      providerType: provider.type,
      providerCode: provider.code,
    };
  }

  return {
    code: "error",
    publicCode: "OPENAI_PROVIDER_FAILURE",
    reason: `openai ${status}: ${provider.message.slice(0, 200)}`,
    providerType: provider.type,
    providerCode: provider.code,
  };
}

/** @deprecated use classifyOpenAIFailure — kept name for older call sites. */
function classifyFailure(status: number, body: string) {
  return classifyOpenAIFailure(status, body);
}

function markDegraded(
  code: OpenAIErrorCode,
  publicCode: OpenAIPublicErrorCode,
  reason: string,
) {
  const now = Date.now();
  state.code = code;
  state.publicCode = publicCode;
  state.reason = reason;
  state.lastFailureAt = now;
  const coolMs =
    code === "no_credits" || code === "invalid_key"
      ? 30 * 60_000
      : code === "rate_limited"
        ? 2 * 60_000
        : code === "model_unavailable" || code === "project_restricted"
          ? 10 * 60_000
          : 5 * 60_000;
  state.cooldownUntil = now + coolMs;
}

function clearDegradedIfCool() {
  if (state.cooldownUntil && Date.now() >= state.cooldownUntil) {
    if (
      state.code === "rate_limited" ||
      state.code === "error" ||
      state.code === "provider_failure" ||
      state.code === "network_failure" ||
      state.code === "model_unavailable"
    ) {
      state.code = null;
      state.publicCode = null;
      state.reason = null;
      state.cooldownUntil = null;
    }
    // no_credits / invalid_key stay until a successful call clears them
  }
}

function noteFor(code: OpenAIErrorCode | "ok"): string {
  switch (code) {
    case "ok":
      return "OpenAI available";
    case "missing_key":
      return "LLM-dependent limbs unavailable; catalog/deterministic fallbacks still run";
    case "no_credits":
      return "OpenAI credit_balance_exhausted / insufficient_quota — generative limbs degraded; non-LLM commercial limbs continue. Complimentary daily tokens require a positive org prepaid balance.";
    case "rate_limited":
      return "OpenAI rate-limited — backoff then retry generative limbs";
    case "invalid_key":
      return "OpenAI API key rejected — engineering/config incident";
    case "project_restricted":
      return "OpenAI project/org restriction — check key project + data-sharing enrollment";
    case "model_unavailable":
      return "Requested OpenAI model unavailable/unsupported for this request shape";
    case "network_failure":
      return "OpenAI network failure — bounded retry";
    case "provider_failure":
    case "error":
    default:
      return "OpenAI provider error — generative limbs may fail; fallbacks preferred";
  }
}

export function getOpenAICapabilityStatus(): OpenAICapabilityStatus {
  clearDegradedIfCool();
  const budget = getAiBudgetStatus();
  if (
    budget.mode === "AI_DEGRADED_FREE_LIMIT" ||
    (budget.bootstrapAiMode && !budget.complimentaryUsable && !budget.paidAiAllowed)
  ) {
    return {
      status: "degraded",
      reason: budget.note,
      code: "no_credits",
      publicCode: "OPENAI_INSUFFICIENT_QUOTA",
      degradedActionTypes: [...OPENAI_DEPENDENT_ACTIONS],
      lastFailureAt: budget.metrics.lastDenyAt,
      cooldownUntil: null,
      note: `${budget.note} | governor mode=${budget.mode} paidAllowed=${budget.paidAiAllowed} complimentaryUsable=${budget.complimentaryUsable}`,
    };
  }
  if (!hasOpenAIKey()) {
    return {
      status: "unavailable",
      reason: "OPENAI_API_KEY missing",
      code: "missing_key",
      publicCode: "OPENAI_INVALID_KEY",
      degradedActionTypes: [...OPENAI_DEPENDENT_ACTIONS],
      lastFailureAt: null,
      cooldownUntil: null,
      note: noteFor("missing_key"),
    };
  }
  if (!state.code) {
    return {
      status: "ok",
      reason: null,
      code: "ok",
      publicCode: null,
      degradedActionTypes: [],
      lastFailureAt: null,
      cooldownUntil: null,
      note: noteFor("ok"),
    };
  }
  const hard =
    state.code === "no_credits" ||
    state.code === "invalid_key" ||
    state.code === "project_restricted";
  return {
    status: hard ? "degraded" : "degraded",
    reason: state.reason,
    code: state.code,
    publicCode: state.publicCode,
    degradedActionTypes: [...OPENAI_DEPENDENT_ACTIONS],
    lastFailureAt: state.lastFailureAt
      ? new Date(state.lastFailureAt).toISOString()
      : null,
    cooldownUntil: state.cooldownUntil
      ? new Date(state.cooldownUntil).toISOString()
      : null,
    note: noteFor(state.code),
  };
}

export function isOpenAIActionDegraded(actionType: string): boolean {
  const cap = getOpenAICapabilityStatus();
  if (cap.status === "ok") return false;
  return (OPENAI_DEPENDENT_ACTIONS as readonly string[]).includes(actionType);
}

/** Clear cached degradation (e.g. after owner tops up credits). */
export function resetOpenAIDegradation(): void {
  state.code = null;
  state.publicCode = null;
  state.reason = null;
  state.lastFailureAt = null;
  state.cooldownUntil = null;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

function modelOmitsTemperature(model: string): boolean {
  // gpt-5* / o-series often reject temperature on Responses API.
  return /^(gpt-5|o[0-9]|o4)/i.test(model);
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
  };
  const org =
    process.env.OPENAI_ORG_ID ||
    process.env.OPENAI_ORGANIZATION ||
    process.env.OPENAI_ORG;
  const project = process.env.OPENAI_PROJECT || process.env.OPENAI_PROJECT_ID;
  if (org) headers["OpenAI-Organization"] = org;
  if (project) headers["OpenAI-Project"] = project;
  return headers;
}

/**
 * Call OpenAI Responses API. Returns structured JSON if `jsonSchema` provided,
 * otherwise raw text under `data.text`. Never throws.
 */
export async function callOpenAI<T = unknown>(
  opts: OpenAICallOptions,
): Promise<OpenAICallResult<T>> {
  // Central governor — no subsystem bypasses this gate.
  const estimatedInputChars =
    opts.messages.reduce((n, m) => n + (m.content?.length ?? 0), 0) +
    (opts.jsonSchema ? JSON.stringify(opts.jsonSchema).length : 0);
  const gated = authorizeAiCall({
    justification: opts.justification,
    requestedModel: opts.model,
    estimatedInputChars,
  });
  if (!gated.allow) {
    if (gated.code === "cache_reuse" && gated.cached) {
      return {
        ok: true,
        data: gated.cached.data as T,
        raw: { cached: true, at: gated.cached.at },
        usage: gated.cached.usage,
        fromCache: true,
        billing: "none",
      };
    }
    return {
      ok: false,
      reason: gated.reason,
      code: "no_credits",
      publicCode: "OPENAI_INSUFFICIENT_QUOTA",
      governorDenied: true,
    };
  }

  if (!hasOpenAIKey()) {
    return {
      ok: false,
      reason: "OPENAI_API_KEY missing",
      code: "missing_key",
      publicCode: "OPENAI_INVALID_KEY",
    };
  }
  clearDegradedIfCool();

  // Hard-skip only for true quota exhaustion / invalid key — avoid retry storms.
  if (state.code === "no_credits") {
    return {
      ok: false,
      reason: state.reason ?? "openai insufficient_quota (cached)",
      code: "no_credits",
      publicCode: "OPENAI_INSUFFICIENT_QUOTA",
    };
  }
  if (state.code === "invalid_key") {
    return {
      ok: false,
      reason: state.reason ?? "openai invalid_key (cached)",
      code: "invalid_key",
      publicCode: "OPENAI_INVALID_KEY",
    };
  }
  if (
    state.code === "rate_limited" &&
    state.cooldownUntil &&
    Date.now() < state.cooldownUntil
  ) {
    return {
      ok: false,
      reason: state.reason ?? "openai rate_limited (cooldown)",
      code: "rate_limited",
      publicCode: "OPENAI_RATE_LIMIT",
    };
  }

  // web_search tool use is billed separately and is never complimentary — deny under $0 paid.
  if (opts.webSearch && gated.billing !== "paid") {
    return {
      ok: false,
      reason:
        "AI governor: web_search tool use is not complimentary — denied under $0 paid AI budget",
      code: "no_credits",
      publicCode: "OPENAI_INSUFFICIENT_QUOTA",
      governorDenied: true,
    };
  }

  const model = gated.model;
  const timeoutMs = opts.timeoutMs ?? 25_000;
  const body: Record<string, unknown> = {
    model,
    input: opts.messages.map((m) => ({
      role: m.role,
      content: [{ type: "input_text", text: m.content }],
    })),
    max_output_tokens: boundedMaxOutputTokens(opts.maxOutputTokens),
  };
  if (!modelOmitsTemperature(model)) {
    body.temperature = opts.temperature ?? 0.7;
  }
  // gpt-5* defaults to reasoning effort that is often NOT covered by
  // complimentary data-sharing tokens (billing.payer=developer). In
  // complimentary mode force the cheapest reasoning surface.
  if (gated.billing === "complimentary" && /^(gpt-5)/i.test(model)) {
    body.reasoning = { effort: "minimal" };
  }
  if (opts.jsonSchema) {
    body.text = {
      format: {
        type: "json_schema",
        name: "revenueos_response",
        strict: true,
        schema: opts.jsonSchema,
      },
    };
  }
  if (opts.webSearch) {
    body.tools = [{ type: "web_search" }];
  }

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const classified = classifyFailure(res.status, text);
        // Model param issues: one retry without temperature if not already omitted.
        if (
          classified.code === "model_unavailable" &&
          attempt < maxAttempts &&
          body.temperature !== undefined &&
          /temperature/i.test(classified.reason)
        ) {
          delete body.temperature;
          await sleep(200);
          continue;
        }
        markDegraded(classified.code, classified.publicCode, classified.reason);
        if (classified.code === "rate_limited" && attempt < maxAttempts) {
          const jitter = Math.floor(Math.random() * 400);
          await sleep(1_500 * attempt + jitter);
          continue;
        }
        if (
          classified.code === "provider_failure" &&
          attempt < maxAttempts
        ) {
          await sleep(1_000 * attempt);
          continue;
        }
        // True insufficient quota: do not retry-storm.
        return {
          ok: false,
          reason: classified.reason,
          code: classified.code,
          publicCode: classified.publicCode,
          httpStatus: res.status,
          providerType: classified.providerType,
          providerCode: classified.providerCode,
        };
      }
      const raw = (await res.json()) as {
        output?: Array<{ content?: Array<{ text?: string; type?: string }> }>;
        output_text?: string;
        usage?: { input_tokens?: number; output_tokens?: number };
        billing?: { payer?: string };
        service_tier?: string;
      };

      // Never silently consume prepaid: verify Responses billing.payer.
      // Only hard-block on explicit payer=developer. Missing field is denied for
      // this call but does not permanently kill complimentary (schema drift).
      const payerKind = noteProviderBillingPayer(raw.billing?.payer ?? null, {
        model,
        requestId: typeof (raw as { id?: string }).id === "string"
          ? (raw as { id?: string }).id
          : undefined,
      });
      if (gated.billing === "complimentary" && payerKind === "paid") {
        return {
          ok: false,
          reason:
            "AI governor: response billed to developer (paid) while PAID_AI_ALLOWED=false — call discarded, further AI blocked to protect prepaid reserve",
          code: "no_credits",
          publicCode: "OPENAI_INSUFFICIENT_QUOTA",
          governorDenied: true,
        };
      }
      if (gated.billing === "complimentary" && payerKind !== "complimentary") {
        return {
          ok: false,
          reason:
            "AI governor: response missing billing.payer=openai — denied this call (no paid fallthrough); complimentary remains available for proven-free responses",
          code: "no_credits",
          publicCode: "OPENAI_INSUFFICIENT_QUOTA",
          governorDenied: true,
        };
      }

      // Success clears any prior degradation (including recovered billing).
      resetOpenAIDegradation();

      const outputText =
        raw.output_text ??
        raw.output
          ?.flatMap((o) =>
            (o.content ?? [])
              .filter((c) => c.type === "output_text")
              .map((c) => c.text ?? ""),
          )
          .join("\n") ??
        "";
      let data: T;
      if (opts.jsonSchema) {
        try {
          data = JSON.parse(outputText) as T;
        } catch (e) {
          return {
            ok: false,
            reason: `json parse failed: ${(e as Error).message.slice(0, 80)}`,
            code: "error",
            publicCode: "OPENAI_PROVIDER_FAILURE",
          };
        }
      } else {
        data = { text: outputText } as unknown as T;
      }
      const usage = {
        input_tokens: raw.usage?.input_tokens ?? 0,
        output_tokens: raw.usage?.output_tokens ?? 0,
        total: (raw.usage?.input_tokens ?? 0) + (raw.usage?.output_tokens ?? 0),
      };
      const billingOut =
        payerKind === "complimentary"
          ? "complimentary"
          : payerKind === "paid"
            ? "paid"
            : gated.billing;
      recordAiCallOutcome({
        ok: true,
        billing: billingOut,
        usage,
        paidCostUsd: 0,
      });
      if (opts.justification?.stateHash) {
        const entry: AiCachedDecision = {
          stateHash: opts.justification.stateHash,
          at: new Date().toISOString(),
          model,
          businessId: opts.justification.businessId ?? null,
          reason: opts.justification.reason,
          data,
          usage,
        };
        storeCachedAiDecision(entry);
      }
      return { ok: true, data, raw, usage, billing: billingOut };
    } catch (err) {
      const msg = (err as Error).message.slice(0, 120);
      if (attempt < maxAttempts) {
        const jitter = Math.floor(Math.random() * 300);
        await sleep(1_000 * attempt + jitter);
        continue;
      }
      markDegraded(
        "network_failure",
        "OPENAI_NETWORK_FAILURE",
        `openai network_failure: ${msg}`,
      );
      return {
        ok: false,
        reason: `fetch error: ${msg}`,
        code: "network_failure",
        publicCode: "OPENAI_NETWORK_FAILURE",
      };
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    ok: false,
    reason: "openai exhausted retries",
    code: "error",
    publicCode: "OPENAI_PROVIDER_FAILURE",
  };
}

export const DEFAULT_MODELS = {
  get cheap() {
    return resolveDefaultModel();
  },
  get strategist() {
    return resolveStrategistModel();
  },
};
