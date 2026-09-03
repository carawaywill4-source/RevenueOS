/**
 * Runtime heartbeat + macOS suspend-gap detection.
 * Wall-clock jumps without matching monotonic progress → SUSPEND_GAP.
 */

export type HeartbeatEvidence = {
  core_started_at: string;
  last_core_tick: string | null;
  last_titan_tick: string | null;
  last_apex_tick: string | null;
  last_forge_tick: string | null;
  last_nexus_tick: string | null;
  last_external_action: string | null;
  last_heartbeat_at: string;
  suspend_gap: boolean;
  suspend_gap_ms: number;
  mode: string;
  pid: number;
};

type TickKind = "core" | "titan" | "apex" | "forge" | "nexus" | "external";

const state = {
  core_started_at: new Date().toISOString(),
  last: {
    core: null as string | null,
    titan: null as string | null,
    apex: null as string | null,
    forge: null as string | null,
    nexus: null as string | null,
    external: null as string | null,
  },
  lastWallMs: Date.now(),
  lastMonoMs: monotonicMs(),
  suspendGaps: [] as Array<{ at: string; gap_ms: number }>,
};

function monotonicMs(): number {
  const [s, ns] = process.hrtime();
  return s * 1000 + ns / 1e6;
}

/** Call periodically / on each tick. Detects sleep when wall advances >> mono. */
export function pulseHeartbeat(opts?: {
  kind?: TickKind;
  executed?: number;
}): HeartbeatEvidence {
  const nowWall = Date.now();
  const nowMono = monotonicMs();
  const wallDelta = nowWall - state.lastWallMs;
  const monoDelta = nowMono - state.lastMonoMs;
  // If wall jumped much more than monotonic, the process was suspended.
  const skew = wallDelta - monoDelta;
  let suspend = false;
  if (skew > 15_000 && wallDelta > 20_000) {
    suspend = true;
    state.suspendGaps.push({
      at: new Date(nowWall).toISOString(),
      gap_ms: Math.round(skew),
    });
    if (state.suspendGaps.length > 50) state.suspendGaps.shift();
  }
  state.lastWallMs = nowWall;
  state.lastMonoMs = nowMono;

  const at = new Date(nowWall).toISOString();
  if (opts?.kind) {
    state.last[opts.kind] = at;
    if (opts.kind === "core") state.last.core = at;
  }
  if ((opts?.executed ?? 0) > 0) {
    state.last.external = at;
  }

  const lastGap = state.suspendGaps[state.suspendGaps.length - 1];
  return {
    core_started_at: state.core_started_at,
    last_core_tick: state.last.core,
    last_titan_tick: state.last.titan,
    last_apex_tick: state.last.apex,
    last_forge_tick: state.last.forge,
    last_nexus_tick: state.last.nexus,
    last_external_action: state.last.external,
    last_heartbeat_at: at,
    suspend_gap: suspend || Boolean(lastGap && Date.now() - Date.parse(lastGap.at) < 60_000),
    suspend_gap_ms: lastGap?.gap_ms ?? 0,
    mode: process.env.REVENUEOS_MODE || "STAGING",
    pid: process.pid,
  };
}

export function noteSubsystemTicks(result: {
  titan?: unknown;
  apex?: unknown;
  nexus?: unknown;
  drainExecuted?: number;
}): void {
  pulseHeartbeat({ kind: "core", executed: result.drainExecuted });
  if (result.titan) pulseHeartbeat({ kind: "titan" });
  if (result.apex) pulseHeartbeat({ kind: "apex" });
  // FORGE availability is process-resident; mark when Core ticks.
  pulseHeartbeat({ kind: "forge" });
  if (result.nexus) pulseHeartbeat({ kind: "nexus" });
}

export function getHeartbeat(): HeartbeatEvidence {
  return pulseHeartbeat();
}

export function recentSuspendGaps(): Array<{ at: string; gap_ms: number }> {
  return [...state.suspendGaps];
}
