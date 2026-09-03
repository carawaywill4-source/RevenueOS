/**
 * Resource governor — scarce host capacity for ≤50 businesses.
 * Reserves headroom for infra/deploy/monitoring.
 */

import type { SiteLimits, SiteRuntimeRecord } from "./runtime/types.js";

export type HostCapacity = {
  totalCpuMillicores: number;
  totalMemoryMb: number;
  totalDiskMb: number;
  reservedCpuMillicores: number;
  reservedMemoryMb: number;
  reservedDiskMb: number;
};

export const DEFAULT_CAPACITY: HostCapacity = {
  totalCpuMillicores: 4000,
  totalMemoryMb: 8192,
  totalDiskMb: 100_000,
  reservedCpuMillicores: 1000,
  reservedMemoryMb: 2048,
  reservedDiskMb: 10_000,
};

export const DEFAULT_SITE_LIMITS: SiteLimits = {
  cpuMillicores: 250,
  memoryMb: 384,
  diskMb: 1024,
};

export function allocatable(cap: HostCapacity) {
  return {
    cpuMillicores: cap.totalCpuMillicores - cap.reservedCpuMillicores,
    memoryMb: cap.totalMemoryMb - cap.reservedMemoryMb,
    diskMb: cap.totalDiskMb - cap.reservedDiskMb,
  };
}

export function usedBy(sites: SiteRuntimeRecord[]) {
  return sites
    .filter((s) => s.status === "healthy" || s.status === "starting" || s.status === "degraded")
    .reduce(
      (acc, s) => ({
        cpuMillicores: acc.cpuMillicores + s.limits.cpuMillicores,
        memoryMb: acc.memoryMb + s.limits.memoryMb,
        diskMb: acc.diskMb + s.limits.diskMb,
      }),
      { cpuMillicores: 0, memoryMb: 0, diskMb: 0 },
    );
}

export function canAllocate(
  cap: HostCapacity,
  sites: SiteRuntimeRecord[],
  want: SiteLimits,
): { ok: boolean; detail: string } {
  const free = allocatable(cap);
  const used = usedBy(sites);
  if (used.cpuMillicores + want.cpuMillicores > free.cpuMillicores) {
    return { ok: false, detail: "cpu_exhausted" };
  }
  if (used.memoryMb + want.memoryMb > free.memoryMb) {
    return { ok: false, detail: "memory_exhausted" };
  }
  if (used.diskMb + want.diskMb > free.diskMb) {
    return { ok: false, detail: "disk_exhausted" };
  }
  if (sites.filter((s) => s.status !== "retired" && s.status !== "stopped").length >= 50) {
    return { ok: false, detail: "max_active_businesses" };
  }
  return { ok: true, detail: "ok" };
}

export function summarizeHost(cap: HostCapacity, sites: SiteRuntimeRecord[]) {
  const free = allocatable(cap);
  const used = usedBy(sites);
  const online = sites.filter((s) => s.status === "healthy").length;
  return {
    businessesOnline: online,
    businessesTracked: sites.length,
    maxBusinesses: 50,
    cpuUsedMillicores: used.cpuMillicores,
    cpuAllocatableMillicores: free.cpuMillicores,
    memoryUsedMb: used.memoryMb,
    memoryAllocatableMb: free.memoryMb,
    diskUsedMb: used.diskMb,
    diskAllocatableMb: free.diskMb,
    reserved: {
      cpuMillicores: cap.reservedCpuMillicores,
      memoryMb: cap.reservedMemoryMb,
      diskMb: cap.reservedDiskMb,
    },
  };
}
