/**
 * Durable work claims — not in-memory mutexes for production truth.
 * This store can sit in front of Postgres SKIP LOCKED / ExperimentStore leases.
 */

import type { MutationDomain, WorkClaim } from "./types";

export type LockStore = {
  claims: Map<string, WorkClaim>;
};

export function createLockStore(): LockStore {
  return { claims: new Map() };
}

export function resourceKey(parts: {
  business_id?: string | null;
  portfolio?: boolean;
  domain: MutationDomain;
  facet?: string;
}): string {
  if (parts.portfolio) {
    return `portfolio:${(parts.facet ?? parts.domain).toLowerCase()}`;
  }
  const biz = parts.business_id ?? "unknown";
  const facet = parts.facet ?? parts.domain.toLowerCase();
  return `business:${biz}:${facet}`;
}

export function claimWork(
  store: LockStore,
  input: {
    resource_key: string;
    domain: MutationDomain;
    owner: string;
    command_id?: string | null;
    business_id?: string | null;
    lease_ms?: number;
    now?: Date;
  },
): { store: LockStore; claim: WorkClaim | null; reason: string } {
  const now = input.now ?? new Date();
  const existing = store.claims.get(input.resource_key);
  if (existing && Date.parse(existing.lease_until) > now.getTime()) {
    if (existing.owner === input.owner) {
      return { store, claim: existing, reason: "renewed_same_owner" };
    }
    return {
      store,
      claim: null,
      reason: `held_by:${existing.owner}:until:${existing.lease_until}`,
    };
  }
  const claim: WorkClaim = {
    resource_key: input.resource_key,
    domain: input.domain,
    owner: input.owner,
    lease_until: new Date(
      now.getTime() + (input.lease_ms ?? 60_000),
    ).toISOString(),
    command_id: input.command_id ?? null,
    business_id: input.business_id ?? null,
  };
  const next = new Map(store.claims);
  next.set(input.resource_key, claim);
  return { store: { claims: next }, claim, reason: "claimed" };
}

export function releaseWork(
  store: LockStore,
  resourceKeyStr: string,
  owner: string,
): LockStore {
  const existing = store.claims.get(resourceKeyStr);
  if (!existing || existing.owner !== owner) return store;
  const next = new Map(store.claims);
  next.delete(resourceKeyStr);
  return { claims: next };
}

/** Expire stale leases — safe after worker crash. */
export function expireLeases(store: LockStore, now = new Date()): LockStore {
  const next = new Map<string, WorkClaim>();
  for (const [k, v] of store.claims) {
    if (Date.parse(v.lease_until) > now.getTime()) next.set(k, v);
  }
  return { claims: next };
}
