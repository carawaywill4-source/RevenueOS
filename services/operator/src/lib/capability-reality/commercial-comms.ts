/**
 * Commercial communication brain — WHO / WHY THEM / OBJECTIVE / VALUE / OFFER / CTA / WHY NOW.
 * Research depth does not excuse weak asks. Quality gate before send.
 */

export type CommercialObjective =
  | "sale"
  | "partnership"
  | "backlink_resource_placement"
  | "directory_listing"
  | "creator_collaboration"
  | "affiliate"
  | "marketplace_approval"
  | "customer_discovery"
  | "introduction"
  | "referral"
  | "publication";

export type CommercialBrief = {
  who: string;
  whyThem: string;
  objective: CommercialObjective;
  value: string;
  offer: string;
  cta: string;
  whyNow: string;
  businessId: string;
  destinationUrl: string;
  contextUrl?: string;
};

export type QualityScores = {
  recipientRelevance: number;
  personalizationRelevance: number;
  objectiveClarity: number;
  recipientValue: number;
  offerClarity: number;
  ctaClarity: number;
  concision: number;
  credibility: number;
  responseLikelihood: number;
  funnelAdvanceLikelihood: number;
  spamRisk: number; // lower is better
  compliance: number;
  total: number;
  rejectReasons: string[];
};

export type ComposedMessage = {
  subject: string;
  text: string;
  brief: CommercialBrief;
  scores: QualityScores;
  approved: boolean;
};

/** Mean of 0–1 component scores (not a sum). */
const MIN_TOTAL = 0.68;
const MAX_WORDS = 180;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/** Old-style essay pitch (regression reference — do not send). */
export function exampleOldStyleWeakEmail(): string {
  return [
    "Hi — I came across your page while researching resources for founders preparing investor decks.",
    "",
    "We spent significant time mapping competitor tools, buyer language, and directory ecosystems.",
    "Our research suggests your audience overlaps with people who need pitch structure.",
    "We published a practical free entry point for: messy decks delaying fundraising conversations.",
    "Tracked link (no signup wall): https://deckready.example/?utm=...",
    "",
    "If it is a genuine fit for your readers/list, feel free to use or ignore — no ask beyond relevance.",
    "Reply STOP to opt out.",
    "",
    "— Titan / RevenueOS for deckready",
  ].join("\n");
}

export function scoreCommercialMessage(
  brief: CommercialBrief,
  subject: string,
  text: string,
): QualityScores {
  const rejectReasons: string[] = [];
  const words = wordCount(text);
  const hasCta = /https?:\/\/|reply|click|list|add|share|try/i.test(
    `${brief.cta} ${text}`,
  );
  const buriesAsk =
    text.toLowerCase().indexOf(brief.cta.toLowerCase().slice(0, 24)) > 400;
  const researchFlex = /we researched|significant time|competitor map/i.test(
    text,
  );
  const vague =
    /feel free to use or ignore|no ask beyond relevance|just sharing/i.test(
      text,
    );

  const recipientRelevance = clamp01(
    brief.who.length > 8 && brief.whyThem.length > 12 ? 0.85 : 0.35,
  );
  const personalizationRelevance = clamp01(
    brief.contextUrl || /your (page|site|directory|list|readers)/i.test(text)
      ? 0.75
      : 0.4,
  );
  const objectiveClarity = clamp01(
    brief.objective && !vague ? 0.9 : 0.25,
  );
  const recipientValue = clamp01(brief.value.length > 20 ? 0.8 : 0.3);
  const offerClarity = clamp01(brief.offer.length > 15 ? 0.85 : 0.3);
  const ctaClarity = clamp01(hasCta && brief.cta.length > 8 ? 0.9 : 0.2);
  const concision = clamp01(words <= 120 ? 1 : words <= MAX_WORDS ? 0.7 : 0.2);
  const credibility = clamp01(
    /RevenueOS|TributeReady|free |utility|tool/i.test(text) ? 0.75 : 0.45,
  );
  const responseLikelihood = clamp01(
    (objectiveClarity + ctaClarity + recipientValue) / 3,
  );
  const funnelAdvanceLikelihood = clamp01(
    (offerClarity + ctaClarity + recipientRelevance) / 3,
  );
  const spamRisk = clamp01(
    (researchFlex ? 0.35 : 0) +
      (vague ? 0.25 : 0) +
      (words > MAX_WORDS ? 0.3 : 0) +
      (buriesAsk ? 0.2 : 0),
  );
  const compliance = clamp01(/STOP|unsubscribe|opt out/i.test(text) ? 0.9 : 0.4);

  if (recipientRelevance < 0.5) rejectReasons.push("weak_recipient_relevance");
  if (objectiveClarity < 0.5) rejectReasons.push("unclear_objective");
  if (offerClarity < 0.5) rejectReasons.push("unclear_offer");
  if (ctaClarity < 0.5) rejectReasons.push("unclear_cta");
  if (concision < 0.5) rejectReasons.push("too_long");
  if (spamRisk > 0.55) rejectReasons.push("spam_risk");
  if (compliance < 0.5) rejectReasons.push("missing_opt_out");
  if (researchFlex) rejectReasons.push("research_flex_essay");
  if (vague) rejectReasons.push("vague_non_ask");
  if (!subject.trim()) rejectReasons.push("empty_subject");

  const positive =
    recipientRelevance +
    personalizationRelevance +
    objectiveClarity +
    recipientValue +
    offerClarity +
    ctaClarity +
    concision +
    credibility +
    responseLikelihood +
    funnelAdvanceLikelihood +
    compliance;
  const total = positive / 11 - spamRisk * 0.5;

  return {
    recipientRelevance,
    personalizationRelevance,
    objectiveClarity,
    recipientValue,
    offerClarity,
    ctaClarity,
    concision,
    credibility,
    responseLikelihood,
    funnelAdvanceLikelihood,
    spamRisk,
    compliance,
    total,
    rejectReasons,
  };
}


/** COMMERCIAL_MEMORY_STEERING_V1 — load persisted commercial lessons for pre-send gating. */
export async function loadCommercialCommsLessons(
  pool: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> },
): Promise<string[]> {
  try {
    const res = await pool.query(
      `select value from ros_config_meta where key='commercial_comms_lessons' limit 1`,
    );
    const doc = (res.rows[0]?.value ?? {}) as { lessons?: Array<{ lesson?: string }> };
    const lessons = Array.isArray(doc.lessons) ? doc.lessons : [];
    return lessons
      .map((l) => String(l.lesson ?? ""))
      .filter((s) => s.length > 8)
      .slice(-12);
  } catch {
    return [];
  }
}

/** COMMERCIAL_MEMORY_STEERING_V1 — tighten gate when historical lessons match weak patterns. */
export function applyCommercialLessonBias(
  scores: QualityScores,
  lessons: string[],
): QualityScores {
  if (!lessons.length) return scores;
  const blob = lessons.join(" \n ").toLowerCase();
  const rejectReasons = [...scores.rejectReasons];
  let spamRisk = scores.spamRisk;
  let objectiveClarity = scores.objectiveClarity;
  if (/one license|weak cta|unclear|research-flex|routing\/support/.test(blob)) {
    if (scores.ctaClarity < 0.75) rejectReasons.push("lesson_weak_cta");
    if (scores.objectiveClarity < 0.75) rejectReasons.push("lesson_unclear_objective");
    spamRisk = Math.min(1, spamRisk + 0.08);
    objectiveClarity = Math.max(0, objectiveClarity - 0.05);
  }
  const uniq = [...new Set(rejectReasons)];
  const total = Math.max(
    0,
    scores.total - (uniq.length > scores.rejectReasons.length ? 0.05 : 0),
  );
  return {
    ...scores,
    spamRisk,
    objectiveClarity,
    rejectReasons: uniq,
    total,
  };
}

export function composeCommercialEmail(brief: CommercialBrief): ComposedMessage {
  const objectiveLine: Record<CommercialObjective, string> = {
    sale: "I'd like to see if this is useful enough to become a customer conversation.",
    partnership:
      "I'm proposing a simple partnership: you feature the free tool; your audience gets value.",
    backlink_resource_placement:
      "I'm asking you to consider adding this free tool to your resource list if it fits.",
    directory_listing:
      "I'm requesting a directory listing for a live free utility your users can try immediately.",
    creator_collaboration:
      "I'm proposing a creator collaboration around a free utility your audience already seeks.",
    affiliate: "I'm proposing an affiliate arrangement if the free tool converts for your audience.",
    marketplace_approval: "I'm requesting marketplace approval for a live product listing.",
    customer_discovery:
      "I'm asking one question: does this problem match what you hear from your audience?",
    introduction: "I'm asking for a single introduction to the person who owns partnerships.",
    referral: "I'm asking for a referral only if you personally think it's a fit.",
    publication: "I'm asking you to publish/mention this free utility if it meets your bar.",
  };

  const subject = (() => {
    switch (brief.objective) {
      case "directory_listing":
        return `Listing request: free ${brief.businessId} utility for your directory`;
      case "backlink_resource_placement":
        return `Resource addition request — free tool for ${brief.who}`;
      case "partnership":
        return `Partnership idea: free utility for your audience`;
      case "creator_collaboration":
        return `Collab idea: free utility your readers can use today`;
      default:
        return `Quick ask: ${brief.offer.slice(0, 48)}`;
    }
  })();

  const text = [
    `Hi — writing to ${brief.who}.`,
    ``,
    `Why you: ${brief.whyThem}`,
    ``,
    `What they get: ${brief.value}`,
    `What we're offering: ${brief.offer}`,
    `Link: ${brief.destinationUrl}`,
    ``,
    `The ask (one action): ${brief.cta}`,
    objectiveLine[brief.objective],
    ``,
    `Why now: ${brief.whyNow}`,
    brief.contextUrl ? `Context page: ${brief.contextUrl}` : null,
    ``,
    `Reply STOP to opt out.`,
    `— RevenueOS for ${brief.businessId}`,
  ]
    .filter((l): l is string => l != null)
    .join("\n");

  const scores = scoreCommercialMessage(brief, subject, text);
  const approved = scores.total >= MIN_TOTAL && scores.rejectReasons.length === 0;
  return { subject, text, brief, scores, approved };
}

export function buildResourcePlacementBrief(input: {
  businessId: string;
  buyerRole: string;
  problem: string;
  destinationUrl: string;
  contextUrl: string;
  contextSnippet: string;
  pageTitle: string;
}): CommercialBrief {
  const who =
    input.pageTitle?.trim() ||
    `editor/curator at ${safeHost(input.contextUrl)}`;
  return {
    who,
    whyThem: `You curate resources relevant to ${input.buyerRole.replace(/_/g, " ")}s dealing with: ${input.problem}. ${input.contextSnippet.slice(0, 120)}`.trim(),
    objective: "backlink_resource_placement",
    value: `A free, no-signup utility that helps ${input.buyerRole.replace(/_/g, " ")}s with ${input.problem} — usable in under 2 minutes.`,
    offer: `Add our free ${input.businessId} utility to your resource list/page if it meets your editorial bar.`,
    cta: `If relevant, add this link to the page (or reply “send details” and I’ll provide a 1-line blurb): ${input.destinationUrl}`,
    whyNow: `Your page is actively ranking/serving people with this problem; a free tool is additive, not competitive spam.`,
    businessId: input.businessId,
    destinationUrl: input.destinationUrl,
    contextUrl: input.contextUrl,
  };
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "your site";
  }
}
