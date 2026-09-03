/**
 * Shared allowlisted platform-state collection for dry-run and real import.
 * Never loads mh_* tables.
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { resolvePaths } from "./paths.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "../../..");

export type ProvenanceTag =
  | "SUPABASE_LEGACY"
  | "LOCAL_LEDGER"
  | "ENGINE_CHECKPOINT"
  | "SCHEDULER_CHECKPOINT";

export type Class =
  | "platform"
  | "platform_tenant"
  | "mendhaus_only_excluded"
  | "mixed_split_platform"
  | "mixed_excluded"
  | "unknown";

export type TargetTable =
  | "ros_businesses"
  | "ros_experiments"
  | "ros_pursuits"
  | "ros_events"
  | "ros_lessons"
  | "ros_scorecards"
  | "ros_claims"
  | "ros_leases"
  | "ros_channels"
  | "ros_portfolio_state"
  | "ros_activity"
  | "ros_config_meta"
  | "excluded";

export type ImportCandidate = {
  stableId: string;
  target: TargetTable;
  classification: Class;
  provenance: ProvenanceTag;
  siteId?: string | null;
  updatedAt: string | null;
  contentHash: string;
  domain: string;
  /** Row fields ready for INSERT (table-specific). */
  row: Record<string, unknown>;
};

export type CollectStats = {
  discoveredBySource: Record<ProvenanceTag, number>;
  discoveredByDomain: Record<string, number>;
  classified: Record<Class, number>;
  mendhausExcluded: number;
  mixedSplitPlatform: number;
  mixedExcluded: number;
  duplicatesDetected: number;
  conflicts: number;
  newerLocalReplacements: number;
  unknown: number;
  projected: Record<string, number>;
  businessesSeen: Set<string>;
  conflictSamples: Array<Record<string, unknown>>;
  unknownSamples: Array<Record<string, unknown>>;
  ledgerSitesScanned: number;
  attributionsRowsSkippedEmpty: number;
  denylistNeverImported: string[];
};

function iso(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v);
  if (!s) return null;
  const d = Date.parse(s);
  return Number.isFinite(d) ? new Date(d).toISOString() : s;
}

function hashDoc(v: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(v ?? null))
    .digest("hex")
    .slice(0, 16);
}

function newer(a: string | null, b: string | null): number {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  return Date.parse(a) - Date.parse(b);
}

function emptyStats(): CollectStats {
  return {
    discoveredBySource: {
      SUPABASE_LEGACY: 0,
      LOCAL_LEDGER: 0,
      ENGINE_CHECKPOINT: 0,
      SCHEDULER_CHECKPOINT: 0,
    },
    discoveredByDomain: {},
    classified: {
      platform: 0,
      platform_tenant: 0,
      mendhaus_only_excluded: 0,
      mixed_split_platform: 0,
      mixed_excluded: 0,
      unknown: 0,
    },
    mendhausExcluded: 0,
    mixedSplitPlatform: 0,
    mixedExcluded: 0,
    duplicatesDetected: 0,
    conflicts: 0,
    newerLocalReplacements: 0,
    unknown: 0,
    projected: {},
    businessesSeen: new Set(),
    conflictSamples: [],
    unknownSamples: [],
    ledgerSitesScanned: 0,
    attributionsRowsSkippedEmpty: 0,
    denylistNeverImported: [
      "mh_customers",
      "mh_orders",
      "mh_events",
      "mh_journal",
      "mh_merch_state",
      "mh_supplier_listings",
      "mh_discovery_state",
    ],
  };
}

function classifyExperimentRow(row: {
  id: string;
  site_id: string;
  category: string | null;
  status: string;
  document: unknown;
}): { target: TargetTable; classification: Class; domain: string } {
  const cat = row.category ?? "";
  const id = row.id;
  if (id.startsWith("ros:opclaim:") || id.startsWith("operator_claim:")) {
    return { target: "ros_claims", classification: "platform", domain: "claims" };
  }
  if (cat === "__ros_pursuit__" || id.startsWith("ros:pursuit:")) {
    return { target: "ros_pursuits", classification: "platform", domain: "pursuits" };
  }
  if (cat === "__ros_pursuit_event__" || id.startsWith("ros:pevt:")) {
    return { target: "ros_events", classification: "platform", domain: "pursuit_events" };
  }
  if (cat === "__ros_lease__" || id.startsWith("ros:lease:")) {
    return { target: "ros_leases", classification: "platform", domain: "leases" };
  }
  if (row.site_id === "mendhaus") {
    return {
      target: "ros_experiments",
      classification: "platform_tenant",
      domain: "experiments",
    };
  }
  return { target: "ros_experiments", classification: "platform", domain: "experiments" };
}

function classifyLessonRow(row: {
  site_id: string | null;
  scope: string;
  document: any;
}): { target: TargetTable; classification: Class; domain: string } {
  const transferable =
    row.document?.transferable === true ||
    row.scope === "global" ||
    row.scope === "industry";
  if (row.scope === "global" || row.scope === "industry") {
    return {
      target: "ros_lessons",
      classification: "mixed_split_platform",
      domain: "lessons",
    };
  }
  if (row.site_id && row.site_id !== "mendhaus") {
    return { target: "ros_lessons", classification: "platform", domain: "lessons" };
  }
  if (transferable) {
    return {
      target: "ros_lessons",
      classification: "mixed_split_platform",
      domain: "lessons",
    };
  }
  return {
    target: "excluded",
    classification: "mixed_excluded",
    domain: "lessons_mendhaus_site",
  };
}

function docOf(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return { value: v };
}

function mapExperimentPayload(
  target: TargetTable,
  row: any,
  provenance: ProvenanceTag,
): Record<string, unknown> {
  const document = docOf(row.document ?? row);
  const siteId = String(row.site_id ?? row.siteId ?? "");
  const updatedAt =
    iso(row.updated_at ?? row.updatedAt ?? row.created_at ?? row.createdAt) ??
    new Date().toISOString();

  if (target === "ros_claims") {
    const owner = String(
      document.owner ?? document.operator ?? "legacy-import",
    );
    const leaseUntil =
      iso(document.leaseUntil ?? document.lease_until ?? updatedAt) ?? updatedAt;
    const claimedAt =
      iso(document.claimedAt ?? document.claimed_at ?? updatedAt) ?? updatedAt;
    return {
      site_id: siteId || String(document.siteId ?? "unknown"),
      owner,
      lease_until: leaseUntil,
      claimed_at: claimedAt,
      provenance,
    };
  }
  if (target === "ros_pursuits") {
    return {
      id: String(row.id),
      site_id: siteId,
      state: String(document.state ?? row.status ?? "unknown"),
      pattern_key: row.pattern_key ?? document.patternKey ?? null,
      action_type: document.actionType ?? document.action_type ?? null,
      document,
      updated_at: updatedAt,
      provenance,
    };
  }
  if (target === "ros_events") {
    return {
      id: String(row.id),
      site_id: siteId,
      event_type: String(
        document.eventType ?? document.type ?? row.category ?? "pursuit_event",
      ),
      detail: document,
      created_at:
        iso(row.created_at ?? row.createdAt ?? document.at ?? updatedAt) ??
        updatedAt,
      provenance,
    };
  }
  if (target === "ros_leases") {
    return {
      id: String(row.id),
      site_id: siteId,
      owner: String(document.owner ?? document.leaseOwner ?? "legacy-import"),
      lease_until:
        iso(document.leaseUntil ?? document.lease_until ?? updatedAt) ??
        updatedAt,
      document,
      provenance,
    };
  }
  return {
    id: String(row.id),
    site_id: siteId,
    category: String(row.category ?? document.category ?? "experiment"),
    status: String(row.status ?? document.status ?? "unknown"),
    document,
    updated_at: updatedAt,
    provenance,
  };
}

export async function collectPlatformImport(): Promise<{
  winners: Map<string, ImportCandidate>;
  stats: CollectStats;
  expectedBusinesses: string[];
  connectionUrl: string;
}> {
  const paths = resolvePaths();
  const ledgerRoot = path.join(REPO_ROOT, ".data/operator-local-ledger");
  const checkpointPath = path.join(
    REPO_ROOT,
    ".data/operator-engine-checkpoint.json",
  );
  const portfolioPath = path.join(
    REPO_ROOT,
    "services/operator/src/portfolio-dynamic.json",
  );

  const expectedBusinesses: string[] = [];
  if (existsSync(portfolioPath)) {
    try {
      const p = JSON.parse(readFileSync(portfolioPath, "utf8"));
      const list = Array.isArray(p) ? p : p.businesses || p.sites || [];
      for (const b of list) {
        const id = typeof b === "string" ? b : b.siteId || b.id;
        if (id) expectedBusinesses.push(String(id));
      }
    } catch {
      /* ignore */
    }
  }

  const client = new pg.Client({
    connectionString: paths.connectionUrl,
    connectionTimeoutMillis: 8_000,
  });
  await client.connect();

  const stats = emptyStats();
  const winners = new Map<string, ImportCandidate>();

  function consider(c: ImportCandidate) {
    stats.discoveredBySource[c.provenance] += 1;
    stats.discoveredByDomain[c.domain] =
      (stats.discoveredByDomain[c.domain] ?? 0) + 1;
    stats.classified[c.classification] += 1;
    if (c.classification === "mendhaus_only_excluded") stats.mendhausExcluded += 1;
    if (c.classification === "mixed_split_platform") stats.mixedSplitPlatform += 1;
    if (c.classification === "mixed_excluded") stats.mixedExcluded += 1;
    if (c.classification === "unknown") {
      stats.unknown += 1;
      if (stats.unknownSamples.length < 20) {
        stats.unknownSamples.push({
          id: c.stableId,
          domain: c.domain,
          provenance: c.provenance,
        });
      }
    }
    if (c.siteId) stats.businessesSeen.add(c.siteId);
    if (c.target === "excluded") return;

    const key = `${c.target}::${c.stableId}`;
    const prev = winners.get(key);
    if (!prev) {
      winners.set(key, c);
      return;
    }
    stats.duplicatesDetected += 1;
    const cmp = newer(c.updatedAt, prev.updatedAt);
    if (cmp > 0) {
      if (
        c.provenance === "LOCAL_LEDGER" &&
        prev.provenance === "SUPABASE_LEGACY"
      ) {
        stats.newerLocalReplacements += 1;
      }
      winners.set(key, c);
    } else if (cmp < 0) {
      // keep prev
    } else if (c.contentHash !== prev.contentHash) {
      stats.conflicts += 1;
      if (stats.conflictSamples.length < 25) {
        stats.conflictSamples.push({
          id: c.stableId,
          target: c.target,
          a: prev.provenance,
          b: c.provenance,
          updatedAt: c.updatedAt,
        });
      }
      if (
        c.provenance === "LOCAL_LEDGER" &&
        prev.provenance !== "LOCAL_LEDGER"
      ) {
        winners.set(key, c);
        stats.newerLocalReplacements += 1;
      }
    } else if (
      c.provenance === "LOCAL_LEDGER" &&
      prev.provenance === "SUPABASE_LEGACY"
    ) {
      winners.set(key, c);
      stats.newerLocalReplacements += 1;
    }
  }

  // ---- Supabase platform slice (local restore of revenueos_*) ----
  const exp = await client.query(
    `select id, site_id, status, pattern_key, category, document, updated_at, created_at
     from revenueos_experiments`,
  );
  for (const row of exp.rows) {
    const mapped = classifyExperimentRow(row);
    consider({
      stableId: String(row.id),
      target: mapped.target,
      classification: mapped.classification,
      provenance: "SUPABASE_LEGACY",
      siteId: row.site_id,
      updatedAt: iso(row.updated_at),
      contentHash: hashDoc(row.document),
      domain: mapped.domain,
      row: mapExperimentPayload(mapped.target, row, "SUPABASE_LEGACY"),
    });
  }

  const lessons = await client.query(
    `select id, site_id, scope, pattern_key, document, updated_at from revenueos_lessons`,
  );
  for (const row of lessons.rows) {
    const mapped = classifyLessonRow(row);
    const updatedAt = iso(row.updated_at);
    const document = docOf(row.document);
    consider({
      stableId: String(row.id),
      target: mapped.target,
      classification: mapped.classification,
      provenance: "SUPABASE_LEGACY",
      siteId: row.site_id,
      updatedAt,
      contentHash: hashDoc(row.document),
      domain: mapped.domain,
      row:
        mapped.target === "excluded"
          ? {}
          : {
              id: String(row.id),
              site_id: String(row.site_id ?? "platform"),
              summary: String(
                document.summary ?? document.title ?? row.pattern_key ?? "lesson",
              ),
              document,
              updated_at: updatedAt ?? new Date().toISOString(),
              provenance: "SUPABASE_LEGACY",
            },
    });
  }

  const scorecards = await client.query(
    `select id, site_id, document, created_at from revenueos_scorecards`,
  );
  for (const row of scorecards.rows) {
    const document = docOf(row.document);
    const updatedAt = iso(row.created_at);
    consider({
      stableId: `scorecard:${row.site_id}:${row.id}`,
      target: "ros_scorecards",
      classification:
        row.site_id === "mendhaus" ? "platform_tenant" : "platform",
      provenance: "SUPABASE_LEGACY",
      siteId: row.site_id,
      updatedAt,
      contentHash: hashDoc(row.document),
      domain: "scorecards",
      row: {
        id: `scorecard:${row.site_id}:${row.id}`,
        site_id: String(row.site_id),
        document,
        updated_at: updatedAt ?? new Date().toISOString(),
        provenance: "SUPABASE_LEGACY",
      },
    });
  }

  const channels = await client.query(
    `select id, site_id, platform, account, capability_id, status, document, updated_at, created_at
     from revenueos_channels`,
  );
  for (const row of channels.rows) {
    const updatedAt = iso(row.updated_at);
    consider({
      stableId: String(row.id),
      target: "ros_channels",
      classification: "platform",
      provenance: "SUPABASE_LEGACY",
      siteId: row.site_id,
      updatedAt,
      contentHash: hashDoc(row.document),
      domain: "channels",
      row: {
        id: String(row.id),
        site_id: String(row.site_id),
        platform: String(row.platform ?? ""),
        account: String(row.account ?? "default"),
        capability_id: String(row.capability_id ?? ""),
        status: String(row.status ?? "active"),
        document: docOf(row.document),
        updated_at: updatedAt ?? new Date().toISOString(),
        created_at: iso(row.created_at) ?? updatedAt ?? new Date().toISOString(),
        provenance: "SUPABASE_LEGACY",
      },
    });
  }

  const attrib = await client.query(
    `select count(*)::int as n from revenueos_attributions`,
  );
  stats.attributionsRowsSkippedEmpty = Number(attrib.rows[0]?.n ?? 0);

  // ---- Local ledgers ----
  if (existsSync(ledgerRoot)) {
    for (const ent of readdirSync(ledgerRoot, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      const siteId = ent.name;
      const file = path.join(ledgerRoot, siteId, "ledger.json");
      if (!existsSync(file)) continue;
      stats.ledgerSitesScanned += 1;
      let data: any;
      let parseErr: unknown = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          data = JSON.parse(readFileSync(file, "utf8"));
          parseErr = null;
          break;
        } catch (e) {
          parseErr = e;
          await new Promise((r) => setTimeout(r, 50));
        }
      }
      if (parseErr || !data) {
        consider({
          stableId: `ledger_parse_error:${siteId}`,
          target: "excluded",
          classification: "unknown",
          provenance: "LOCAL_LEDGER",
          siteId,
          updatedAt: null,
          contentHash: "parse_error",
          domain: "ledger_corrupt",
          row: {},
        });
        continue;
      }
      stats.businessesSeen.add(siteId);

      for (const row of data.experiments || []) {
        const updatedAt = iso(row.updatedAt || row.createdAt);
        const document = docOf(row);
        consider({
          stableId: String(row.id),
          target: "ros_experiments",
          classification: "platform",
          provenance: "LOCAL_LEDGER",
          siteId: row.siteId || siteId,
          updatedAt,
          contentHash: hashDoc(row),
          domain: "experiments",
          row: {
            id: String(row.id),
            site_id: String(row.siteId || siteId),
            category: String(row.category ?? "experiment"),
            status: String(row.status ?? "unknown"),
            document,
            updated_at: updatedAt ?? new Date().toISOString(),
            provenance: "LOCAL_LEDGER",
          },
        });
      }
      for (const row of data.pursuits || []) {
        const updatedAt = iso(row.updatedAt || row.completedAt || row.createdAt);
        const document = docOf(row);
        consider({
          stableId: String(row.id),
          target: "ros_pursuits",
          classification: "platform",
          provenance: "LOCAL_LEDGER",
          siteId: row.siteId || siteId,
          updatedAt,
          contentHash: hashDoc(row),
          domain: "pursuits",
          row: {
            id: String(row.id),
            site_id: String(row.siteId || siteId),
            state: String(row.state ?? "unknown"),
            pattern_key: row.patternKey ?? null,
            action_type: row.actionType ?? null,
            document,
            updated_at: updatedAt ?? new Date().toISOString(),
            provenance: "LOCAL_LEDGER",
          },
        });
      }
      for (const row of data.pursuitEvents || []) {
        const createdAt = iso(row.createdAt || row.at) ?? new Date().toISOString();
        const document = docOf(row);
        consider({
          stableId: String(row.id),
          target: "ros_events",
          classification: "platform",
          provenance: "LOCAL_LEDGER",
          siteId: row.siteId || siteId,
          updatedAt: createdAt,
          contentHash: hashDoc(row),
          domain: "pursuit_events",
          row: {
            id: String(row.id),
            site_id: String(row.siteId || siteId),
            event_type: String(row.type ?? row.eventType ?? "pursuit_event"),
            detail: document,
            created_at: createdAt,
            provenance: "LOCAL_LEDGER",
          },
        });
      }
      for (const row of data.lessons || []) {
        const scope = row.scope || "site";
        const portable =
          row.transferable === true ||
          scope === "global" ||
          scope === "industry";
        const updatedAt = iso(row.updatedAt || row.createdAt);
        if (
          scope === "site" &&
          !portable &&
          (row.siteId || siteId) === "mendhaus"
        ) {
          consider({
            stableId: String(row.id),
            target: "excluded",
            classification: "mixed_excluded",
            provenance: "LOCAL_LEDGER",
            siteId: row.siteId || siteId,
            updatedAt,
            contentHash: hashDoc(row),
            domain: "lessons_mendhaus_site",
            row: {},
          });
          continue;
        }
        const document = docOf(row);
        consider({
          stableId: String(row.id),
          target: "ros_lessons",
          classification: portable ? "mixed_split_platform" : "platform",
          provenance: "LOCAL_LEDGER",
          siteId: row.siteId || siteId,
          updatedAt,
          contentHash: hashDoc(row),
          domain: "lessons",
          row: {
            id: String(row.id),
            site_id: String(row.siteId || siteId),
            summary: String(row.summary ?? row.title ?? "lesson"),
            document,
            updated_at: updatedAt ?? new Date().toISOString(),
            provenance: "LOCAL_LEDGER",
          },
        });
      }
      for (const row of data.scorecards || []) {
        const updatedAt = iso(row.updatedAt || row.createdAt);
        const id = String(row.id || `scorecard:${siteId}`);
        consider({
          stableId: id,
          target: "ros_scorecards",
          classification: "platform",
          provenance: "LOCAL_LEDGER",
          siteId: row.siteId || siteId,
          updatedAt,
          contentHash: hashDoc(row),
          domain: "scorecards",
          row: {
            id,
            site_id: String(row.siteId || siteId),
            document: docOf(row),
            updated_at: updatedAt ?? new Date().toISOString(),
            provenance: "LOCAL_LEDGER",
          },
        });
      }
      for (const row of data.channels || []) {
        const updatedAt = iso(row.updatedAt || row.createdAt);
        consider({
          stableId: String(row.id),
          target: "ros_channels",
          classification: "platform",
          provenance: "LOCAL_LEDGER",
          siteId: row.siteId || siteId,
          updatedAt,
          contentHash: hashDoc(row),
          domain: "channels",
          row: {
            id: String(row.id),
            site_id: String(row.siteId || siteId),
            platform: String(row.platform ?? ""),
            account: String(row.account ?? "default"),
            capability_id: String(row.capabilityId ?? row.capability_id ?? ""),
            status: String(row.status ?? "active"),
            document: docOf(row),
            updated_at: updatedAt ?? new Date().toISOString(),
            created_at: iso(row.createdAt) ?? updatedAt ?? new Date().toISOString(),
            provenance: "LOCAL_LEDGER",
          },
        });
      }
      for (const row of data.leases || []) {
        const updatedAt = iso(row.leaseUntil || row.createdAt || row.updatedAt);
        consider({
          stableId: String(row.id),
          target: "ros_leases",
          classification: "platform",
          provenance: "LOCAL_LEDGER",
          siteId: row.siteId || siteId,
          updatedAt,
          contentHash: hashDoc(row),
          domain: "leases",
          row: {
            id: String(row.id),
            site_id: String(row.siteId || siteId),
            owner: String(row.owner ?? row.leaseOwner ?? "local-ledger"),
            lease_until: updatedAt ?? new Date().toISOString(),
            document: docOf(row),
            provenance: "LOCAL_LEDGER",
          },
        });
      }
      for (const key of Object.keys(data)) {
        const known = [
          "experiments",
          "lessons",
          "scorecards",
          "pursuits",
          "pursuitEvents",
          "channels",
          "leases",
          "attributions",
          "plannerRuns",
          "cycleReports",
          "exposures",
          "discoveryDoors",
          "capabilityGaps",
        ];
        if (!known.includes(key)) {
          consider({
            stableId: `ledger_key:${siteId}:${key}`,
            target: "excluded",
            classification: "unknown",
            provenance: "LOCAL_LEDGER",
            siteId,
            updatedAt: null,
            contentHash: hashDoc(null),
            domain: `unexpected_ledger_key:${key}`,
            row: {},
          });
          continue;
        }
        if (
          [
            "exposures",
            "discoveryDoors",
            "capabilityGaps",
            "plannerRuns",
            "cycleReports",
            "attributions",
          ].includes(key)
        ) {
          const arr = Array.isArray(data[key]) ? data[key] : [];
          for (const row of arr) {
            const at =
              iso(row.updatedAt || row.createdAt || row.at) ??
              new Date().toISOString();
            const id = String(row.id || `${key}:${siteId}:${hashDoc(row)}`);
            consider({
              stableId: id,
              target: "ros_activity",
              classification: "platform",
              provenance: "LOCAL_LEDGER",
              siteId: row.siteId || siteId,
              updatedAt: at,
              contentHash: hashDoc(row),
              domain: key,
              row: {
                id,
                site_id: String(row.siteId || siteId),
                at,
                summary: String(row.summary ?? row.title ?? key),
                quality: row.quality ?? null,
                detail: docOf(row),
                provenance: "LOCAL_LEDGER",
              },
            });
          }
        }
      }
    }
  }

  // ---- Engine / scheduler checkpoint ----
  if (existsSync(checkpointPath)) {
    const cp = JSON.parse(readFileSync(checkpointPath, "utf8"));
    const savedAt = iso(cp.savedAt) ?? new Date().toISOString();
    consider({
      stableId: "portfolio:engine-checkpoint",
      target: "ros_portfolio_state",
      classification: "platform",
      provenance: "ENGINE_CHECKPOINT",
      siteId: null,
      updatedAt: savedAt,
      contentHash: hashDoc({
        version: cp.version,
        authority: cp.authority,
        mode: cp.mode,
        n: (cp.businesses || []).length,
      }),
      domain: "engine_checkpoint",
      row: {
        id: "portfolio:engine-checkpoint",
        document: cp,
        updated_at: savedAt,
        provenance: "ENGINE_CHECKPOINT",
      },
    });
    consider({
      stableId: "scheduler_checkpoint",
      target: "ros_config_meta",
      classification: "platform",
      provenance: "SCHEDULER_CHECKPOINT",
      siteId: null,
      updatedAt: savedAt,
      contentHash: hashDoc(cp.businesses || []),
      domain: "scheduler_checkpoint",
      row: {
        key: "scheduler_checkpoint",
        value: {
          version: cp.version,
          savedAt: cp.savedAt,
          authority: cp.authority,
          mode: cp.mode,
          businesses: cp.businesses || [],
        },
        updated_at: savedAt,
        provenance: "SCHEDULER_CHECKPOINT",
      },
    });
    for (const b of cp.businesses || []) {
      const siteId = String(b.siteId || b.id);
      consider({
        stableId: siteId,
        target: "ros_businesses",
        classification: "platform",
        provenance: "ENGINE_CHECKPOINT",
        siteId,
        updatedAt: iso(b.lastTickAt || cp.savedAt),
        contentHash: hashDoc(b),
        domain: "business_registry",
        row: {
          site_id: siteId,
          display_name: String(b.displayName || siteId),
          industry: null,
          app_url: null,
          status: "active",
          metadata: { runtime: b, source: "engine_checkpoint" },
          updated_at: iso(b.lastTickAt || cp.savedAt) ?? savedAt,
          provenance: "ENGINE_CHECKPOINT",
        },
      });
    }
  }

  await client.end();

  for (const c of winners.values()) {
    if (c.target === "excluded") continue;
    stats.projected[c.target] = (stats.projected[c.target] ?? 0) + 1;
  }

  return {
    winners,
    stats,
    expectedBusinesses,
    connectionUrl: paths.connectionUrl,
  };
}

export function loadExpectedPortfolioIds(): string[] {
  const portfolioPath = path.join(
    REPO_ROOT,
    "services/operator/src/portfolio-dynamic.json",
  );
  if (!existsSync(portfolioPath)) return [];
  try {
    const p = JSON.parse(readFileSync(portfolioPath, "utf8"));
    const list = Array.isArray(p) ? p : p.businesses || p.sites || [];
    return list
      .map((b: any) => (typeof b === "string" ? b : b.siteId || b.id))
      .filter(Boolean)
      .map(String);
  } catch {
    return [];
  }
}
