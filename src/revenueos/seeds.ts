import type { SeedLesson } from "@revenueos/core";

/**
 * TributeReady-specific and death-care industry lessons. These live app-side —
 * never inside the portable brain — and are injected via
 * SiteAdapter.getSeedLessons() so the brain stays tenant-agnostic.
 */
export const TRIBUTEREADY_SEED_LESSONS: SeedLesson[] = [
  {
    id: "lesson_never_give_up",
    scope: "site",
    siteId: "tributeready",
    patternKey: "hour:thin_hour",
    summary:
      "Giving up is not an option. Every hour, including $0 hours, is a lesson. Always want better than the last hour, raise the bar, and keep hunting. Quitting, coasting, or waiting forever on one channel is forbidden.",
    evidenceCount: 1,
    transferable: true,
    sentiment: "positive",
    rankingWeight: 1.2,
  },
  {
    id: "lesson_never_wait_one_channel",
    scope: "site",
    siteId: "tributeready",
    patternKey: "indexnow-discovery",
    summary:
      "Never pause money-hunting for Ever Loved or any single owner-gated channel. Keep IndexNow, organic/SEO pages, directories, Search Console, and partnerships moving every cycle. Marketplace is one lever in a portfolio.",
    evidenceCount: 1,
    transferable: true,
    sentiment: "positive",
    rankingWeight: 1.35,
  },
  {
    id: "lesson_north_star_10k_day",
    scope: "site",
    siteId: "tributeready",
    patternKey: "shortfall:l4:discovery",
    summary:
      "TributeReady north star is a $10,000 contribution-profit day. Pre-revenue / thin discovery days are lost days — prefer acquisition levers that produce qualified traffic across many channels; never celebrate IndexNow activity as success, and never wait on one marketplace.",
    evidenceCount: 1,
    transferable: false,
    sentiment: "negative",
    rankingWeight: 1.2,
  },
  {
    id: "lesson_status_paid_trap",
    scope: "site",
    siteId: "tributeready",
    patternKey: "orders-status-fulfilled-not-paid",
    summary:
      "TributeReady orders succeed as status=fulfilled; querying status=paid silently returns zero forever.",
    evidenceCount: 1,
    transferable: false,
    sentiment: "neutral",
  },
  {
    id: "lesson_everloved_owner_gate",
    scope: "site",
    siteId: "tributeready",
    patternKey: "marketplace-listing-requires-owner",
    summary:
      "Ever Loved is a useful free marketplace with bereaved buyer intent, but it is only one channel and is owner-gated. Recommend when relevant; never treat it as the plan, never fake a listing, and never pause other acquisition while it is pending.",
    evidenceCount: 1,
    transferable: false,
    sentiment: "neutral",
    rankingWeight: 0.95,
  },
  {
    id: "lesson_church_bulletin_rejected",
    scope: "industry",
    industry: "death-care",
    patternKey: "church-bulletin-saas",
    summary:
      "Churches often already get free/ad-funded bulletins; a paid weekly bulletin tool is a weak wedge without clear time savings beyond incumbents.",
    evidenceCount: 1,
    transferable: true,
    sentiment: "negative",
    rankingWeight: 0.6,
  },
  {
    id: "lesson_fh_sells_stationery",
    scope: "industry",
    industry: "death-care",
    patternKey: "funeral-home-program-referral-conflict",
    summary:
      "Funeral homes that sell programs on the family bill may lose money referring DIY makers; validate willingness to pay before building B2B SaaS.",
    evidenceCount: 1,
    transferable: true,
    sentiment: "negative",
    rankingWeight: 0.7,
  },
];
