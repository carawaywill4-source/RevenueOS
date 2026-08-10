/** Shared owner-control types (provider-agnostic). */

export type OwnerControlState = {
  portfolioPaused: boolean;
  pausedBusinesses: string[];
  prioritizedBusinesses: string[];
  updatedAt: string;
  updatedBy: string;
};

export type ControlCommand =
  | "pause_revenueos"
  | "resume_revenueos"
  | "pause_business"
  | "resume_business"
  | "prioritize_business";

export const DEFAULT_OWNER_CONTROL_STATE: OwnerControlState = {
  portfolioPaused: false,
  pausedBusinesses: [],
  prioritizedBusinesses: [],
  updatedAt: new Date(0).toISOString(),
  updatedBy: "system",
};

export function isBusinessCommerciallyPaused(
  state: OwnerControlState,
  siteId: string,
): boolean {
  return state.portfolioPaused || state.pausedBusinesses.includes(siteId);
}

export function prioritizeBoostMs(
  state: OwnerControlState,
  siteId: string,
): number {
  const idx = state.prioritizedBusinesses.indexOf(siteId);
  if (idx < 0) return 0;
  return Math.max(0, 30_000 - idx * 5_000);
}
