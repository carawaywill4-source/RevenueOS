/**
 * ULTRON ECONOMIC CORE — public surface.
 */

export { ULTRON_VERSION } from "./types.js";
export { ensureUltronCoreTables } from "./schema.js";
export { runUltronCoreLane, runUltronCoreTick } from "./lane.js";
export {
  refreshWorldModel,
  recordWorldFact,
  queryFacts,
  markFactConsumed,
} from "./world-model.js";
export {
  refreshCapabilityGraph,
  queryCapabilities,
  capabilityProofSummary,
} from "./capability-graph.js";
export {
  seedSkillLibrary,
  listSkills,
  findSkillsFor,
  recordSkillExecution,
} from "./skill-library.js";
export { compileCapability } from "./capability-compiler.js";
export { ingestExternalEvents, unconsumedEvents, markEventConsumed } from "./event-bus.js";
export { runClosedLoopSweep, openDefects } from "./closed-loop-watcher.js";
export { detectAndBreak, readLocalMaxSnapshot } from "./local-max-breaker.js";
export { routeReasoning, cognitiveLimitCount } from "./cognitive-router.js";
export { refreshProofLedger, listClaims } from "./proof-ledger.js";
export { refreshCurriculum, listMilestones } from "./curriculum.js";
export { runFirstTaskTick, readFirstTaskState } from "./first-task.js";
export { computeGapMap, latestGapMap } from "./gap-map.js";
