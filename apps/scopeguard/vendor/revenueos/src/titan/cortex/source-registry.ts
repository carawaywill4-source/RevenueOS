/**
 * SourceRegistry — never strip provenance.
 */

import { newId, type ExperimentStore } from "../../ledger/store";
import type { SourceClass, SourceRecord } from "./types";

const SOURCE_PURSUIT = "titan_cortex_source";

export function registerSource(input: {
  source_type: SourceClass;
  organization?: string;
  author?: string;
  domain?: string;
  uri_reference?: string;
  publication_date?: string;
  jurisdiction?: string;
  authority_level: number;
  primary_or_secondary?: SourceRecord["primary_or_secondary"];
  commercial_incentive?: number;
  reliability_history?: number;
  content_hash?: string;
  now?: Date;
}): SourceRecord {
  const now = (input.now ?? new Date()).toISOString();
  return {
    source_id: newId("csrc"),
    source_type: input.source_type,
    organization: input.organization,
    author: input.author,
    domain: input.domain,
    uri_reference: input.uri_reference,
    publication_date: input.publication_date,
    retrieval_date: now,
    jurisdiction: input.jurisdiction,
    authority_level: Math.max(0, Math.min(1, input.authority_level)),
    primary_or_secondary: input.primary_or_secondary ?? "unknown",
    commercial_incentive: input.commercial_incentive ?? 0,
    reliability_history: input.reliability_history ?? 0.5,
    content_hash: input.content_hash,
    control_plane_effect: "NONE",
  };
}

export async function persistSource(
  store: ExperimentStore,
  siteId: string,
  source: SourceRecord,
): Promise<void> {
  if (!store.appendPursuitEvent) return;
  await store.appendPursuitEvent({
    id: newId("tevt"),
    pursuitId: SOURCE_PURSUIT,
    siteId,
    eventType: "learned",
    detail: { titan: true, cortex: true, kind: "source", source },
    createdAt: source.retrieval_date,
  });
}

/** Built-in internal sources for RevenueOS commercial truth. */
export const INTERNAL_STRIPE_SOURCE = (): SourceRecord =>
  registerSource({
    source_type: "INTERNAL_COMMERCIAL",
    organization: "Stripe",
    domain: "stripe.com",
    authority_level: 0.95,
    primary_or_secondary: "primary",
    commercial_incentive: 0.1,
    reliability_history: 0.95,
  });

export const INTERNAL_APEX_SOURCE = (): SourceRecord =>
  registerSource({
    source_type: "INTERNAL_TELEMETRY",
    organization: "RevenueOS APEX",
    authority_level: 0.8,
    primary_or_secondary: "primary",
    commercial_incentive: 0,
    reliability_history: 0.8,
  });

export const INTERNAL_FORGE_SOURCE = (): SourceRecord =>
  registerSource({
    source_type: "INTERNAL_TELEMETRY",
    organization: "RevenueOS FORGE",
    authority_level: 0.8,
    primary_or_secondary: "primary",
    commercial_incentive: 0,
    reliability_history: 0.8,
  });
