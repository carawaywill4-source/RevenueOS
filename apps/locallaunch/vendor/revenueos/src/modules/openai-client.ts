/**
 * Zero-dependency OpenAI client (uses global fetch).
 *
 * Kept as a thin, deterministic surface: structured-JSON output only, per-call
 * timeout, bounded retries for transient rate limits, and an explicit
 * capability-degradation signal when the org is out of credits.
 *
 * RevenueOS must keep operating without OpenAI — but must NOT pretend full
 * intelligence is available when the provider is degraded.
 */

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};

export type OpenAICallOptions = {
  model?: string;
  messages: ChatMessage[];
  jsonSchema?: unknown;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  webSearch?: boolean;
};

export type OpenAICallResult<T> =
  | {
      ok: true;
      data: T;
      raw: unknown;
      usage?: { input_tokens: number; output_tokens: number; total: number };
    }
  | {
      ok: false;
      reason: string;
      /** Structured degradation code when applicable. */
      code?: "missing_key" | "rate_limited" | "no_credits" | "error";
    };

export type OpenAICapabilityStatus = {
  status: "ok" | "degraded" | "unavailable";
  reason: string | null;
  code: "ok" | "missing_key" | "rate_limited" | "no_credits" | "error";
  /** Actions that require generative OpenAI and should be skipped while degraded. */
  degradedActionTypes: string[];
  lastFailureAt: string | null;
  cooldownUntil: string | null;
  note: string;
};

const DEFAULT_MODEL = process.env.REVENUEOS_LLM_MODEL ?? "gpt-4o-mini";
const DEFAULT_STRATEGIST_MODEL =
  process.env.REVENUEOS_STRATEGIST_MODEL ?? "gpt-4o";

/** Hard-fail generative actions when OpenAI is out of credits / rate-limited. */
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
  code: "rate_limited" | "no_credits" | "error" | null;
  reason: string | null;
  lastFailureAt: number | null;
  cooldownUntil: number | null;
};

const state: DegradationState = {
  code: null,
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

function classifyFailure(
  status: number,
  body: string,
): { code: "rate_limited" | "no_credits" | "error"; reason: string } {
  const lower = body.toLowerCase();
  if (
    status === 429 &&
    (lower.includes("insufficient_quota") ||
      lower.includes("no credits remaining") ||
      lower.includes("exceeded your current quota"))
  ) {
    return {
      code: "no_credits",
      reason: `openai no_credits (429): ${body.slice(0, 160)}`,
    };
  }
  if (status === 429) {
    return {
      code: "rate_limited",
      reason: `openai rate_limited (429): ${body.slice(0, 160)}`,
    };
  }
  return {
    code: "error",
    reason: `openai ${status}: ${body.slice(0, 200)}`,
  };
}

function markDegraded(
  code: "rate_limited" | "no_credits" | "error",
  reason: string,
) {
  const now = Date.now();
  state.code = code;
  state.reason = reason;
  state.lastFailureAt = now;
  // no_credits: long cool-off until owner tops up; rate_limit: short cool-off
  const coolMs =
    code === "no_credits"
      ? 60 * 60_000
      : code === "rate_limited"
        ? 2 * 60_000
        : 5 * 60_000;
  state.cooldownUntil = now + coolMs;
}

function clearDegradedIfCool() {
  if (state.cooldownUntil && Date.now() >= state.cooldownUntil) {
    if (state.code === "rate_limited" || state.code === "error") {
      state.code = null;
      state.reason = null;
      state.cooldownUntil = null;
    }
    // no_credits stays until a successful call clears it
  }
}

export function getOpenAICapabilityStatus(): OpenAICapabilityStatus {
  clearDegradedIfCool();
  if (!hasOpenAIKey()) {
    return {
      status: "unavailable",
      reason: "OPENAI_API_KEY missing",
      code: "missing_key",
      degradedActionTypes: [...OPENAI_DEPENDENT_ACTIONS],
      lastFailureAt: null,
      cooldownUntil: null,
      note: "LLM-dependent limbs unavailable; catalog/deterministic fallbacks still run",
    };
  }
  if (state.code === "no_credits") {
    return {
      status: "degraded",
      reason: state.reason,
      code: "no_credits",
      degradedActionTypes: [...OPENAI_DEPENDENT_ACTIONS],
      lastFailureAt: state.lastFailureAt
        ? new Date(state.lastFailureAt).toISOString()
        : null,
      cooldownUntil: state.cooldownUntil
        ? new Date(state.cooldownUntil).toISOString()
        : null,
      note: "OpenAI org out of credits — generative planning/discovery degraded; non-LLM commercial limbs continue",
    };
  }
  if (state.code === "rate_limited") {
    return {
      status: "degraded",
      reason: state.reason,
      code: "rate_limited",
      degradedActionTypes: [...OPENAI_DEPENDENT_ACTIONS],
      lastFailureAt: state.lastFailureAt
        ? new Date(state.lastFailureAt).toISOString()
        : null,
      cooldownUntil: state.cooldownUntil
        ? new Date(state.cooldownUntil).toISOString()
        : null,
      note: "OpenAI rate-limited — skipping generative limbs until cooldown elapses",
    };
  }
  if (state.code === "error") {
    return {
      status: "degraded",
      reason: state.reason,
      code: "error",
      degradedActionTypes: [...OPENAI_DEPENDENT_ACTIONS],
      lastFailureAt: state.lastFailureAt
        ? new Date(state.lastFailureAt).toISOString()
        : null,
      cooldownUntil: state.cooldownUntil
        ? new Date(state.cooldownUntil).toISOString()
        : null,
      note: "OpenAI recent errors — generative limbs may fail; fallbacks preferred",
    };
  }
  return {
    status: "ok",
    reason: null,
    code: "ok",
    degradedActionTypes: [],
    lastFailureAt: null,
    cooldownUntil: null,
    note: "OpenAI available",
  };
}

export function isOpenAIActionDegraded(actionType: string): boolean {
  const cap = getOpenAICapabilityStatus();
  if (cap.status === "ok") return false;
  return (OPENAI_DEPENDENT_ACTIONS as readonly string[]).includes(actionType);
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * Call OpenAI Responses API. Returns structured JSON if `jsonSchema` provided,
 * otherwise raw text under `data.text`. Never throws.
 */
export async function callOpenAI<T = unknown>(
  opts: OpenAICallOptions,
): Promise<OpenAICallResult<T>> {
  if (!hasOpenAIKey()) {
    return { ok: false, reason: "OPENAI_API_KEY missing", code: "missing_key" };
  }
  clearDegradedIfCool();
  // Hard-skip when out of credits — avoid burning failed ticks
  if (state.code === "no_credits") {
    return {
      ok: false,
      reason: state.reason ?? "openai no_credits (cached)",
      code: "no_credits",
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
    };
  }

  const model = opts.model ?? DEFAULT_MODEL;
  const timeoutMs = opts.timeoutMs ?? 25_000;
  const body: Record<string, unknown> = {
    model,
    input: opts.messages.map((m) => ({
      role: m.role,
      content: [{ type: "input_text", text: m.content }],
    })),
    max_output_tokens: opts.maxOutputTokens ?? 900,
    temperature: opts.temperature ?? 0.7,
  };
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

  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const classified = classifyFailure(res.status, text);
        markDegraded(classified.code, classified.reason);
        if (classified.code === "rate_limited" && attempt < maxAttempts) {
          await sleep(1_500 * attempt);
          continue;
        }
        return {
          ok: false,
          reason: classified.reason,
          code: classified.code,
        };
      }
      // Success clears any prior degradation (including recovered billing).
      state.code = null;
      state.reason = null;
      state.cooldownUntil = null;

      const raw = (await res.json()) as {
        output?: Array<{ content?: Array<{ text?: string; type?: string }> }>;
        output_text?: string;
        usage?: { input_tokens?: number; output_tokens?: number };
      };
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
      return { ok: true, data, raw, usage };
    } catch (err) {
      if (attempt < maxAttempts) {
        await sleep(1_000 * attempt);
        continue;
      }
      return {
        ok: false,
        reason: `fetch error: ${(err as Error).message.slice(0, 120)}`,
        code: "error",
      };
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, reason: "openai exhausted retries", code: "error" };
}

export const DEFAULT_MODELS = {
  cheap: DEFAULT_MODEL,
  strategist: DEFAULT_STRATEGIST_MODEL,
};
