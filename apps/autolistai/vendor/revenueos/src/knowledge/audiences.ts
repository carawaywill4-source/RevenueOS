import type { AcquisitionChannel, AudiencePersona } from "../types";

/**
 * Portable buyer archetypes — transferable "stereotypes" of who buys and why.
 * These are evergreen behavioral models, not individuals: no end-user PII ever
 * enters RevenueOS memory. Sites can override/extend via BusinessContext
 * audienceSegments; the brain fills any gaps from these.
 */
export const BUYER_ARCHETYPES: AudiencePersona[] = [
  {
    id: "urgent-need",
    label: "Urgent need",
    traits: ["deadline-driven", "outcome-focused", "will pay for speed"],
    habits: [
      "searches an exact-match query",
      "buys the first credible option that clearly solves it",
      "skips comparison when time is short",
    ],
    channels: ["organic_search", "marketplaces", "directories"],
    triggers: ["a looming deadline", "a clear, immediate outcome", "proof it works fast"],
    objections: ["will this actually be ready in time?", "is this legit?"],
    messagingAngles: [
      "Done in minutes, not days",
      "Exactly what you need, ready now",
      "Trusted by people in the same situation",
    ],
    intentTemperature: "hot",
  },
  {
    id: "researcher",
    label: "Careful researcher",
    traits: ["comparison shopper", "reads reviews", "risk-averse"],
    habits: [
      "opens many tabs",
      "reads examples and specifics",
      "returns later to buy after validating",
    ],
    channels: ["organic_search", "content_seo", "communities", "social_organic"],
    triggers: ["concrete examples", "transparent pricing", "third-party validation"],
    objections: ["is it worth it vs alternatives?", "hidden catches?"],
    messagingAngles: [
      "See real examples before you decide",
      "Transparent pricing, no surprises",
      "Here is exactly what you get",
    ],
    intentTemperature: "warm",
  },
  {
    id: "bargain-hunter",
    label: "Value seeker",
    traits: ["price-sensitive", "deal-motivated", "compares cost"],
    habits: ["searches 'cheap/free/vs'", "abandons at unexpected cost", "responds to offers"],
    channels: ["organic_search", "marketplaces", "communities", "referral"],
    triggers: ["clear value for money", "no unexpected fees", "a fair comparison"],
    objections: ["can I get this cheaper or free elsewhere?"],
    messagingAngles: [
      "The affordable way to get a professional result",
      "No subscription, no hidden fees",
      "Compare and see the value",
    ],
    intentTemperature: "warm",
  },
  {
    id: "delegator",
    label: "Time-poor delegator",
    traits: ["busy", "convenience-first", "will pay to avoid effort"],
    habits: ["wants it handled", "values templates/done-for-you", "low patience for setup"],
    channels: ["organic_search", "partnerships", "referral", "email_list"],
    triggers: ["least effort path", "professional result without work", "one-click"],
    objections: ["how much work is this really?"],
    messagingAngles: [
      "We do the hard part for you",
      "Professional result, zero learning curve",
      "Start from a proven template",
    ],
    intentTemperature: "warm",
  },
  {
    id: "advocate",
    label: "Community advocate",
    traits: ["shares recommendations", "trusts peers", "active in groups"],
    habits: ["asks/answers in communities", "refers others", "follows word of mouth"],
    channels: ["communities", "social_organic", "referral", "outreach_pr"],
    triggers: ["a peer recommendation", "being genuinely helped", "something worth sharing"],
    objections: ["is this actually good enough to recommend?"],
    messagingAngles: [
      "Recommended by people who were exactly here",
      "Genuinely helpful, worth sharing",
      "Built for this community's needs",
    ],
    intentTemperature: "cold",
  },
];

/**
 * The zero-spend, in-policy acquisition channels the brain knows how to work.
 * Ordered rough default priority; the audience model re-ranks by persona fit
 * and the current discovery gap. Paid channels are intentionally excluded —
 * they require an owner-approved budget and are gated by policy.
 */
export const ACQUISITION_CHANNELS: AcquisitionChannel[] = [
  {
    key: "organic_search",
    label: "Organic search (high-intent queries)",
    intent: "high",
    precursor: "landing_views",
    effort: 3,
    needsOwner: false,
    playbook:
      "Map exact buyer queries to a dedicated, genuinely useful page. Match intent, add concrete examples and transparent pricing. Never mass-produce thin pages.",
  },
  {
    key: "marketplaces",
    label: "Relevant marketplaces / listing sites",
    intent: "high",
    precursor: "purchases",
    effort: 2,
    needsOwner: true,
    playbook:
      "List where buyers with active intent already transact when an owner account exists. One channel among many — never pause organic, directories, content, or other open plays while a marketplace listing is pending.",
  },
  {
    key: "directories",
    label: "Free directories & structured listings",
    intent: "medium",
    precursor: "landing_views",
    effort: 1,
    needsOwner: false,
    playbook:
      "Submit to reputable, account-free directories and structured data indexes. Get discovered without fabricating links.",
  },
  {
    key: "communities",
    label: "Communities & forums (be genuinely helpful)",
    intent: "medium",
    precursor: "landing_views",
    effort: 2,
    needsOwner: true,
    playbook:
      "Answer real questions where the audience gathers, disclosing affiliation honestly. Help first, link only when it truly answers the question. Never spam.",
  },
  {
    key: "content_seo",
    label: "Content that earns high-intent search",
    intent: "medium",
    precursor: "landing_views",
    effort: 3,
    needsOwner: false,
    playbook:
      "Publish genuinely better answers to the questions buyers ask right before purchase. Quality over volume; earn the ranking.",
  },
  {
    key: "partnerships",
    label: "Complementary partnerships",
    intent: "medium",
    precursor: "landing_views",
    effort: 3,
    needsOwner: true,
    playbook:
      "Partner with non-competing services the same buyer already uses. Cross-refer where it genuinely helps the shared customer.",
  },
  {
    key: "referral",
    label: "Referral / word of mouth",
    intent: "high",
    precursor: "purchases",
    effort: 2,
    needsOwner: false,
    playbook:
      "Make a delighted buyer's recommendation effortless. Ask at the moment of satisfaction; never incentivize fake reviews.",
  },
  {
    key: "social_organic",
    label: "Organic social presence",
    intent: "low",
    precursor: "landing_views",
    effort: 2,
    needsOwner: true,
    playbook:
      "Show real examples and outcomes where the audience already scrolls. Truthful, useful, no engagement bait.",
  },
  {
    key: "outreach_pr",
    label: "Direct outreach & earned mentions",
    intent: "medium",
    precursor: "landing_views",
    effort: 4,
    needsOwner: true,
    playbook:
      "Reach the specific people/outlets who serve this buyer with a genuinely useful pitch. Personalized, never mass-mailed.",
  },
  {
    key: "email_list",
    label: "Owned email / existing audience",
    intent: "high",
    precursor: "purchases",
    effort: 1,
    needsOwner: false,
    playbook:
      "Re-engage people who already opted in with a timely, relevant reason to act. Consent-based only.",
  },
];

export function channelByKey(key: string): AcquisitionChannel | undefined {
  return ACQUISITION_CHANNELS.find((c) => c.key === key);
}

/**
 * Infer relevant archetypes from an industry string when the site declares no
 * segments. Heuristic and conservative: always returns at least a broad spread
 * so acquisition is never starved of personas.
 */
export function inferArchetypes(industry: string): AudiencePersona[] {
  const i = industry.toLowerCase();
  const pick = (ids: string[]) =>
    BUYER_ARCHETYPES.filter((a) => ids.includes(a.id));

  // Urgent / deadline-driven categories.
  if (/(funeral|memorial|legal|medical|repair|emergency|tax|visa|ticket)/.test(i)) {
    return pick(["urgent-need", "researcher", "delegator", "bargain-hunter"]);
  }
  // Considered / researched purchases.
  if (/(saas|software|b2b|finance|insurance|education|course)/.test(i)) {
    return pick(["researcher", "delegator", "bargain-hunter", "advocate"]);
  }
  // Default broad spread.
  return pick(["researcher", "urgent-need", "bargain-hunter", "advocate"]);
}
