/**
 * End-to-end commercial tracing.
 * decision → channel action → visit → checkout → purchase → belief update
 */

import { randomBytes } from "node:crypto";

export function newTraceId(prefix = "atrace"): string {
  return `${prefix}_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
}

export function extractTraceIdFromUrl(url: string): string | undefined {
  try {
    const u = new URL(url);
    return (
      u.searchParams.get("ros_trace") ??
      u.searchParams.get("trace_id") ??
      undefined
    );
  } catch {
    return undefined;
  }
}

export function attachTraceToUrl(url: string, traceId: string): string {
  try {
    const u = new URL(url);
    if (!u.searchParams.has("ros_trace")) {
      u.searchParams.set("ros_trace", traceId);
    }
    return u.toString();
  } catch {
    return url;
  }
}
