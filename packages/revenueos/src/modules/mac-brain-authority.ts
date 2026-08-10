/**
 * Mac sole-authority guard for RevenueOS autonomous execution.
 *
 * Cloud (Vercel) must fail closed unless explicitly break-glassed with
 * REVENUEOS_VERCEL_BRAIN=1. Normal runtime never sets that flag.
 */

export type CloudBrainRefuse = {
  ok: true;
  skipped: true;
  mode: "mac_brain_only";
  cycleStatus: "refused_cloud_brain";
  authority: "mac";
  vercelBrainAllowed: false;
  note: string;
};

export function isVercelBrainAllowed(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.REVENUEOS_VERCEL_BRAIN === "1";
}

export function vercelBrainRefusePayload(
  note = "RevenueOS autonomous execution runs on Mac Core only",
): CloudBrainRefuse {
  return {
    ok: true,
    skipped: true,
    mode: "mac_brain_only",
    cycleStatus: "refused_cloud_brain",
    authority: "mac",
    vercelBrainAllowed: false,
    note,
  };
}

/** Use at the top of every legacy cloud brain / orchestration route. */
export function assertCloudBrainAllowed(
  env: NodeJS.ProcessEnv = process.env,
): { allowed: true } | { allowed: false; body: CloudBrainRefuse } {
  if (isVercelBrainAllowed(env)) return { allowed: true };
  return { allowed: false, body: vercelBrainRefusePayload() };
}
