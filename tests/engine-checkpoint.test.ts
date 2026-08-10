/**
 * Phase 3 — durable Mac engine checkpoint round-trip (no portfolio load).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  applyCheckpointToStatuses,
  loadEngineCheckpoint,
  saveEngineCheckpoint,
} from "../services/operator/src/lib/engine-checkpoint.ts";
import type { BusinessRuntimeStatus } from "../services/operator/src/lib/scheduler.ts";

test("engine checkpoint saves and restores scheduling state", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "ros-ckpt-"));
  const file = path.join(dir, "checkpoint.json");
  const row: BusinessRuntimeStatus = {
    siteId: "invoicechaser",
    displayName: "InvoiceChaser",
    ticks: 3,
    lastTickAt: "2026-08-10T18:00:00.000Z",
    lastOk: true,
    lastDurationMs: 400,
    lastExecuted: 2,
    lastEnqueued: 5,
    lastError: null,
    claimedUntil: "2026-08-10T19:00:00.000Z",
    nextEligibleAt: "2026-08-10T18:01:00.000Z",
  };
  saveEngineCheckpoint(file, { mode: "LIVE", businesses: [row] });
  const loaded = loadEngineCheckpoint(file);
  assert.ok(loaded);
  assert.equal(loaded.authority, "mac");
  assert.equal(loaded.businesses[0]?.siteId, "invoicechaser");
  assert.equal(loaded.businesses[0]?.ticks, 3);

  const map = new Map<string, BusinessRuntimeStatus>([
    [
      "invoicechaser",
      {
        ...row,
        ticks: 0,
        lastTickAt: null,
        lastOk: null,
        claimedUntil: null,
        nextEligibleAt: null,
      },
    ],
  ]);
  const n = applyCheckpointToStatuses(map, loaded);
  assert.equal(n, 1);
  assert.equal(map.get("invoicechaser")?.ticks, 3);
  assert.equal(map.get("invoicechaser")?.nextEligibleAt, row.nextEligibleAt);
  // leases must not resurrect after crash
  assert.equal(map.get("invoicechaser")?.claimedUntil, null);
  rmSync(dir, { recursive: true, force: true });
});
