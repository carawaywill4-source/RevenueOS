/**
 * Env-based executability check.
 *
 * Lives in `@revenueos/core` so both the operator process and the external
 * mission-watchdog can consult it before enqueuing an experiment. Returns
 * true only for channel families whose required credentials/services are
 * present in this process's environment.
 *
 * The operator process wraps this with a richer registry (owner-action
 * metadata for the bridge to enqueue) but the executability decision itself
 * is identical across services.
 */

import type { ChannelFamily } from "./types.js";

export function coreCanExecuteFamily(family: ChannelFamily): boolean {
  switch (family) {
    case "marketplace_listing":
      return Boolean(process.env.GUMROAD_ACCESS_TOKEN?.trim());
    case "storefront_evolution":
      return (
        Boolean(process.env.HOSTING_PLANE_URL?.trim()) &&
        Boolean(process.env.HOSTING_PLANE_TOKEN?.trim() || process.env.CRON_SECRET?.trim()) &&
        Boolean(process.env.REVENUEOS_APP_ROOT?.trim())
      );
    case "github_repo":
      return Boolean(process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim());
    case "cold_email":
      // Cold email requires a qualified target dossier; env alone is
      // insufficient. Return false — the operator will re-check with the
      // richer registry if needed, but the seed selection loop should not
      // enqueue cold_email until per-target evidence exists.
      return false;
    case "community_reply":
    case "product_hunt":
    case "seo_answer":
    case "direct_dm":
    case "forum_post":
    case "review_site_seed":
      return false;
    default:
      return false;
  }
}
