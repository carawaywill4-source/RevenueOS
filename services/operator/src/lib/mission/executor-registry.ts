/**
 * Executor registry — the single source of truth for which channel families
 * RevenueOS can physically execute *right now* given the current process
 * credentials. Consulted by:
 *
 *   - MissionController.recoverFromStarvation (executability gate — non-
 *     executable families are skipped when selecting the next experiment)
 *   - executor-bridge (dispatch)
 *
 * A family that appears here is real. A family that is missing goes down
 * the owner-action queue instead of pretending to run.
 */

import type { ChannelFamily } from "@revenueos/core";

export type ExecutabilityDecision =
  | {
      executable: true;
      executor: string;
    }
  | {
      executable: false;
      reason: string;
      ownerActionRequired?: boolean;
      ownerAction?: {
        platform: string;
        exactAction: string;
        whyRequired: string;
        url?: string;
        followupAfter?: string;
      };
    };

export type ExecutabilityCheck = () => ExecutabilityDecision;

const registry: Partial<Record<ChannelFamily, ExecutabilityCheck>> = {
  marketplace_listing: (): ExecutabilityDecision => {
    if (!process.env.GUMROAD_ACCESS_TOKEN?.trim()) {
      return {
        executable: false,
        reason: "no_gumroad_access_token",
        ownerActionRequired: true,
        ownerAction: {
          platform: "gumroad",
          exactAction: "Set GUMROAD_ACCESS_TOKEN in /etc/revenueos/revenueos.env",
          whyRequired:
            "Gumroad product creation requires a valid Personal Access Token; RevenueOS will otherwise silently no-op.",
          url: "https://app.gumroad.com/settings/advanced",
          followupAfter:
            "Restart revenueos-operator; MissionController will pick up marketplace_listing experiments on the next tick.",
        },
      };
    }
    return { executable: true, executor: "gumroad-marketplace" };
  },

  storefront_evolution: (): ExecutabilityDecision => {
    if (!process.env.REVENUEOS_APP_ROOT?.trim()) {
      return {
        executable: false,
        reason: "no_app_root",
      };
    }
    if (!process.env.HOSTING_PLANE_URL?.trim() || !process.env.HOSTING_PLANE_TOKEN?.trim()) {
      return {
        executable: false,
        reason: "no_hosting_plane",
        ownerActionRequired: true,
        ownerAction: {
          platform: "hosting-plane",
          exactAction:
            "Ensure HOSTING_PLANE_URL and HOSTING_PLANE_TOKEN are set in /etc/revenueos/revenueos.env.",
          whyRequired:
            "Storefront evolution deploys new copy to the hosting plane; without hosting-plane credentials, mutations never reach a public URL.",
        },
      };
    }
    return { executable: true, executor: "storefront-evolution" };
  },

  github_repo: (): ExecutabilityDecision => {
    const tokenPresent =
      Boolean(process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim());
    if (!tokenPresent) {
      return {
        executable: false,
        reason: "no_github_token",
        ownerActionRequired: true,
        ownerAction: {
          platform: "github",
          exactAction:
            "Create a GitHub personal access token with 'public_repo' scope and set GITHUB_TOKEN in /etc/revenueos/revenueos.env. Also install the gh CLI and run `sudo -u azureuser gh auth login`.",
          whyRequired:
            "The github_repo executor publishes real public repositories; without credentials it cannot produce external proof.",
          url: "https://github.com/settings/tokens",
          followupAfter:
            "Restart revenueos-operator; MissionController will treat github_repo as executable.",
        },
      };
    }
    return { executable: true, executor: "github-repo" };
  },

  cold_email: (): ExecutabilityDecision => {
    // Cold email is executable ONLY when the operator has qualified,
    // personalized targets to send to. Since the seed catalog does not carry
    // per-target dossiers, we block it for now with an owner-action for a
    // person to load a real target list. This is the "stop the shotgun"
    // policy the owner explicitly demanded.
    return {
      executable: false,
      reason: "no_qualified_target_dossiers",
      ownerActionRequired: true,
      ownerAction: {
        platform: "internal",
        exactAction:
          "Upload a qualified target dossier CSV (company, buyer, role, why-they-have-this-problem, personalization signal) to ros_outreach_prospects, or approve outbound to an existing verified segment.",
        whyRequired:
          "The cold_email executor refuses to send to generic inboxes; per-target evidence is required.",
        followupAfter:
          "MissionController will treat cold_email as executable once the qualified queue has rows.",
      },
    };
  },

  community_reply: (): ExecutabilityDecision => ({
    executable: false,
    reason: "no_platform_permission",
    ownerActionRequired: true,
    ownerAction: {
      platform: "community",
      exactAction:
        "Provision a legitimate account on the target community platform (Reddit / IndieHackers / HN / etc.) and register credentials with RevenueOS.",
      whyRequired:
        "Community platforms forbid unattended posting from anonymous automation; RevenueOS will not create throwaway accounts.",
    },
  }),

  product_hunt: (): ExecutabilityDecision => {
    if (
      !process.env.PRODUCTHUNT_DEVELOPER_TOKEN?.trim() &&
      !process.env.PRODUCTHUNT_API_KEY?.trim()
    ) {
      return {
        executable: false,
        reason: "no_producthunt_creds",
        ownerActionRequired: true,
        ownerAction: {
          platform: "producthunt",
          exactAction: "Provision Product Hunt developer credentials.",
          whyRequired: "Launching requires OAuth-bound account access.",
        },
      };
    }
    // Even with credentials, PH launches require account-age and an owner
    // "maker" relationship. We surface the eligibility blocker until a
    // real PREPARE/PUBLISH split executor is built and the account is
    // proven eligible.
    return {
      executable: false,
      reason: "eligibility_unverified",
      ownerActionRequired: true,
      ownerAction: {
        platform: "producthunt",
        exactAction:
          "Confirm the connected Product Hunt account is eligible to launch (age, maker status, past activity) and mark it verified in ros_platform_accounts.",
        whyRequired: "PH silently shadow-limits new/unverified accounts.",
      },
    };
  },

  seo_answer: (): ExecutabilityDecision => ({
    executable: false,
    reason: "no_public_publishing_surface_wired",
    ownerActionRequired: false,
  }),

  direct_dm: (): ExecutabilityDecision => ({
    executable: false,
    reason: "no_platform_permission",
    ownerActionRequired: true,
    ownerAction: {
      platform: "dm",
      exactAction:
        "Register a legitimate platform account and messaging integration before allowing direct-message experiments.",
      whyRequired:
        "Automated DMs from anonymous accounts violate every reputable platform's ToS.",
    },
  }),

  forum_post: (): ExecutabilityDecision => ({
    executable: false,
    reason: "no_platform_permission",
    ownerActionRequired: true,
    ownerAction: {
      platform: "forum",
      exactAction: "Register a legitimate forum account with participation history.",
      whyRequired: "Cold-account forum posting is spam.",
    },
  }),

  review_site_seed: (): ExecutabilityDecision => ({
    executable: false,
    reason: "no_legitimate_review_source",
    ownerActionRequired: true,
    ownerAction: {
      platform: "review",
      exactAction:
        "Only post reviews from customers who actually used the product; seed reviews from RevenueOS are prohibited.",
      whyRequired: "Fabricated reviews are illegal in most jurisdictions.",
    },
  }),
};

export function checkExecutability(family: ChannelFamily): ExecutabilityDecision {
  const fn = registry[family];
  if (!fn) {
    return { executable: false, reason: `no_registered_executor_for_${family}` };
  }
  return fn();
}

export function canExecuteFamily(family: ChannelFamily): boolean {
  return checkExecutability(family).executable;
}
