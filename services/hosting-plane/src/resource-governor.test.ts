import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canAllocate,
  DEFAULT_CAPACITY,
  DEFAULT_SITE_LIMITS,
  usedBy,
} from "./resource-governor.js";
import type { SiteRuntimeRecord } from "./runtime/types.js";

function site(partial: Partial<SiteRuntimeRecord>): SiteRuntimeRecord {
  return {
    siteId: "x",
    version: "1",
    deploymentId: "d1",
    runtimeKind: "process",
    status: "healthy",
    port: 9100,
    domains: [],
    createdAt: new Date().toISOString(),
    lastDeployAt: new Date().toISOString(),
    limits: { ...DEFAULT_SITE_LIMITS },
    envKeys: [],
    appDir: "apps/x",
    ...partial,
  };
}

test("governor reserves headroom and blocks exhaustion", () => {
  const many = Array.from({ length: 20 }, (_, i) =>
    site({
      siteId: `b${i}`,
      limits: { cpuMillicores: 250, memoryMb: 384, diskMb: 1024 },
    }),
  );
  // 20 * 384 = 7680 memory used; allocatable = 8192-2048 = 6144 → should fail
  const r = canAllocate(DEFAULT_CAPACITY, many, DEFAULT_SITE_LIMITS);
  assert.equal(r.ok, false);
  assert.match(r.detail, /memory|cpu/);
});

test("max 50 active businesses", () => {
  const fifty = Array.from({ length: 50 }, (_, i) =>
    site({
      siteId: `b${i}`,
      limits: { cpuMillicores: 10, memoryMb: 10, diskMb: 10 },
    }),
  );
  const used = usedBy(fifty);
  assert.equal(used.cpuMillicores, 500);
  const r = canAllocate(
    {
      ...DEFAULT_CAPACITY,
      totalCpuMillicores: 100_000,
      totalMemoryMb: 100_000,
      reservedCpuMillicores: 0,
      reservedMemoryMb: 0,
    },
    fifty,
    { cpuMillicores: 10, memoryMb: 10, diskMb: 10 },
  );
  assert.equal(r.ok, false);
  assert.equal(r.detail, "max_active_businesses");
});
