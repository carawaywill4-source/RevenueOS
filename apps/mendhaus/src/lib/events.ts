import { supabaseConfigured, getSupabaseAdmin } from "./supabase";

export const MH_EVENTS = [
  "landing_view",
  "page_view",
  "product_view",
  "engagement",
  "scroll_depth",
  "cta_click",
  "add_to_cart",
  "cart_view",
  "checkout_started",
  "purchase",
  "refund",
] as const;

export type MhEventName = (typeof MH_EVENTS)[number];

export type EventInput = {
  eventId?: string;
  name: MhEventName;
  sessionId: string;
  productId?: string;
  orderId?: string;
  attribution?: unknown;
  metadata?: Record<string, unknown>;
};

export async function recordEvent(input: EventInput) {
  if (!supabaseConfigured()) return;
  const { error } = await getSupabaseAdmin().from("mh_events").insert({
    event_id: input.eventId ?? null,
    event_name: input.name,
    session_id: input.sessionId,
    product_id: input.productId ?? null,
    order_id: input.orderId ?? null,
    attribution: input.attribution ?? {},
    metadata: input.metadata ?? {},
  });
  // Idempotent replay of a client event is success.
  if (error && error.code !== "23505") throw new Error(`Event insert failed: ${error.message}`);
}

/** Batch insert for high-traffic clients — single round-trip. */
export async function recordEvents(inputs: EventInput[]) {
  if (!supabaseConfigured() || !inputs.length) return;
  const { error } = await getSupabaseAdmin().from("mh_events").upsert(
    inputs.map((input) => ({
      event_id: input.eventId ?? null,
      event_name: input.name,
      session_id: input.sessionId,
      product_id: input.productId ?? null,
      order_id: input.orderId ?? null,
      attribution: input.attribution ?? {},
      metadata: input.metadata ?? {},
    })),
    { onConflict: "event_id", ignoreDuplicates: true },
  );
  if (error) {
    throw new Error(`Event batch insert failed: ${error.message}`);
  }
}

export async function appendJournal(summary: string, detail: Record<string, unknown> = {}) {
  if (!supabaseConfigured()) return;
  try {
    await getSupabaseAdmin().from("mh_journal").insert({
      kind: "decision",
      summary,
      detail,
    });
  } catch (error) {
    console.error("mh_journal insert failed", error);
  }
}
