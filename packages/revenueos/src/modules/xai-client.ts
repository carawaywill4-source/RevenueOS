/**
 * xAI (Grok) provider — RevenueOS second commercial brain.
 *
 * Env vars (read at call-time; never hardcoded):
 *   - XAI_API_KEY     : required. If missing, provider is DISABLED.
 *   - XAI_BASE_URL    : default https://api.x.ai/v1
 *   - XAI_MODEL       : preferred model. If unset, model discovery at first call
 *                       will pick the strongest available text/reasoning model
 *                       for this API key.
 *
 * Purpose (per owner directive):
 *   - MARKET_REALITY_CHECK
 *   - ADVERSARIAL_BUSINESS_REVIEW
 *   - STUCK_STATE_ESCALATION
 *   - CROSS_MODEL_DISAGREEMENT
 *
 * NOT called on the 45s per-business hot tick. Only on strategic paths.
 * Every call is recorded to `ros_ai_call_ledger` via MissionController.
 */

export type XaiProviderHealth =
  | { status: "AVAILABLE"; model: string; discoveredAt: string }
  | { status: "RATE_LIMITED"; cooldownUntil: string; lastError: string }
  | { status: "FAILED"; cooldownUntil: string; lastError: string }
  | { status: "DISABLED"; reason: string };

let cachedHealth: XaiProviderHealth = {
  status: "DISABLED",
  reason: "not_initialized",
};

let discoveredModel: string | null = null;
let lastDiscoveryAt = 0;
const MODEL_DISCOVERY_TTL_MS = 60 * 60 * 1000;

const DEFAULT_BASE_URL = "https://api.x.ai/v1";

export function xaiEnv(): {
  apiKey: string | null;
  baseUrl: string;
  configuredModel: string | null;
} {
  const apiKey = (process.env.XAI_API_KEY ?? "").trim();
  const baseUrl = (process.env.XAI_BASE_URL ?? DEFAULT_BASE_URL).trim().replace(/\/$/, "");
  const configuredModel = (process.env.XAI_MODEL ?? "").trim() || null;
  return { apiKey: apiKey.length >= 20 ? apiKey : null, baseUrl, configuredModel };
}

export function xaiHealth(): XaiProviderHealth {
  return cachedHealth;
}

function setHealth(next: XaiProviderHealth): void {
  cachedHealth = next;
}

/**
 * Discover the strongest text/reasoning model available to this key.
 * Prefers configured XAI_MODEL if set. Otherwise queries GET /models and
 * ranks by a simple lexical heuristic (prefer `grok-4*` > `grok-3*` > others).
 * Cached for 1 hour.
 */
export async function discoverXaiModel(opts?: { fetchImpl?: typeof fetch }): Promise<
  | { ok: true; model: string; source: "configured" | "discovered" }
  | { ok: false; reason: string }
> {
  const env = xaiEnv();
  if (!env.apiKey) return { ok: false, reason: "missing_api_key" };
  if (env.configuredModel) {
    discoveredModel = env.configuredModel;
    lastDiscoveryAt = Date.now();
    return { ok: true, model: env.configuredModel, source: "configured" };
  }
  if (discoveredModel && Date.now() - lastDiscoveryAt < MODEL_DISCOVERY_TTL_MS) {
    return { ok: true, model: discoveredModel, source: "discovered" };
  }
  const doFetch = opts?.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await doFetch(`${env.baseUrl}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${env.apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false, reason: `models_http_${res.status}` };
    }
    const j = (await res.json()) as { data?: Array<{ id: string }> };
    const ids = (j.data ?? []).map((m) => m.id).filter(Boolean);
    if (!ids.length) return { ok: false, reason: "empty_model_list" };
    const preferred = pickPreferredXaiModel(ids);
    discoveredModel = preferred;
    lastDiscoveryAt = Date.now();
    return { ok: true, model: preferred, source: "discovered" };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "discover_failed" };
  } finally {
    clearTimeout(timer);
  }
}

export function pickPreferredXaiModel(ids: string[]): string {
  const rank = (id: string): number => {
    const s = id.toLowerCase();
    if (s.startsWith("grok-4")) return 100;
    if (s.startsWith("grok-3")) return 80;
    if (s.startsWith("grok-2")) return 60;
    if (s.startsWith("grok-beta")) return 40;
    if (s.startsWith("grok-")) return 30;
    return 10;
  };
  return [...ids].sort((a, b) => rank(b) - rank(a) || a.localeCompare(b))[0]!;
}

/**
 * Initialize xAI health at operator boot. Non-fatal on failure — the mission
 * continues without xAI (health becomes DISABLED or FAILED).
 */
export async function initializeXai(opts?: { fetchImpl?: typeof fetch }): Promise<XaiProviderHealth> {
  const env = xaiEnv();
  if (!env.apiKey) {
    setHealth({ status: "DISABLED", reason: "missing_api_key" });
    return xaiHealth();
  }
  // Always hit /models so a configured XAI_MODEL cannot masquerade as
  // AVAILABLE when the team has no credits / a revoked key.
  const doFetch = opts?.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await doFetch(`${env.baseUrl}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${env.apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      setHealth({
        status: "FAILED",
        cooldownUntil: new Date(Date.now() + 5 * 60_000).toISOString(),
        lastError: `models_http_${res.status}:${body.slice(0, 160)}`,
      });
      return xaiHealth();
    }
    const j = (await res.json()) as { data?: Array<{ id: string }> };
    const ids = (j.data ?? []).map((m) => m.id).filter(Boolean);
    let model = env.configuredModel;
    if (!model || !ids.includes(model)) {
      // Prefer an exact match for grok-4.6 / grok-4 family if present.
      const preferred =
        ids.find((id) => /grok-4\.?6/i.test(id)) ||
        ids.find((id) => /^grok-4/i.test(id)) ||
        (ids.length ? pickPreferredXaiModel(ids) : null);
      model = preferred ?? env.configuredModel ?? "grok-4";
    }
    discoveredModel = model;
    lastDiscoveryAt = Date.now();
    setHealth({
      status: "AVAILABLE",
      model,
      discoveredAt: new Date().toISOString(),
    });
    return xaiHealth();
  } catch (err) {
    setHealth({
      status: "FAILED",
      cooldownUntil: new Date(Date.now() + 5 * 60_000).toISOString(),
      lastError: err instanceof Error ? err.message : "init_failed",
    });
    return xaiHealth();
  } finally {
    clearTimeout(timer);
  }
}

export type XaiCallReason =
  | "MARKET_REALITY_CHECK"
  | "ADVERSARIAL_BUSINESS_REVIEW"
  | "STUCK_STATE_ESCALATION"
  | "CROSS_MODEL_DISAGREEMENT"
  | "OWNER_DIALOG"
  | "OTHER";

export type XaiCallOpts = {
  reason: XaiCallReason;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  jsonSchema?: unknown;
  webSearch?: boolean;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export type XaiCallResult<T = unknown> =
  | {
      ok: true;
      provider: "xai";
      model: string;
      reason: XaiCallReason;
      inputTokens: number;
      outputTokens: number;
      estimatedCostUsd: number;
      text: string;
      json?: T;
      raw: unknown;
    }
  | {
      ok: false;
      provider: "xai";
      reason: XaiCallReason;
      error: string;
      status?: number;
    };

const XAI_PRICE_HINTS_PER_1M_TOKENS: Record<string, { input: number; output: number }> = {
  // These are rough placeholders. Ledger record intent matters more than exact pricing;
  // update from an authoritative source when known.
  default: { input: 5, output: 15 },
};

function estimateXaiCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const key = Object.keys(XAI_PRICE_HINTS_PER_1M_TOKENS).find((k) =>
    model.toLowerCase().startsWith(k),
  );
  const price = XAI_PRICE_HINTS_PER_1M_TOKENS[key ?? "default"] ?? XAI_PRICE_HINTS_PER_1M_TOKENS.default;
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}

/**
 * Uniform xAI call. Uses OpenAI-compatible /v1/chat/completions surface
 * (xAI supports both /v1/chat/completions and /v1/responses; we use chat
 * for maximum compatibility across model versions).
 *
 * The caller MUST record the result to `ros_ai_call_ledger` via
 * MissionController.recordAiCall — this function returns the metadata to do so.
 */
export async function callXai<T = unknown>(opts: XaiCallOpts): Promise<XaiCallResult<T>> {
  const env = xaiEnv();
  if (!env.apiKey) {
    return { ok: false, provider: "xai", reason: opts.reason, error: "missing_api_key" };
  }
  let model = opts.model || discoveredModel;
  if (!model) {
    const disc = await discoverXaiModel({ fetchImpl: opts.fetchImpl });
    if (!disc.ok) {
      return { ok: false, provider: "xai", reason: opts.reason, error: `discover_failed:${disc.reason}` };
    }
    model = disc.model;
  }
  const doFetch = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 60_000);
  try {
    const body: Record<string, unknown> = {
      model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.2,
    };
    if (opts.maxOutputTokens) body.max_tokens = opts.maxOutputTokens;
    if (opts.jsonSchema) {
      body.response_format = {
        type: "json_schema",
        json_schema: {
          name: "revenueos_response",
          schema: opts.jsonSchema,
          strict: true,
        },
      };
    }
    if (opts.webSearch) {
      // xAI supports a `search_parameters` field on grok-3+ for live web search.
      body.search_parameters = { mode: "auto" };
    }
    const res = await doFetch(`${env.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (res.status === 429) {
      setHealth({
        status: "RATE_LIMITED",
        cooldownUntil: new Date(Date.now() + 60_000).toISOString(),
        lastError: `http_${res.status}`,
      });
      return { ok: false, provider: "xai", reason: opts.reason, error: "rate_limited", status: 429 };
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      setHealth({
        status: "FAILED",
        cooldownUntil: new Date(Date.now() + 5 * 60_000).toISOString(),
        lastError: `http_${res.status}_${text.slice(0, 200)}`,
      });
      return {
        ok: false,
        provider: "xai",
        reason: opts.reason,
        error: `http_${res.status}`,
        status: res.status,
      };
    }
    // Success — clear any FAILED state.
    setHealth({ status: "AVAILABLE", model, discoveredAt: new Date().toISOString() });
    const j = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = j.choices?.[0]?.message?.content ?? "";
    const inputTokens = Number(j.usage?.prompt_tokens ?? 0);
    const outputTokens = Number(j.usage?.completion_tokens ?? 0);
    const cost = estimateXaiCostUsd(model, inputTokens, outputTokens);
    let json: T | undefined;
    if (opts.jsonSchema && text) {
      try {
        json = JSON.parse(text) as T;
      } catch {
        // Ignore parse failures; caller can inspect .text.
      }
    }
    return {
      ok: true,
      provider: "xai",
      model,
      reason: opts.reason,
      inputTokens,
      outputTokens,
      estimatedCostUsd: cost,
      text,
      json,
      raw: j,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "call_failed";
    setHealth({
      status: "FAILED",
      cooldownUntil: new Date(Date.now() + 5 * 60_000).toISOString(),
      lastError: msg,
    });
    return { ok: false, provider: "xai", reason: opts.reason, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Stuck-state advice, structured. Returns a JSON payload with candidate
 * experiments. Never terminates the mission — the caller (MissionController)
 * decides whether to enqueue any of them (after fingerprint dedup).
 */
export async function xaiStuckStateAdvice(input: {
  missionSummary: string;
  triedExperiments: Array<{ family: string; product: string; result: string }>;
  constraints: string[];
  fetchImpl?: typeof fetch;
}): Promise<XaiCallResult<{
  candidateExperiments: Array<{
    hypothesis: string;
    product: string;
    channelFamily: string;
    audienceKey: string;
    offerKey: string;
    positioningKey: string;
    reasoning: string;
  }>;
}>> {
  const system = `You are xAI acting as an independent commercial strategist for RevenueOS.
RevenueOS is stuck. Your job is to propose MATERIALLY DIFFERENT candidate acquisition experiments,
ranked by probability of producing real human exposure or revenue.

HARD CONSTRAINTS (do not violate):
- No paid ads.
- No solicitations that require buying a custom domain first.
- Do not repeat any strategy family that has already been tried without success.
- Do not propose "try the same thing but with better copy" — that is not a materially different experiment.
- Only propose experiments a fully autonomous system can execute without owner intervention today,
  OR clearly label them BLOCKED_NEEDS_OWNER_AUTH.

Return JSON only.`;
  const user = `Mission summary:
${input.missionSummary}

Tried experiments (family, product, result):
${input.triedExperiments.map((e) => `- ${e.family} on ${e.product}: ${e.result}`).join("\n")}

Additional constraints:
${input.constraints.map((c) => `- ${c}`).join("\n")}

Propose 5-8 candidate experiments across DIFFERENT channelFamily values.
For each: hypothesis, product, channelFamily, audienceKey, offerKey, positioningKey, reasoning.`;
  return callXai({
    reason: "STUCK_STATE_ESCALATION",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    jsonSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        candidateExperiments: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "hypothesis",
              "product",
              "channelFamily",
              "audienceKey",
              "offerKey",
              "positioningKey",
              "reasoning",
            ],
            properties: {
              hypothesis: { type: "string" },
              product: { type: "string" },
              channelFamily: { type: "string" },
              audienceKey: { type: "string" },
              offerKey: { type: "string" },
              positioningKey: { type: "string" },
              reasoning: { type: "string" },
            },
          },
        },
      },
      required: ["candidateExperiments"],
    },
    fetchImpl: input.fetchImpl,
    webSearch: true,
  });
}
