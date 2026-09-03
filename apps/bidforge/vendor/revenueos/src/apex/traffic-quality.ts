/**
 * Separate RAW / LIKELY_HUMAN / QUALIFIED traffic.
 * Never optimize from inflated bot traffic.
 */

import { looksLikeBot } from "../modules/beacon";
import type { TrafficQuality } from "./types";

const INTERNAL_MARKERS = [
  "revenueos",
  "localhost",
  "127.0.0.1",
  "vercel-favicon",
  "uptimerobot",
  "statuscake",
  "pingdom",
  "datadog",
];

export function classifyTrafficQuality(input: {
  ua?: string;
  ip?: string;
  referrer?: string;
  path?: string;
  signedAttribution?: boolean;
  isTestPayment?: boolean;
  isInternal?: boolean;
}): { quality: TrafficQuality; reasons: string[] } {
  const reasons: string[] = [];
  if (input.isTestPayment) {
    return { quality: "RAW", reasons: ["test_payment"] };
  }
  if (input.isInternal) {
    return { quality: "RAW", reasons: ["internal_traffic"] };
  }
  const blob = [
    input.ua ?? "",
    input.referrer ?? "",
    input.path ?? "",
  ]
    .join(" ")
    .toLowerCase();
  if (INTERNAL_MARKERS.some((m) => blob.includes(m))) {
    // localhost referrer alone is not always junk (local dual-run), but UA bots are.
    if (looksLikeBot(input.ua) || blob.includes("uptimerobot")) {
      return { quality: "RAW", reasons: ["internal_or_monitor"] };
    }
  }
  if (looksLikeBot(input.ua)) {
    return { quality: "RAW", reasons: ["bot_ua"] };
  }
  if (!input.ua) {
    return { quality: "RAW", reasons: ["missing_ua"] };
  }

  reasons.push("human_ua");
  if (input.signedAttribution) {
    reasons.push("signed_utm");
    return { quality: "QUALIFIED", reasons };
  }
  // Has a real UA and wasn't bot-filtered → likely human; qualification needs more signal.
  return { quality: "LIKELY_HUMAN", reasons };
}

export function shouldLearnFromTraffic(quality: TrafficQuality): boolean {
  return quality === "LIKELY_HUMAN" || quality === "QUALIFIED";
}
