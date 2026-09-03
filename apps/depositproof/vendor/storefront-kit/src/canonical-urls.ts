/**
 * Canonical production hostnames for every portfolio site.
 *
 * Vercel assigns two flavors of URL per project:
 *   - the deployment URL  → `{project}-{hash}-{team}.vercel.app` (unique per
 *     deploy, effectively a preview host)
 *   - the alias URL       → `{project}.vercel.app` OR `{project}-{word}.vercel.app`
 *     (stable, matches the marketing/prod surface)
 *
 * Publishing an exposure URL under the deployment host is not customer pursuit —
 * that hostname stops resolving as soon as the next deploy ships. Every URL we
 * emit for discovery doors, IndexNow submissions, email links, order-bump
 * checkout, and pulse `exposureNotes` MUST resolve to the stable alias below.
 *
 * When `NEXT_PUBLIC_APP_URL` is set per-app to a canonical value it wins;
 * otherwise callers fall back to `canonicalAppUrl(siteId)`.
 */

/** Canonical production host per portfolio site. Add new sites here. */
export const CANONICAL_APP_URLS: Record<string, string> = {
  bidbinder: "https://bidbinder.vercel.app",
  closeshift: "https://closeshift.vercel.app",
  depositproof: "https://depositproof-omega.vercel.app",
  ledgerleaf: "https://ledgerleaf-ashen.vercel.app",
  listinglift: "https://listinglift-eight.vercel.app",
  raiseready: "https://raiseready-seven.vercel.app",
  resumeforge: "https://resumeforge-liard.vercel.app",
  shopbeacon: "https://shopbeacon.vercel.app",
  turnoverkit: "https://turnoverkit.vercel.app",
  waitroom: "https://waitroom-sepia.vercel.app",
};

/**
 * Detect deployment-URL patterns like `bidbinder-fdqi2e5ij-team.vercel.app`.
 * Canonical URLs are `siteId.vercel.app` or `siteId-<word>.vercel.app` — anything
 * with a hex hash segment OR a team-suffix segment is a preview/deployment URL.
 */
export function isPreviewLikeUrl(url: string, siteId?: string): boolean {
  try {
    const host = new URL(url).host;
    if (host === "localhost" || host.startsWith("localhost:")) return false;
    if (!host.endsWith(".vercel.app")) return false;
    const label = host.slice(0, -".vercel.app".length);
    const parts = label.split("-");
    if (parts.length <= 1) return false;
    if (parts.length === 2) {
      // e.g. `raiseready-seven` (canonical) vs `raiseready-abc123def` (preview).
      // Preview segment is long lowercase hex-ish; canonical is a short word.
      const suffix = parts[1] ?? "";
      if (/^[a-z0-9]{8,}$/.test(suffix) && /\d/.test(suffix)) return true;
      // If we know the canonical, refuse any suffix that does not match it.
      if (siteId && CANONICAL_APP_URLS[siteId]) {
        return !CANONICAL_APP_URLS[siteId]!.includes(host);
      }
      return false;
    }
    // 3+ segments → almost always `{siteId}-{hash}-{team}.vercel.app`.
    return true;
  } catch {
    return false;
  }
}

/**
 * Preferred production host for a portfolio site. Falls back to
 * `https://{siteId}.vercel.app` when the site is not in the map so unknown
 * sites at least land on a stable-looking host.
 */
export function canonicalAppUrl(siteId: string): string {
  const hit = CANONICAL_APP_URLS[siteId];
  if (hit) return hit;
  return `https://${siteId}.vercel.app`;
}

/**
 * Resolve the app URL a runtime path (adapter/pulse/executor) should use.
 * Order:
 *   1. `envUrl` if present and NOT preview-like
 *   2. Canonical map value for the siteId
 *
 * A preview-like `envUrl` is refused so a stale deployment URL from a prior
 * deploy step cannot leak into published artifact URLs.
 */
export function resolveAppUrl(input: {
  siteId: string;
  envUrl?: string | null;
  fallback?: string;
}): string {
  const env = (input.envUrl ?? "").trim();
  if (env && !isPreviewLikeUrl(env, input.siteId)) return env;
  if (input.fallback) return input.fallback;
  return canonicalAppUrl(input.siteId);
}
