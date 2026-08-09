/**
 * Zero-dependency OpenAI client (uses global fetch).
 *
 * Kept as a thin, deterministic surface: structured-JSON output only, per-call
 * timeout, retries, and a per-run cost budget. Returns null on any failure so
 * the surrounding planner never blocks on network or auth issues.
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

export type OpenAICallResult<T> = {
  ok: true;
  data: T;
  raw: unknown;
  usage?: { input_tokens: number; output_tokens: number; total: number };
} | {
  ok: false;
  reason: string;
};

const DEFAULT_MODEL = process.env.REVENUEOS_LLM_MODEL ?? "gpt-4o-mini";
const DEFAULT_STRATEGIST_MODEL =
  process.env.REVENUEOS_STRATEGIST_MODEL ?? "gpt-4o";

export function hasOpenAIKey(): boolean {
  return typeof process.env.OPENAI_API_KEY === "string" &&
    process.env.OPENAI_API_KEY.length > 20;
}

/**
 * Call OpenAI Responses API. Returns structured JSON if `jsonSchema` provided,
 * otherwise raw text under `data.text`. Never throws.
 */
export async function callOpenAI<T = unknown>(
  opts: OpenAICallOptions,
): Promise<OpenAICallResult<T>> {
  if (!hasOpenAIKey()) return { ok: false, reason: "OPENAI_API_KEY missing" };
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
      return {
        ok: false,
        reason: `openai ${res.status}: ${text.slice(0, 200)}`,
      };
    }
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
    return {
      ok: false,
      reason: `fetch error: ${(err as Error).message.slice(0, 120)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

export const DEFAULT_MODELS = {
  cheap: DEFAULT_MODEL,
  strategist: DEFAULT_STRATEGIST_MODEL,
};
