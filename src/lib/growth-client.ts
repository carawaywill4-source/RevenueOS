"use client";

export type GrowthAttribution = {
  source?: string;
  medium?: string;
  campaign?: string;
  referrerHost?: string;
  capturedAt: string;
};

export type GrowthEvent =
  | {
      name: "landing_view";
      metadata: {
        page:
          | "home"
          | "funeral_program"
          | "obituary"
          | "celebration"
          | "resources"
          | "obituary_templates"
          | "order_of_service_templates"
          | "funeral_readings"
          | "eulogy_examples"
          | "funeral_program_word"
          | "funeral_pamphlet"
          | "funeral_program_google_docs"
          | "where_to_print"
          | "funeral_program_cost"
          | "funeral_program_examples";
        source?: string;
        medium?: string;
        campaign?: string;
        referrerHost?: string;
      };
    }
  | {
      name: "builder_started";
      metadata: { entry: "home" | "restart" };
    }
  | {
      name: "builder_step_completed";
      metadata: { step: "details" | "memories" | "style" | "preview" };
    }
  | {
      name: "draft_generated";
      metadata: { theme: "garden" | "classic" | "sky" };
    }
  | {
      name: "draft_edited";
      metadata: {
        section: "heading" | "obituary" | "remembrance" | "closing";
      };
    }
  | {
      name: "checkout_started";
      metadata: {
        theme: "garden" | "classic" | "sky";
        hasPhoto: boolean;
      };
    }
  | {
      name: "checkout_cancelled";
      metadata: { stage: "checkout" | "payment" };
    }
  | {
      name: "memorial_shared";
      metadata: { method: "native" | "copy" | "qr" };
    };

export type CustomerFeedback =
  | {
      type: "cancellation";
      reason:
        | "too_expensive"
        | "not_ready"
        | "technical_issue"
        | "privacy_concern"
        | "other_no_comment";
    }
  | {
      type: "draft_quality";
      rating: 1 | 2 | 3 | 4 | 5;
      reason?:
        | "too_generic"
        | "inaccurate"
        | "tone"
        | "missing_details"
        | "good";
    };

const SESSION_ID_KEY = "tribute_growth_session_id";
const ATTRIBUTION_KEY = "tribute_first_touch_attribution";
const SAFE_CAMPAIGN_VALUE = /^[a-zA-Z0-9._~-]{1,64}$/;
const SAFE_REFERRER_HOST = /^[a-zA-Z0-9.-]{1,253}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const UUID_VALUE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Families routinely research, talk it over, and return days later, so
// first-touch attribution outlives the tab that created it.
const ATTRIBUTION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function readSessionValue(key: string) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSessionValue(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Analytics must never block the memorial flow.
  }
}

function readPersistentValue(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writePersistentValue(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private browsing and blocked storage must stay silent.
  }
}

export function getGrowthSessionId() {
  if (typeof window === "undefined") return null;

  const existing = readSessionValue(SESSION_ID_KEY);
  if (existing && UUID_VALUE.test(existing)) return existing;

  const sessionId = window.crypto.randomUUID();
  writeSessionValue(SESSION_ID_KEY, sessionId);
  return sessionId;
}

function safeCampaignValue(value: string | null) {
  return value && SAFE_CAMPAIGN_VALUE.test(value) ? value : undefined;
}

function parseStoredAttribution(value: string): GrowthAttribution | null {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const allowedKeys = new Set([
      "source",
      "medium",
      "campaign",
      "referrerHost",
      "capturedAt",
    ]);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      Object.keys(parsed).some((key) => !allowedKeys.has(key)) ||
      typeof parsed.capturedAt !== "string" ||
      !ISO_TIMESTAMP.test(parsed.capturedAt) ||
      Number.isNaN(Date.parse(parsed.capturedAt))
    ) {
      return null;
    }

    for (const key of ["source", "medium", "campaign"] as const) {
      const field = parsed[key];
      if (
        field !== undefined &&
        (typeof field !== "string" || !SAFE_CAMPAIGN_VALUE.test(field))
      ) {
        return null;
      }
    }

    if (
      parsed.referrerHost !== undefined &&
      (typeof parsed.referrerHost !== "string" ||
        !SAFE_REFERRER_HOST.test(parsed.referrerHost))
    ) {
      return null;
    }

    return parsed as GrowthAttribution;
  } catch {
    return null;
  }
}

export function captureFirstTouchAttribution(): GrowthAttribution | null {
  if (typeof window === "undefined") return null;

  const existing =
    readPersistentValue(ATTRIBUTION_KEY) ?? readSessionValue(ATTRIBUTION_KEY);
  if (existing) {
    const parsed = parseStoredAttribution(existing);
    if (parsed && Date.now() - Date.parse(parsed.capturedAt) < ATTRIBUTION_TTL_MS) {
      return parsed;
    }
  }

  const params = new URLSearchParams(window.location.search);
  let referrerHost: string | undefined;
  if (document.referrer) {
    try {
      const referrer = new URL(document.referrer);
      if (referrer.origin !== window.location.origin) {
        const hostname = referrer.hostname.slice(0, 253).toLowerCase();
        referrerHost = SAFE_REFERRER_HOST.test(hostname) ? hostname : undefined;
      }
    } catch {
      // Ignore malformed referrers.
    }
  }

  const attribution: GrowthAttribution = {
    source: safeCampaignValue(params.get("utm_source")),
    medium: safeCampaignValue(params.get("utm_medium")),
    campaign: safeCampaignValue(params.get("utm_campaign")),
    referrerHost,
    capturedAt: new Date().toISOString(),
  };

  const serialised = JSON.stringify(attribution);
  writePersistentValue(ATTRIBUTION_KEY, serialised);
  writeSessionValue(ATTRIBUTION_KEY, serialised);
  return attribution;
}

export function getFirstTouchAttribution() {
  return captureFirstTouchAttribution();
}

export async function trackGrowthEvent(event: GrowthEvent) {
  const sessionId = getGrowthSessionId();
  if (!sessionId) return false;

  try {
    const response = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
      body: JSON.stringify({ sessionId, ...event }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function submitCustomerFeedback(feedback: CustomerFeedback) {
  const sessionId = getGrowthSessionId();
  if (!sessionId) return false;

  try {
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ sessionId, ...feedback }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
