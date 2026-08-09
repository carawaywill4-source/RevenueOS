/**
 * Execute brain-selected commercial actions via:
 *   1) @revenueos/core agent executors (when possible on Mac)
 *   2) live storefront /api/owner/execute (same limbs as Vercel cron)
 */

import {
  executeAgentAction,
  isAgentSafeAction,
  listAgentSafeActions,
  type SafeAction,
} from "@revenueos/core";
import type { ExperimentStore } from "@revenueos/core";
import type { OperatorBusinessManifest } from "@revenueos/core";
import {
  executeOnStorefront,
  listStorefrontSafeActions,
} from "./storefront-executor.js";

export function listCutoverSafeActions(): SafeAction[] {
  const byType = new Map<string, SafeAction>();
  for (const a of listAgentSafeActions()) byType.set(a.type, a);
  for (const a of listStorefrontSafeActions()) byType.set(a.type, a);
  return [...byType.values()];
}

export async function executeOperatorCommercialAction(input: {
  action: SafeAction;
  manifest: OperatorBusinessManifest;
  store: ExperimentStore;
  cronSecret?: string;
}): Promise<{ ok: boolean; detail: string; url?: string }> {
  const { action, manifest, store, cronSecret } = input;

  // Prefer storefront limb for platform/API actions (YouTube/GSC/Gumroad/publish).
  if (cronSecret) {
    const remote = await executeOnStorefront({
      appUrl: manifest.appUrl,
      cronSecret,
      action,
    });
    if (remote.ok || !/unknown_or_disallowed|Unauthorized|HTTP 401|HTTP 404/.test(remote.detail)) {
      return remote;
    }
  }

  if (isAgentSafeAction(action.type)) {
    const result = await executeAgentAction(
      {
        siteId: manifest.siteId,
        displayName: manifest.displayName,
        industry: manifest.industry,
        productName: manifest.product.name,
        productDescription:
          manifest.product.audience ??
          `${manifest.product.name} for ${manifest.industry}`,
        priceUsd: manifest.product.priceUsd,
        audience: manifest.product.audience,
        siteUrl: manifest.appUrl,
        store,
      },
      action.type,
      (action as { payload?: Record<string, unknown> }).payload ?? {},
    );
    if (result) return result;
  }

  return {
    ok: false,
    detail: `no Mac/storefront executor for ${action.type}`,
  };
}
