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
 * The LLM is called via the read-only openai-client (import only). When the
 * model or API is unavailable, a deterministic fallback still produces a
 * usable answer + zero proposed changes so the operator flow never dead-ends.
 *
 * All op values are enumerated and validated — the UI must inspect and
 * confirm before any change is applied.
 */

import { callOpenAI, hasOpenAIKey, DEFAULT_MODELS } from "./openai-client";

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
  | "add_note";

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
};

export type OwnerDialogResult = {
  answer: string;
  proposedChanges: OwnerProposedChange[];
  toolCalls?: OwnerToolCall[];
  source: "ai" | "deterministic";
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

function deterministicFallback(input: {
  message: string;
  state: OwnerDialogState;
  reason: string;
}): OwnerDialogResult {
  const msg = input.message.toLowerCase();
  const changes: OwnerProposedChange[] = [];
  const businesses = input.state.activeBusinesses ?? [];

  // Very light keyword heuristics — enough to keep the chat useful offline.
  if (
    /\bfocus (on|)\s*(\S+)/.test(msg) ||
    /\bprioritize\s+(\S+)/.test(msg)
  ) {
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

  return {
    answer:
      changes.length > 0
        ? `Understood — I've drafted ${changes.length} change(s). Review below before applying. (offline fallback)`
        : "I couldn't reach the strategist model; I heard you but I'm not going to make changes without confirmation. (offline fallback)",
    proposedChanges: changes,
    source: "deterministic",
    reason: input.reason,
  };
}

/**
 * Handle one owner message. Never throws.
 */
export async function handleOwnerMessage(input: {
  message: string;
  state: OwnerDialogState;
  systemPromptOverride?: string;
  model?: string;
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

  if (!hasOpenAIKey()) {
    return deterministicFallback({
      message,
      state: input.state,
      reason: "no_openai_key",
    });
  }

  const system =
    input.systemPromptOverride ??
    [
      "You are RevenueOS operator dialog.",
      "You output STRICT JSON matching the provided schema.",
      "Only include proposedChanges you're confident the operator will approve.",
      "Never propose changes that would require paid ads or owner logins.",
      "answer must be concise, dollar-anchored, and reference sites by siteId.",
    ].join(" ");

  const stateSummary = summarizeState(input.state);
  const userContent =
    `Owner message:\n${message}\n\nCurrent state:\n${stateSummary || "(no state provided)"}`;

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

  if (!result.ok) {
    return deterministicFallback({
      message,
      state: input.state,
      reason: result.reason,
    });
  }

  const raw = result.data;
  const changes = Array.isArray(raw.proposedChanges) ? raw.proposedChanges : [];
  const validated: OwnerProposedChange[] = [];
  for (const c of changes) {
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

  return {
    answer:
      typeof raw.answer === "string" && raw.answer.trim().length > 0
        ? raw.answer
        : "Done — see proposed changes.",
    proposedChanges: validated,
    toolCalls: Array.isArray(raw.toolCalls) ? raw.toolCalls : undefined,
    source: "ai",
  };
}
