/**
 * Owner Dialog — backend for the operator chat interface.
 *
 * The owner drops a plain-English message. We turn that message + current
 * portfolio state into a structured response the UI can render and (later)
 * execute:
 *
 *   { answer: string,
 *     proposedChanges: Array<{ op, target, value }>,
 *     toolCalls?: Array<{ name, arguments }> }
 *
 * Primary brain: xAI / Grok (OWNER_DIALOG). Fallback: OpenAI. Final fallback:
 * deterministic keyword heuristics so the operator flow never dead-ends.
 *
 * All op values are enumerated and validated — the UI must inspect and
 * confirm before any change is applied.
 */

import { callOpenAI, hasOpenAIKey, DEFAULT_MODELS } from "./openai-client";
import { callXai, xaiEnv, xaiHealth } from "./xai-client";

export type OwnerProposedOp =
  | "set_target"
  | "prioritize_business"
  | "deprioritize_business"
  | "pause_business"
  | "resume_business"
  | "increase_concurrency"
  | "decrease_concurrency"
  | "enable_mechanism"
  | "disable_mechanism"
  | "add_note"
  | "queue_task"
  | "request_fix";

export type OwnerProposedChange = {
  op: OwnerProposedOp;
  /** e.g. siteId, mechanism key, or "portfolio". */
  target: string;
  /** Op-specific value; may be a scalar or short JSON blob. */
  value: string | number | boolean;
  reason?: string;
};

export type OwnerToolCall = {
  name: string;
  arguments: Record<string, string | number | boolean>;
};

export type OwnerDialogState = {
  portfolioTargetUsd?: number;
  activeBusinesses?: Array<{
    siteId: string;
    displayName: string;
    revenueUsd: number;
    profitUsd?: number;
    firstCustomerMode?: boolean;
    paused?: boolean;
  }>;
  recentAsks?: string[];
  hoursSinceStart?: number;
  missionSummary?: string;
};

export type OwnerDialogResult = {
  answer: string;
  proposedChanges: OwnerProposedChange[];
  toolCalls?: OwnerToolCall[];
  source: "xai" | "openai" | "deterministic";
  model?: string;
  reason?: string;
};

const VALID_OPS: OwnerProposedOp[] = [
  "set_target",
  "prioritize_business",
  "deprioritize_business",
  "pause_business",
  "resume_business",
  "increase_concurrency",
  "decrease_concurrency",
  "enable_mechanism",
  "disable_mechanism",
  "add_note",
  "queue_task",
  "request_fix",
];

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    answer: { type: "string" },
    proposedChanges: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          op: { type: "string", enum: VALID_OPS },
          target: { type: "string" },
          value: { type: ["string", "number", "boolean"] },
          reason: { type: "string" },
        },
        required: ["op", "target", "value", "reason"],
      },
    },
    toolCalls: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          arguments: {
            type: "object",
            additionalProperties: { type: ["string", "number", "boolean"] },
          },
        },
        required: ["name", "arguments"],
      },
    },
  },
  required: ["answer", "proposedChanges", "toolCalls"],
};

function summarizeState(state: OwnerDialogState): string {
  const lines: string[] = [];
  if (typeof state.portfolioTargetUsd === "number") {
    lines.push(`portfolio_target_usd: ${state.portfolioTargetUsd}`);
  }
  if (typeof state.hoursSinceStart === "number") {
    lines.push(`hours_since_start: ${state.hoursSinceStart.toFixed(1)}`);
  }
  if (state.missionSummary?.trim()) {
    lines.push(`mission: ${state.missionSummary.trim()}`);
  }
  const biz = (state.activeBusinesses ?? []).slice(0, 15);
  if (biz.length) {
    lines.push("businesses:");
    for (const b of biz) {
      lines.push(
        `  - ${b.siteId} (${b.displayName}) revenue=$${b.revenueUsd.toFixed(2)}${
          typeof b.profitUsd === "number" ? ` profit=$${b.profitUsd.toFixed(2)}` : ""
        }${b.firstCustomerMode ? " fcm" : ""}${b.paused ? " paused" : ""}`,
      );
    }
  }
  if (state.recentAsks?.length) {
    lines.push(`recent_asks: ${state.recentAsks.slice(0, 5).join(" | ")}`);
  }
  return lines.join("\n");
}

function defaultSystemPrompt(): string {
  return [
    "You are RevenueOS — the owner's in-app operator brain.",
    "You handle tasks, diagnoses, and fixes the owner types into the Mac app chat.",
    "Be direct, evidence-based, and commercially focused.",
    "Prefer concrete next actions over abstract strategy.",
    "When the owner asks for a fix or task, propose queue_task or request_fix changes with a clear target and value.",
    "Never invent purchases, humans, or revenue.",
    "Never propose paid ads or buying domains unless the owner explicitly unlocks capital.",
    "Output STRICT JSON matching the provided schema.",
    "answer must be concise and usable as an operator reply.",
  ].join(" ");
}

function validateProposed(
  changes: OwnerProposedChange[] | undefined,
): OwnerProposedChange[] {
  const validated: OwnerProposedChange[] = [];
  for (const c of changes ?? []) {
    if (!VALID_OPS.includes(c.op)) continue;
    if (typeof c.target !== "string" || c.target.length === 0) continue;
    if (c.value === null || c.value === undefined) continue;
    validated.push({
      op: c.op,
      target: c.target.slice(0, 100),
      value: c.value,
      reason: typeof c.reason === "string" ? c.reason.slice(0, 240) : undefined,
    });
  }
  return validated;
}

function deterministicFallback(input: {
  message: string;
  state: OwnerDialogState;
  reason: string;
}): OwnerDialogResult {
  const msg = input.message.toLowerCase();
  const changes: OwnerProposedChange[] = [];
  const businesses = input.state.activeBusinesses ?? [];

  if (/\bfocus (on|)\s*(\S+)/.test(msg) || /\bprioritize\s+(\S+)/.test(msg)) {
    const m = msg.match(/\b(?:focus on|focus|prioritize)\s+([a-z0-9\-]+)/);
    if (m && businesses.find((b) => b.siteId === m[1])) {
      changes.push({
        op: "prioritize_business",
        target: m[1]!,
        value: true,
        reason: "explicit owner focus request",
      });
    }
  }
  if (/\bpause\s+(\S+)/.test(msg)) {
    const m = msg.match(/\bpause\s+([a-z0-9\-]+)/);
    if (m && businesses.find((b) => b.siteId === m[1])) {
      changes.push({
        op: "pause_business",
        target: m[1]!,
        value: true,
        reason: "owner pause command",
      });
    }
  }
  if (/target.*(\$?[\d,]+)/.test(msg)) {
    const m = msg.match(/(\$?)([\d,]{2,})/);
    if (m) {
      const n = Number(m[2]!.replaceAll(",", ""));
      if (Number.isFinite(n) && n > 0) {
        changes.push({
          op: "set_target",
          target: "portfolio",
          value: n,
          reason: "owner-supplied numeric target",
        });
      }
    }
  }
  if (/\b(fix|bug|broken|repair|task)\b/.test(msg)) {
    changes.push({
      op: "request_fix",
      target: "mission",
      value: input.message.slice(0, 500),
      reason: "owner-reported task/fix via chat",
    });
  }

  return {
    answer:
      changes.length > 0
        ? `Understood — I've drafted ${changes.length} change(s). Review below before applying. (offline fallback — Grok unavailable)`
        : "I couldn't reach Grok; I heard you but I'm not going to make changes without confirmation. (offline fallback)",
    proposedChanges: changes,
    source: "deterministic",
    reason: input.reason,
  };
}

async function tryXaiDialog(input: {
  message: string;
  state: OwnerDialogState;
  systemPrompt: string;
  model?: string;
}): Promise<OwnerDialogResult | null> {
  const env = xaiEnv();
  if (!env.apiKey) return null;
  const health = xaiHealth();
  if (health.status === "RATE_LIMITED" || health.status === "DISABLED") return null;

  const stateSummary = summarizeState(input.state);
  const userContent = `Owner message:\n${input.message}\n\nCurrent state:\n${stateSummary || "(no state provided)"}`;

  const result = await callXai<{
    answer: string;
    proposedChanges: OwnerProposedChange[];
    toolCalls?: OwnerToolCall[];
  }>({
    reason: "OWNER_DIALOG",
    model: input.model || env.configuredModel || undefined,
    messages: [
      { role: "system", content: input.systemPrompt },
      { role: "user", content: userContent },
    ],
    jsonSchema: RESPONSE_SCHEMA,
    temperature: 0.35,
    maxOutputTokens: 900,
    timeoutMs: 45_000,
  });

  if (!result.ok) return null;
  let parsed: {
    answer?: string;
    proposedChanges?: OwnerProposedChange[];
    toolCalls?: OwnerToolCall[];
  } = {};
  if (result.json && typeof result.json === "object") {
    parsed = result.json as typeof parsed;
  } else {
    try {
      parsed = JSON.parse(result.text) as typeof parsed;
    } catch {
      return {
        answer: result.text.trim() || "Grok responded without structured JSON.",
        proposedChanges: [],
        source: "xai",
        model: result.model,
      };
    }
  }

  return {
    answer:
      typeof parsed.answer === "string" && parsed.answer.trim().length > 0
        ? parsed.answer
        : "Done — see proposed changes.",
    proposedChanges: validateProposed(parsed.proposedChanges),
    toolCalls: Array.isArray(parsed.toolCalls) ? parsed.toolCalls : undefined,
    source: "xai",
    model: result.model,
  };
}

/**
 * Handle one owner message. Never throws.
 * Preference order: xAI/Grok → OpenAI → deterministic.
 */
export async function handleOwnerMessage(input: {
  message: string;
  state: OwnerDialogState;
  systemPromptOverride?: string;
  model?: string;
  preferProvider?: "xai" | "openai" | "auto";
}): Promise<OwnerDialogResult> {
  const message = String(input.message ?? "").slice(0, 4000);
  if (!message.trim()) {
    return {
      answer: "Say something specific — I'll turn it into a plan.",
      proposedChanges: [],
      source: "deterministic",
      reason: "empty_message",
    };
  }

  const system = input.systemPromptOverride ?? defaultSystemPrompt();
  const prefer = input.preferProvider ?? "auto";

  if (prefer === "xai" || prefer === "auto") {
    const xai = await tryXaiDialog({
      message,
      state: input.state,
      systemPrompt: system,
      model: input.model,
    });
    if (xai) return xai;
  }

  if ((prefer === "openai" || prefer === "auto") && hasOpenAIKey()) {
    const stateSummary = summarizeState(input.state);
    const userContent = `Owner message:\n${message}\n\nCurrent state:\n${stateSummary || "(no state provided)"}`;
    const result = await callOpenAI<{
      answer: string;
      proposedChanges: OwnerProposedChange[];
      toolCalls?: OwnerToolCall[];
    }>({
      model: input.model ?? DEFAULT_MODELS.cheap,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
      jsonSchema: RESPONSE_SCHEMA,
      temperature: 0.4,
      maxOutputTokens: 700,
    });

    if (result.ok) {
      const raw = result.data;
      return {
        answer:
          typeof raw.answer === "string" && raw.answer.trim().length > 0
            ? raw.answer
            : "Done — see proposed changes.",
        proposedChanges: validateProposed(raw.proposedChanges),
        toolCalls: Array.isArray(raw.toolCalls) ? raw.toolCalls : undefined,
        source: "openai",
        model: input.model ?? DEFAULT_MODELS.cheap,
      };
    }

    return deterministicFallback({
      message,
      state: input.state,
      reason: result.reason,
    });
  }

  return deterministicFallback({
    message,
    state: input.state,
    reason: prefer === "xai" ? "xai_unavailable" : "no_ai_provider",
  });
}
