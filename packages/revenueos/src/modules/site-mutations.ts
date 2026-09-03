/**
 * Business-scoped site mutations for conversion limbs:
 *   change_default_cta | rewrite_page_copy | publish_bundle
 *
 * Safety:
 * - Requires explicit siteId (ScopeGuard boundary)
 * - Versioned previous state retained for rollback
 * - Never touches another business's files
 * - Never writes secrets
 * - Does not claim success without a durable write or verified remote effect
 */

import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { executeExitIntentDeploy } from "./exit-intent";
import { executeStripeOrderBumpDeploy } from "./stripe-order-bumps";

export type SiteMutationKind =
  | "change_default_cta"
  | "rewrite_page_copy"
  | "publish_bundle";

export type SiteMutationRecord = {
  siteId: string;
  kind: SiteMutationKind;
  version: number;
  patternKey: string | null;
  payload: Record<string, unknown>;
  previous: Record<string, unknown> | null;
  createdAt: string;
  reversible: true;
};

function mutationsRoot(rootDir: string): string {
  const base =
    process.env.REVENUEOS_DATA_DIR || path.join(rootDir, ".data", "revenueos");
  return path.join(base, "site-mutations");
}

function siteDir(rootDir: string, siteId: string): string {
  // ScopeGuard: path segment is exactly siteId; reject traversal.
  if (!siteId || siteId.includes("..") || siteId.includes("/") || siteId.includes("\\")) {
    throw new Error("scopeguard_invalid_siteId");
  }
  return path.join(mutationsRoot(rootDir), siteId);
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonAtomic(file: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await rename(tmp, file);
}

function copyFromPattern(
  kind: SiteMutationKind,
  patternKey: string | null,
  productName: string,
  priceUsd: number,
): Record<string, unknown> {
  const pk = (patternKey ?? "").toLowerCase();
  if (kind === "change_default_cta") {
    const variant = pk.includes("instant")
      ? "instant_download"
      : pk.includes("free")
        ? "start_free"
        : pk.includes("result")
          ? "get_result"
          : "buy_now";
    const labels: Record<string, string> = {
      buy_now: "Buy now",
      instant_download: "Instant download",
      start_free: "Start free",
      get_result: "Get the result",
    };
    return {
      ctaLabel: labels[variant] ?? "Buy now",
      ctaHref: "/api/checkout",
      variant,
      routeTopicCtaToCheckout: true,
    };
  }
  if (kind === "rewrite_page_copy") {
    if (pk.includes("guarantee") || pk.includes("refund")) {
      return {
        banner:
          "Full refund within 30 days, no questions asked.",
        section: "guarantee",
      };
    }
    if (pk.includes("urgency")) {
      return {
        banner: "Founding-customer price locked for the next 24h.",
        section: "urgency",
      };
    }
    if (pk.includes("trust")) {
      return {
        banner: "Powered by Stripe · SSL secured · 14-day refund",
        section: "trust",
      };
    }
    return {
      banner: `Clear offer: ${productName}`,
      section: "clarity",
    };
  }
  // publish_bundle
  const starter = Math.max(9, Math.min(29, Math.round(priceUsd * 0.35)));
  return {
    starterTierUsd: starter,
    label: `${productName} Starter`,
    description: `Lower-commitment starter tier for ${productName}. Upgrade credit applies to full product.`,
  };
}

async function tryStorefrontExecute(input: {
  appUrl: string;
  actionType: string;
  siteId: string;
  payload: Record<string, unknown>;
}): Promise<{ ok: boolean; detail: string }> {
  const secret = process.env.CRON_SECRET || process.env.OWNER_CRON_SECRET;
  if (!secret) {
    return { ok: false, detail: "storefront_push_skipped: no CRON_SECRET" };
  }
  const url = `${input.appUrl.replace(/\/$/, "")}/api/owner/execute`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
        "x-revenueos-site": input.siteId,
      },
      body: JSON.stringify({
        actionType: input.actionType,
        siteId: input.siteId,
        payload: input.payload,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const text = (await res.text()).slice(0, 200);
    if (res.ok) return { ok: true, detail: `storefront HTTP ${res.status}` };
    return {
      ok: false,
      detail: `storefront HTTP ${res.status}: ${text}`,
    };
  } catch (e) {
    return {
      ok: false,
      detail: `storefront error: ${(e as Error).message.slice(0, 120)}`,
    };
  }
}

export async function executeSiteMutation(input: {
  rootDir: string;
  siteId: string;
  kind: SiteMutationKind;
  appUrl: string;
  productName: string;
  priceUsd: number;
  patternKey?: string | null;
  payload?: Record<string, unknown>;
}): Promise<{
  ok: boolean;
  detail: string;
  url?: string;
  mutation?: SiteMutationRecord;
  realEffects: string[];
}> {
  if (!input.siteId) {
    return { ok: false, detail: "scopeguard_missing_siteId", realEffects: [] };
  }

  const dir = siteDir(input.rootDir, input.siteId);
  const currentFile = path.join(dir, "current.json");
  const historyDir = path.join(dir, "history");
  const previous = await readJson<SiteMutationRecord | null>(currentFile, null);

  if (previous && previous.siteId !== input.siteId) {
    return {
      ok: false,
      detail: "scopeguard_site_mismatch",
      realEffects: [],
    };
  }

  const payload = {
    ...copyFromPattern(
      input.kind,
      input.patternKey ?? null,
      input.productName,
      input.priceUsd,
    ),
    ...(input.payload ?? {}),
  };

  const mutation: SiteMutationRecord = {
    siteId: input.siteId,
    kind: input.kind,
    version: (previous?.version ?? 0) + 1,
    patternKey: input.patternKey ?? null,
    payload,
    previous: previous
      ? {
          version: previous.version,
          kind: previous.kind,
          payload: previous.payload,
          createdAt: previous.createdAt,
        }
      : null,
    createdAt: new Date().toISOString(),
    reversible: true,
  };

  await writeJsonAtomic(currentFile, mutation);
  await writeJsonAtomic(
    path.join(historyDir, `v${mutation.version}.json`),
    mutation,
  );

  const realEffects: string[] = [`durable_mutation:v${mutation.version}`];

  // Materialize buyer-facing artifacts via existing safe limbs (same site only).
  if (input.kind === "change_default_cta" || input.kind === "rewrite_page_copy") {
    const exit = await executeExitIntentDeploy({
      rootDir: input.rootDir,
      siteId: input.siteId,
      appUrl: input.appUrl,
      headline:
        input.kind === "change_default_cta"
          ? String(payload.ctaLabel ?? "Buy now")
          : String(payload.banner ?? input.productName).slice(0, 80),
      subhead:
        input.kind === "rewrite_page_copy"
          ? String(payload.banner ?? "")
          : `Direct checkout for ${input.productName}`,
      ctaLabel: String(payload.ctaLabel ?? "Buy now"),
    });
    realEffects.push(`exit_intent:${exit.detail}`);
  }

  if (input.kind === "publish_bundle") {
    const starter = Number(payload.starterTierUsd) || 9;
    const bump = await executeStripeOrderBumpDeploy({
      rootDir: input.rootDir,
      siteId: input.siteId,
      bumpPriceUsd: starter,
      bumpLabel: String(payload.label ?? `${input.productName} Starter`),
      bumpDescription: String(payload.description ?? ""),
    });
    if (bump.ok) {
      realEffects.push(`order_bump:${bump.detail}`);
    } else {
      realEffects.push(`order_bump_failed:${bump.detail}`);
    }
  }

  const remote = await tryStorefrontExecute({
    appUrl: input.appUrl,
    actionType: input.kind,
    siteId: input.siteId,
    payload: { ...payload, mutationVersion: mutation.version },
  });
  realEffects.push(remote.detail);

  // Success = durable Core mutation written. Remote push is best-effort
  // (many Vercel apps lack /api/owner/execute); exit-intent / order-bump
  // files are additional real materializations on the operator host.
  const materialOk =
    realEffects.some((e) => e.startsWith("durable_mutation:")) &&
    (input.kind !== "publish_bundle" ||
      realEffects.some((e) => e.startsWith("order_bump:") && !e.includes("failed")));

  return {
    ok: materialOk,
    detail: `${input.kind} siteId=${input.siteId} v${mutation.version}: ${realEffects.join(" | ")}`,
    url: currentFile,
    mutation,
    realEffects,
  };
}

export async function rollbackSiteMutation(input: {
  rootDir: string;
  siteId: string;
}): Promise<{ ok: boolean; detail: string }> {
  const dir = siteDir(input.rootDir, input.siteId);
  const currentFile = path.join(dir, "current.json");
  const current = await readJson<SiteMutationRecord | null>(currentFile, null);
  if (!current?.previous) {
    return { ok: false, detail: "no_previous_version" };
  }
  if (current.siteId !== input.siteId) {
    return { ok: false, detail: "scopeguard_site_mismatch" };
  }
  const restored: SiteMutationRecord = {
    siteId: input.siteId,
    kind: current.previous.kind as SiteMutationKind,
    version: Number(current.previous.version) || current.version,
    patternKey: null,
    payload: (current.previous.payload as Record<string, unknown>) ?? {},
    previous: {
      version: current.version,
      kind: current.kind,
      payload: current.payload,
      createdAt: current.createdAt,
    },
    createdAt: new Date().toISOString(),
    reversible: true,
  };
  await writeJsonAtomic(currentFile, restored);
  return {
    ok: true,
    detail: `rolled_back ${input.siteId} to v${restored.version}`,
  };
}
