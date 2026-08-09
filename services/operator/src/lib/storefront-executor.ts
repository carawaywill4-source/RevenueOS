/**
 * Execute commercial actions on the live Vercel storefront (filesystem +
 * platform API keys) while Mac Core remains the brain/scheduler.
 */

import type { SafeAction } from "@revenueos/core";
import { listPermissionlessSafeActions } from "@revenueos/storefront-kit";

export function listStorefrontSafeActions(): SafeAction[] {
  try {
    return listPermissionlessSafeActions();
  } catch {
    return [];
  }
}

export async function executeOnStorefront(input: {
  appUrl: string;
  cronSecret: string;
  action: SafeAction;
}): Promise<{ ok: boolean; detail: string; url?: string }> {
  const base = input.appUrl.replace(/\/$/, "");
  const res = await fetch(`${base}/api/owner/execute`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.cronSecret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      actionType: input.action.type,
      payload: input.action.payload ?? {},
    }),
    signal: AbortSignal.timeout(110_000),
  });
  const text = await res.text();
  let json: { ok?: boolean; detail?: string; url?: string; error?: string } = {};
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    return {
      ok: false,
      detail: `storefront execute HTTP ${res.status}: ${text.slice(0, 200)}`,
    };
  }
  if (!res.ok) {
    return {
      ok: false,
      detail: json.detail || json.error || `storefront HTTP ${res.status}`,
    };
  }
  return {
    ok: Boolean(json.ok),
    detail: json.detail ?? "storefront execute",
    url: json.url,
  };
}
