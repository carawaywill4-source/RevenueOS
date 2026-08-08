import {
  buildGrowthSnapshot,
  type GrowthSnapshot,
} from "@/lib/growthos";

/**
 * Continuous money hunt. Vercel has no always-on process — we approximate it by:
 *  1. Minute cron as a heartbeat
 *  2. Burning the function budget running as many RevenueOS cycles as fit
 *  3. Chaining one follow-up request so coverage stays tight between heartbeats
 *
 * IndexNow and other external pings stay rate-limited in the adapter so we hunt
 * brains-first without spamming discovery APIs.
 */

const DEFAULT_BUDGET_MS = 50_000;
const DEFAULT_MAX_ROUNDS = 8;
const MIN_GAP_MS = 1_500;

export type ContinuousHuntResult = {
  rounds: number;
  elapsedMs: number;
  snapshots: GrowthSnapshot[];
  last: GrowthSnapshot;
};

export async function runContinuousHunt(opts?: {
  budgetMs?: number;
  maxRounds?: number;
  onRound?: (snapshot: GrowthSnapshot, round: number) => void;
}): Promise<ContinuousHuntResult> {
  const budgetMs = opts?.budgetMs ?? DEFAULT_BUDGET_MS;
  const maxRounds = opts?.maxRounds ?? DEFAULT_MAX_ROUNDS;
  const started = Date.now();
  const snapshots: GrowthSnapshot[] = [];

  for (let round = 1; round <= maxRounds; round += 1) {
    if (Date.now() - started > budgetMs) break;
    const snapshot = await buildGrowthSnapshot();
    snapshots.push(snapshot);
    opts?.onRound?.(snapshot, round);

    const remaining = budgetMs - (Date.now() - started);
    if (remaining < MIN_GAP_MS + 2_000) break;
    if (round < maxRounds) {
      await sleep(MIN_GAP_MS);
    }
  }

  if (!snapshots.length) {
    const last = await buildGrowthSnapshot();
    return {
      rounds: 1,
      elapsedMs: Date.now() - started,
      snapshots: [last],
      last,
    };
  }

  return {
    rounds: snapshots.length,
    elapsedMs: Date.now() - started,
    snapshots,
    last: snapshots[snapshots.length - 1],
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Always chain. Giving up / coasting between ticks is not allowed. */
export function shouldChainHunt(_snapshot: GrowthSnapshot): boolean {
  return true;
}
