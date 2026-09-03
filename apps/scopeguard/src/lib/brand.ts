import type { BrandConfig } from "@revenueos/storefront-kit";

/**
 * ScopeGuard brand — FORGE Phase 1 quality pass.
 * Job-to-be-done: help independents set boundaries and get paid for scope expansion.
 */
export const BRAND: BrandConfig = {
  siteId: "scopeguard",
  displayName: "ScopeGuard",
  domain: "scopeguard.vercel.app",
  industry: "freelancer_contracts",
  businessModel: "digital_download",
  priceBand: "20_50",
  considerationLevel: "utilitarian",
  brandVoice: "direct, protective, no-nonsense",
  primaryColor: "#1E3A5F",
  accentColor: "#0F766E",
  fontDisplay: "IBM Plex Serif",
  fontBody: "IBM Plex Sans",
  supportEmail: "care@scopeguard.com",
  product: {
    id: "scopeguard-pack",
    slug: "scopeguard-pack",
    name: "Freelance SOW & Change-Order Pack",
    tagline:
      "Turn fuzzy client asks into billable change orders — before the unpaid work starts.",
    description:
      "Plain-language statements of work, change-order forms, and kickoff checklists that help solo freelancers protect margin when scope expands. Download instantly after purchase.",
    priceUsd: 45,
    assetFiles: ["readme.md", "guide-01.md", "guide-02.md", "guide-03.md"],
    bullets: [
      "SOW templates for design, writing, and development engagements",
      "Change-order form that documents scope, price, and approval",
      "Kickoff questionnaire clients can finish in one sitting",
      "Late-payment reminder scripts that stay professional",
    ],
    audience: "solo freelancers losing money to scope creep",
    intentKeywords: [
      "freelance statement of work template",
      "scope creep change order",
      "freelancer contract template",
    ],
  },
  discoveryDoors: [
    {
      slug: "freelance-statement-of-work-template",
      title: "Freelance statement of work template",
      intentQuery: "freelance statement of work template",
      body: `A freelance statement of work should do one job: make the deliverables, timeline, and out-of-scope items unambiguous before work begins.

ScopeGuard’s SOW templates are written for solo designers, writers, and developers. They include a clean revision policy, payment milestones, and a change-order trigger so “quick extras” become documented, billable work — not silent unpaid hours.

Use the pack when a client wants to start from a verbal brief. Fill the SOW, send it for signature or email confirmation, and keep the change-order form ready when the request list grows.`,
    },
    {
      slug: "scope-creep-change-order",
      title: "Scope creep change order",
      intentQuery: "scope creep change order",
      body: `Scope creep is usually not malice — it is undocumented expansion. The fix is a short change-order habit: name the new work, price it, get approval, then schedule it.

ScopeGuard includes a change-order form built for freelancers: requested change, impact on deadline, fee, and client approval line. Pair it with the SOW so you can point back to the original boundary without writing a legal novel.

If you have already been absorbing extras for free, start on the next request. One signed change order often pays for the pack.`,
    },
    {
      slug: "freelancer-contract-template",
      title: "Freelancer contract template",
      intentQuery: "freelancer contract template",
      body: `Most freelancers do not need a 20-page master agreement to protect a small project. They need a practical SOW + change-order pair that clients will actually read and approve.

ScopeGuard is not attorney-drafted legal advice. It is an operational pack: statement of work language, change orders, kickoff questions, and late-payment reminders — so you can run a professional engagement without reinventing documents each time.

If your projects are large, regulated, or high-liability, have counsel review. For typical freelance work, clarity beats theater.`,
    },
  ],
  sequenceIndex: 114,
};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
