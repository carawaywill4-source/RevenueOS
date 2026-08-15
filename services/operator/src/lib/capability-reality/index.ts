export {
  FEATURE_THEATER_DOCTRINE,
  OPEN_WORLD_BUSINESS_DOCTRINE,
  type CapabilityState,
  type CapabilityRecord,
  type DistributionCapability,
} from "./types.js";
export { ensureCapabilityRealityTables } from "./schema.js";
export {
  syncEnvCredentialsIntoVault,
  upsertVaultSecret,
  readVaultSecret,
} from "./credential-vault.js";
export {
  composeCommercialEmail,
  buildResourcePlacementBrief,
  scoreCommercialMessage,
  exampleOldStyleWeakEmail,
  type CommercialBrief,
} from "./commercial-comms.js";
export {
  classifyInboundReply,
  ingestInboundMessage,
  persistOneLicenseRegressionLesson,
} from "./inbound-intel.js";
export {
  runCapabilityRealityAudit,
  countExecutableDistribution,
} from "./registry.js";
export { executeProductHuntFrontierBet } from "./producthunt-adapter.js";
export { migrateLaunchFreeCapability } from "./launchfree.js";

export async function bootCapabilityReality(
  pool: import("pg").Pool,
  logger: (
    level: "info" | "warn" | "error",
    event: string,
    meta?: Record<string, unknown>,
  ) => void,
): Promise<{
  audit: Awaited<ReturnType<typeof runCapabilityRealityAudit>>;
  launchfree: Awaited<ReturnType<typeof migrateLaunchFreeCapability>>;
  executable: Awaited<ReturnType<typeof countExecutableDistribution>>;
}> {
  const { ensureCapabilityRealityTables } = await import("./schema.js");
  await ensureCapabilityRealityTables(pool);
  const { migrateLaunchFreeCapability } = await import("./launchfree.js");
  const launchfree = await migrateLaunchFreeCapability(pool, logger);
  const { runCapabilityRealityAudit, countExecutableDistribution } =
    await import("./registry.js");
  const audit = await runCapabilityRealityAudit(pool, logger);
  const executable = await countExecutableDistribution(pool);
  logger("info", "capability_reality.boot", {
    caps: audit.capabilities.length,
    auto3p: executable.autonomousThirdParty,
    authExec: executable.authenticatedExecutable,
    launchfree: launchfree.status,
  });
  return { audit, launchfree, executable };
}
