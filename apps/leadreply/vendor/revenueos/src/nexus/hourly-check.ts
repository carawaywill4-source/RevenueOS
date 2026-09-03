/**
 * Hourly owner check — amount made + visitors only.
 * No engineering diary. Material incidents/sales use separate channels.
 */

export type HourlyCheckInput = {
  siteId?: string;
  revenueUsd: number;
  visitors: number;
};

export function formatHourlyCheck(input: HourlyCheckInput): string {
  const rev = Number.isFinite(input.revenueUsd) ? input.revenueUsd : 0;
  const visitors = Number.isFinite(input.visitors) ? Math.max(0, Math.round(input.visitors)) : 0;
  const prefix = input.siteId ? `${input.siteId}: ` : "";
  return `${prefix}$${rev.toFixed(2)} · ${visitors} visitors`;
}

export function hourlyCheckSubject(input: HourlyCheckInput): string {
  const rev = Number.isFinite(input.revenueUsd) ? input.revenueUsd : 0;
  const visitors = Number.isFinite(input.visitors) ? Math.max(0, Math.round(input.visitors)) : 0;
  const name = input.siteId ?? "RevenueOS";
  return `${name}: $${rev.toFixed(2)} · ${visitors} visitors`;
}
