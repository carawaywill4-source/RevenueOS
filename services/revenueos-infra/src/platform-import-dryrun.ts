/**
 * Allowlisted RevenueOS platform-state migration — DRY RUN ONLY.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolvePaths } from "./paths.js";
import {
  REPO_ROOT,
  collectPlatformImport,
  loadExpectedPortfolioIds,
} from "./platform-import-core.js";

export async function runPlatformImportDryRun(): Promise<{
  reportPath: string;
  ok: boolean;
}> {
  const paths = resolvePaths();
  const { winners, stats, expectedBusinesses } = await collectPlatformImport();

  const expected =
    expectedBusinesses.length > 0
      ? expectedBusinesses
      : loadExpectedPortfolioIds();
  const missingBusinesses = expected.filter((b) => !stats.businessesSeen.has(b));
  const extraBusinesses = [...stats.businessesSeen].filter(
    (b) => expected.length > 0 && !expected.includes(b),
  );

  // Historical site_ids that appear in Supabase slice but are not active portfolio
  const historicalKnown = [
    "resumeforge",
    "mendhaus",
    "depositproof",
    "bidbinder",
    "closeshift",
    "waitroom",
    "raiseready",
    "shopbeacon",
    "turnoverkit",
    "ledgerleaf",
    "listinglift",
  ];
  const extraHistoricalFromSupabase = extraBusinesses.filter((b) =>
    historicalKnown.includes(b),
  );
  const extraOther = extraBusinesses.filter((b) => !historicalKnown.includes(b));

  const ok = stats.unknown === 0 && missingBusinesses.length === 0;

  const report = {
    mode: "DRY_RUN",
    createdAt: new Date().toISOString(),
    destructiveWrites: false,
    cutover: false,
    sources: {
      supabasePlatformSlice:
        "local PG revenueos_* (Stage2 Mendhaus-hosted platform extract)",
      localLedgers: path.join(REPO_ROOT, ".data/operator-local-ledger"),
      ledgerSitesScanned: stats.ledgerSitesScanned,
      engineCheckpoint: path.join(
        REPO_ROOT,
        ".data/operator-engine-checkpoint.json",
      ),
    },
    denylistNeverImported: stats.denylistNeverImported,
    attributionsRowsSkippedEmpty: stats.attributionsRowsSkippedEmpty,
    discoveredBySource: stats.discoveredBySource,
    discoveredByDomain: stats.discoveredByDomain,
    classified: stats.classified,
    mendhausOnlyExcluded: stats.mendhausExcluded,
    mixedRecordsSplitIntoPlatform: stats.mixedSplitPlatform,
    mixedRecordsExcluded: stats.mixedExcluded,
    duplicatesDetected: stats.duplicatesDetected,
    conflicts: stats.conflicts,
    newerLocalReplacements: stats.newerLocalReplacements,
    unknownUnclassifiable: stats.unknown,
    conflictSamples: stats.conflictSamples,
    unknownSamples: stats.unknownSamples,
    schemaGaps: {
      note: "ros_channels provided by 0002_ros_channels.sql",
      projectedRosChannels: stats.projected.ros_channels ?? 0,
    },
    projectedRosCounts: stats.projected,
    winnerCount: winners.size,
    businesses: {
      expectedCount: expected.length,
      seenCount: stats.businessesSeen.size,
      seen: [...stats.businessesSeen].sort(),
      missing: missingBusinesses,
      extraHistoricalFromSupabase,
      extraOther,
    },
    gate: {
      zeroUnknownRequired: true,
      unknownCount: stats.unknown,
      allExpectedBusinessesRepresented: missingBusinesses.length === 0,
      pass: ok,
      blockers: [
        ...(stats.unknown > 0 ? [`unknown_records=${stats.unknown}`] : []),
        ...(missingBusinesses.length
          ? [`missing_businesses=${missingBusinesses.join(",")}`]
          : []),
      ],
      preImportRequirements: [
        "Human approval required before non-dry-run import",
      ],
    },
  };

  mkdirSync(paths.backups, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(
    paths.backups,
    `platform-import-dryrun-${stamp}.json`,
  );
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");

  console.log("[dry-run] report →", reportPath);
  console.log("[dry-run] discoveredBySource", report.discoveredBySource);
  console.log("[dry-run] projectedRosCounts", report.projectedRosCounts);
  console.log("[dry-run] unknown", report.unknownUnclassifiable);
  console.log("[dry-run] missingBusinesses", missingBusinesses);
  console.log("[dry-run] gate.pass", ok, "blockers", report.gate.blockers);

  return { reportPath, ok };
}
