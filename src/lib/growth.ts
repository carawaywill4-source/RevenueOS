import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const GROWTH_EVENT_NAMES = [
  "landing_view",
  "builder_started",
  "builder_step_completed",
  "draft_generated",
  "draft_edited",
  "checkout_started",
  "checkout_cancelled",
  "purchase_completed",
  "fulfillment_completed",
  "fulfillment_failed",
  "memorial_viewed",
  "pdf_downloaded",
  "review_submitted",
  "memorial_shared",
] as const;

const pageSchema = z.enum([
  "home",
  "funeral_program",
  "obituary",
  "celebration",
  "resources",
  "obituary_templates",
  "order_of_service_templates",
  "funeral_readings",
  "eulogy_examples",
  "funeral_program_word",
  "funeral_pamphlet",
  "funeral_program_google_docs",
  "where_to_print",
  "funeral_program_cost",
  "funeral_program_examples",
]);
const campaignValueSchema = z.string().regex(/^[a-zA-Z0-9._~-]{1,64}$/);
const referrerHostSchema = z.string().regex(/^[a-zA-Z0-9.-]{1,253}$/);
const themeSchema = z.enum(["garden", "classic", "sky"]);

const baseEventSchema = z.object({
  sessionId: z.string().uuid(),
});

export const growthEventSchema = z.discriminatedUnion("name", [
  baseEventSchema.extend({
    name: z.literal("landing_view"),
    metadata: z
      .object({
        page: pageSchema,
        source: campaignValueSchema.optional(),
        medium: campaignValueSchema.optional(),
        campaign: campaignValueSchema.optional(),
        referrerHost: referrerHostSchema.optional(),
      })
      .strict(),
  }),
  baseEventSchema.extend({
    name: z.literal("builder_started"),
    metadata: z
      .object({ entry: z.enum(["home", "restart"]) })
      .strict(),
  }),
  baseEventSchema.extend({
    name: z.literal("builder_step_completed"),
    metadata: z
      .object({
        step: z.enum(["details", "memories", "style", "preview"]),
      })
      .strict(),
  }),
  baseEventSchema.extend({
    name: z.literal("draft_generated"),
    metadata: z.object({ theme: themeSchema }).strict(),
  }),
  baseEventSchema.extend({
    name: z.literal("draft_edited"),
    metadata: z
      .object({
        section: z.enum(["heading", "obituary", "remembrance", "closing"]),
      })
      .strict(),
  }),
  baseEventSchema.extend({
    name: z.literal("checkout_started"),
    metadata: z
      .object({ theme: themeSchema, hasPhoto: z.boolean() })
      .strict(),
  }),
  baseEventSchema.extend({
    name: z.literal("checkout_cancelled"),
    metadata: z
      .object({ stage: z.enum(["checkout", "payment"]) })
      .strict(),
  }),
  baseEventSchema.extend({
    name: z.literal("memorial_shared"),
    metadata: z
      .object({ method: z.enum(["native", "copy", "qr"]) })
      .strict(),
  }),
]);

const cancellationReasonSchema = z.enum([
  "too_expensive",
  "not_ready",
  "technical_issue",
  "privacy_concern",
  "other_no_comment",
]);

const draftQualityReasonSchema = z.enum([
  "too_generic",
  "inaccurate",
  "tone",
  "missing_details",
  "good",
]);

export const customerFeedbackSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("cancellation"),
      sessionId: z.string().uuid(),
      reason: cancellationReasonSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("draft_quality"),
      sessionId: z.string().uuid(),
      rating: z.number().int().min(1).max(5),
      reason: draftQualityReasonSchema.optional(),
    })
    .strict(),
]);

export function requestIsSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function cronRequestIsAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || !authorization?.startsWith("Bearer ")) return false;

  const supplied = authorization.slice("Bearer ".length);
  const expectedBuffer = Buffer.from(secret);
  const suppliedBuffer = Buffer.from(supplied);
  return (
    expectedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(expectedBuffer, suppliedBuffer)
  );
}

export function growthStorageIsConfigured() {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function isMissingGrowthStorageError(error: {
  code?: string;
  message?: string;
}) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST202" ||
    error.code === "PGRST205" ||
    Boolean(error.message?.includes("growth_events")) ||
    Boolean(error.message?.includes("customer_feedback")) ||
    Boolean(error.message?.includes("growth_report"))
  );
}

export async function getLastHourPulse(priceUsd = 34.99) {
  const end = new Date();
  const start = new Date(end.getTime() - 60 * 60 * 1000);
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const sb = getSupabaseAdmin();

  const [ordersRes, eventsRes] = await Promise.all([
    sb
      .from("orders")
      .select("id, status, fulfilled_at")
      .eq("status", "fulfilled")
      .gte("fulfilled_at", startIso)
      .lte("fulfilled_at", endIso),
    sb
      .from("growth_events")
      .select("event_name")
      .gte("created_at", startIso)
      .lte("created_at", endIso)
      .in("event_name", ["landing_view", "checkout_started", "purchase_completed"]),
  ]);

  const purchases = ordersRes.error ? 0 : (ordersRes.data ?? []).length;
  const events = eventsRes.error ? [] : (eventsRes.data ?? []);
  const landingViews = events.filter((e) => e.event_name === "landing_view").length;
  const checkouts = events.filter((e) => e.event_name === "checkout_started").length;
  const revenueUsd = Number((purchases * priceUsd).toFixed(2));

  return {
    windowStart: startIso,
    windowEnd: endIso,
    revenueUsd,
    purchases,
    landingViews,
    checkouts,
    zeroHour: revenueUsd <= 0,
  };
}

export async function getAggregateGrowthReport(days = 7) {
  const boundedDays = Math.min(90, Math.max(1, Math.trunc(days)));
  const end = new Date();
  const start = new Date(end.getTime() - boundedDays * 24 * 60 * 60 * 1000);
  const { data, error } = await getSupabaseAdmin().rpc("growth_report", {
    p_start: start.toISOString(),
    p_end: end.toISOString(),
  });

  if (error) throw error;
  return data;
}

export async function purgeExpiredGrowthEvents() {
  const { data, error } = await getSupabaseAdmin().rpc(
    "purge_expired_growth_events",
  );
  if (error) throw error;
  return typeof data === "number" ? data : 0;
}

type ServerGrowthEvent =
  | { name: "purchase_completed"; metadata?: Record<string, never> }
  | { name: "fulfillment_completed"; metadata?: Record<string, never> }
  | {
      name: "fulfillment_failed";
      metadata: {
        stage: "pdf" | "storage" | "email" | "database" | "unknown";
      };
    }
  | { name: "memorial_viewed"; metadata?: Record<string, never> }
  | { name: "pdf_downloaded"; metadata?: Record<string, never> }
  | { name: "review_submitted"; metadata: { rating: number } };

export async function recordServerGrowthEvent(
  sessionId: string | null | undefined,
  event: ServerGrowthEvent,
) {
  if (!sessionId || !growthStorageIsConfigured()) return;
  const { error } = await getSupabaseAdmin().from("growth_events").insert({
    event_name: event.name,
    session_id: sessionId,
    metadata: event.metadata ?? {},
  });
  if (error && !isMissingGrowthStorageError(error)) {
    console.error("Server growth event storage failed", {
      code: error.code,
      event: event.name,
    });
  }
}
