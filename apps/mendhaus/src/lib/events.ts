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
  name: MhEventName;
  sessionId: string;
  productId?: string;
  orderId?: string;
  attribution?: unknown;
  metadata?: Record<string, unknown>;
};

export async function recordEvent(input: EventInput) {
  if (!supabaseConfigured()) return;
  try {
    await getSupabaseAdmin().from("mh_events").insert({
      event_name: input.name,
      session_id: input.sessionId,
      product_id: input.productId ?? null,
      order_id: input.orderId ?? null,
      attribution: input.attribution ?? {},
      metadata: input.metadata ?? {},
    });
  } catch (error) {
    console.error("mh_events insert failed", error);
  }
}

/** Batch insert for high-traffic clients — single round-trip. */
export async function recordEvents(inputs: EventInput[]) {
  if (!supabaseConfigured() || !inputs.length) return;
  try {
    await getSupabaseAdmin().from("mh_events").insert(
      inputs.map((input) => ({
        event_name: input.name,
        session_id: input.sessionId,
        product_id: input.productId ?? null,
        order_id: input.orderId ?? null,
        attribution: input.attribution ?? {},
        metadata: input.metadata ?? {},
      })),
    );
  } catch (error) {
    console.error("mh_events batch insert failed", error);
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
