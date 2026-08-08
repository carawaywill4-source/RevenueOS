import OpenAI from "openai";
import type {
  DiscoveryDoor,
  DiscoveryDoorScore,
  DiscoveryDoorStatus,
} from "@revenueos/core";
import { clusterKeyFromQuery } from "@revenueos/core";
import { PRODUCTS } from "@/catalog/products";
import { BRAND } from "@/lib/brand";
import { appendJournal } from "@/lib/events";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase";

export type DiscoveryAttack = {
  query: string;
  angle: string;
  productIds: string[];
  competitorGap: string;
  sourceUrls: string[];
};

export type PublishedTopic = {
  slug: string;
  title: string;
  metaDescription: string;
  body: string;
  productIds: string[];
  query: string;
  clusterKey: string;
  publishedAt: string;
  sourceUrls: string[];
  status: DiscoveryDoorStatus;
  doorId: string;
  investigateCount?: number;
  lastScore?: DiscoveryDoorScore;
  killedAt?: string;
  killReason?: string;
};

export type DiscoveryState = {
  updatedAt: string;
  lastResearchAt?: string;
  lastPublishAt?: string;
  lastSitemapPingAt?: string;
  researchSummary?: string;
  demandNotes: string[];
  attacks: DiscoveryAttack[];
  publishedTopics: PublishedTopic[];
  lessons: string[];
  researchCount: number;
  publishCount: number;
};

const DEFAULT_STATE: DiscoveryState = {
  updatedAt: new Date(0).toISOString(),
  demandNotes: [],
  attacks: [],
  publishedTopics: [],
  lessons: [],
  researchCount: 0,
  publishCount: 0,
};

let cache: { at: number; state: DiscoveryState } | null = null;
const TTL_MS = 10_000;
const RESEARCH_COOLDOWN_MS = 20 * 60 * 1000;
const PUBLISH_COOLDOWN_MS = 15 * 60 * 1000;
const SITEMAP_COOLDOWN_MS = 30 * 60 * 1000;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function productCatalogBrief() {
  return PRODUCTS.slice(0, 32).map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    category: p.category,
    problem: p.problem,
  }));
}

export function defaultDiscoveryState(): DiscoveryState {
  return structuredClone(DEFAULT_STATE);
}

function hydrateState(
  doc: Partial<DiscoveryState> | null | undefined,
  updatedAt?: string,
): DiscoveryState {
  return {
    ...defaultDiscoveryState(),
    ...(doc ?? {}),
    demandNotes: Array.isArray(doc?.demandNotes) ? doc!.demandNotes : [],
    attacks: Array.isArray(doc?.attacks) ? doc!.attacks : [],
    publishedTopics: Array.isArray(doc?.publishedTopics) ? doc!.publishedTopics : [],
    lessons: Array.isArray(doc?.lessons) ? doc!.lessons : [],
    updatedAt: updatedAt ?? doc?.updatedAt ?? new Date().toISOString(),
  };
}

export async function loadDiscoveryState(): Promise<DiscoveryState> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.state;
  if (!supabaseConfigured()) {
    cache = { at: Date.now(), state: defaultDiscoveryState() };
    return cache.state;
  }
  try {
    const primary = await getSupabaseAdmin()
      .from("mh_discovery_state")
      .select("document,updated_at")
      .eq("id", "live")
      .maybeSingle();
    if (!primary.error && primary.data) {
      const state = hydrateState(
        primary.data.document as Partial<DiscoveryState>,
        primary.data.updated_at,
      );
      cache = { at: Date.now(), state };
      return state;
    }
    // Fallback until mh_discovery_state DDL is applied: reuse merch table row.
    const fallback = await getSupabaseAdmin()
      .from("mh_merch_state")
      .select("document,updated_at")
      .eq("id", "discovery")
      .maybeSingle();
    if (!fallback.error && fallback.data) {
      const state = hydrateState(
        fallback.data.document as Partial<DiscoveryState>,
        fallback.data.updated_at,
      );
      cache = { at: Date.now(), state };
      return state;
    }
    cache = { at: Date.now(), state: defaultDiscoveryState() };
    return cache.state;
  } catch {
    cache = { at: Date.now(), state: defaultDiscoveryState() };
    return cache.state;
  }
}

export async function saveDiscoveryState(state: DiscoveryState): Promise<void> {
  const next = { ...state, updatedAt: new Date().toISOString() };
  cache = { at: Date.now(), state: next };
  if (!supabaseConfigured()) return;
  const row = {
    id: "live",
    document: next,
    updated_at: next.updatedAt,
    updated_by: "revenueos",
  };
  const primary = await getSupabaseAdmin().from("mh_discovery_state").upsert(row);
  if (!primary.error) return;
  // Compat path: store under mh_merch_state id=discovery
  await getSupabaseAdmin().from("mh_merch_state").upsert({
    id: "discovery",
    document: next,
    updated_at: next.updatedAt,
    updated_by: "revenueos",
  });
}

export async function getPublishedTopic(slug: string): Promise<PublishedTopic | null> {
  const state = await loadDiscoveryState();
  return state.publishedTopics.find((topic) => topic.slug === slug) ?? null;
}

export async function listPublishedTopics(): Promise<PublishedTopic[]> {
  const state = await loadDiscoveryState();
  return state.publishedTopics;
}

type ResearchPayload = {
  summary: string;
  demandNotes: string[];
  attacks: Array<{
    query: string;
    angle: string;
    productIds: string[];
    competitorGap: string;
    sourceUrls: string[];
  }>;
  lesson: string;
};

function deterministicResearch(viewsLastHour: number): ResearchPayload {
  const lanes = [
    {
      query: "renter friendly bathroom organizer no drill",
      angle: "Honest no-drill install notes beat miracle claims.",
      productIds: ["mh-tension-shower-caddy", "mh-over-door-hook-rack"],
      competitorGap: "Most listicles skip load ratings and landlord rules.",
    },
    {
      query: "under sink organizer for P trap pipes",
      angle: "Dimension-first under-sink page with drip-tray honesty.",
      productIds: ["mh-under-sink-caddy"],
      competitorGap: "Competitors show perfect cabinets; renters have pipes.",
    },
    {
      query: "pet hair hardwood floor broom rubber",
      angle: "Floor-type specific pet hair cleanup without miracle shed claims.",
      productIds: ["mh-rubber-pet-broom", "mh-washable-lint-roller"],
      competitorGap: "Generic pet tools ignore hardwood scratch risk.",
    },
    {
      query: "small desk setup laptop riser cable management",
      angle: "Compact desk kits with weight ratings and cable raceways.",
      productIds: ["mh-aluminum-laptop-riser", "mh-monitor-stand-drawer"],
      competitorGap: "Aesthetic desk blogs skip real cable friction.",
    },
  ];
  const pick = lanes[Math.floor(Date.now() / RESEARCH_COOLDOWN_MS) % lanes.length];
  return {
    summary: `Deterministic discovery lane while web research unavailable. Last hour views=${viewsLastHour}. Attack query: ${pick.query}.`,
    demandNotes: [
      `${pick.query} — ${pick.angle}`,
      "US 3–7 day shipping is a conversion lever vs slow overseas dropship.",
    ],
    attacks: [
      {
        ...pick,
        sourceUrls: ["https://mendhaus.shop/guides"],
      },
    ],
    lesson: `With ${viewsLastHour} view(s)/hour, publish and index a problem page for "${pick.query}" instead of re-merchandising an empty funnel.`,
  };
}

export async function runInternetMarketResearch(input?: {
  viewsLastHour?: number;
  force?: boolean;
}): Promise<{ ok: boolean; detail: string; state: DiscoveryState; source: "ai" | "deterministic" }> {
  const viewsLastHour = input?.viewsLastHour ?? 0;
  const state = await loadDiscoveryState();
  if (
    !input?.force &&
    state.lastResearchAt &&
    Date.now() - Date.parse(state.lastResearchAt) < RESEARCH_COOLDOWN_MS
  ) {
    const left = Math.ceil(
      (RESEARCH_COOLDOWN_MS - (Date.now() - Date.parse(state.lastResearchAt))) / 1000,
    );
    return {
      ok: true,
      detail: `Market research on cooldown (${left}s). Last: ${state.researchSummary ?? "n/a"}`,
      state,
      source: "deterministic",
    };
  }

  let payload = deterministicResearch(viewsLastHour);
  let source: "ai" | "deterministic" = "deterministic";

  if (process.env.OPENAI_API_KEY) {
    try {
      const client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        timeout: 45_000,
        maxRetries: 0,
      });
      const response = await client.responses.create({
        model: process.env.OPENAI_MODEL || "gpt-5-mini",
        store: false,
        tools: [{ type: "web_search" }],
        instructions: [
          "You are Mendhaus RevenueOS — sole business manager mastering ORGANIC leads→sales.",
          "Goal: contribution profit toward $10,000/day. Ads are locked; organic must become lethal.",
          "Not okay traffic — mastery: strangers with buy intent who can convert on catalog SKUs.",
          "Search the live public web for people ready to BUY small-home / renter / desk / kitchen / pet-hair products NOW.",
          "Each attack must map to catalog productIds that can convert today (margin path clear).",
          "Reject vanity/informational queries. Prefer commercial/transactional intent only.",
          "Use ONLY real web findings plus the supplied catalog. Never invent traffic or sales.",
          "Return JSON: summary, demandNotes(string[2-5]), attacks([{query, angle, productIds, competitorGap, sourceUrls, estimatedIntent: buy|research}]), lesson.",
          "productIds from catalog only. sourceUrls real. Max 4 attacks. Prefer buy intent.",
          "Lesson must state how this creates organic sales mastery, not pageviews.",
        ].join(" "),
        input: JSON.stringify({
          brand: BRAND.name,
          site: "https://mendhaus.shop",
          objective: "Master organic qualified leads → sales toward $10k/day (ads locked)",
          era: "organic_mastery",
          viewsLastHour,
          catalog: productCatalogBrief(),
          priorAttacks: state.attacks.slice(0, 4),
          priorLesson: state.lessons[0] ?? null,
        }),
        text: { format: { type: "json_object" } },
      });

      const parsed = JSON.parse(response.output_text) as Partial<ResearchPayload>;
      if (
        typeof parsed.summary === "string" &&
        Array.isArray(parsed.attacks) &&
        parsed.attacks.length > 0
      ) {
        const known = new Set(PRODUCTS.map((p) => p.id));
        payload = {
          summary: parsed.summary.slice(0, 600),
          demandNotes: (parsed.demandNotes ?? [])
            .filter((n): n is string => typeof n === "string")
            .slice(0, 6)
            .map((n) => n.slice(0, 280)),
          attacks: parsed.attacks
            .slice(0, 4)
            .map((attack) => ({
              query: String(attack.query ?? "").slice(0, 120),
              angle: String(attack.angle ?? "").slice(0, 280),
              productIds: (attack.productIds ?? [])
                .filter((id): id is string => typeof id === "string" && known.has(id))
                .slice(0, 4),
              competitorGap: String(attack.competitorGap ?? "").slice(0, 280),
              sourceUrls: (attack.sourceUrls ?? [])
                .filter((url): url is string => typeof url === "string" && /^https?:\/\//.test(url))
                .slice(0, 5),
            }))
            .filter((attack) => attack.query.length > 3),
          lesson: String(parsed.lesson ?? payload.lesson).slice(0, 400),
        };
        if (payload.attacks.length) source = "ai";
        else payload = deterministicResearch(viewsLastHour);
      }
    } catch (error) {
      payload = {
        ...deterministicResearch(viewsLastHour),
        lesson: `Web research failed (${(error as Error).message}); used deterministic attack lane.`,
      };
    }
  }

  const next: DiscoveryState = {
    ...state,
    lastResearchAt: new Date().toISOString(),
    researchSummary: payload.summary,
    demandNotes: payload.demandNotes,
    attacks: payload.attacks,
    lessons: [payload.lesson, ...state.lessons].slice(0, 20),
    researchCount: state.researchCount + 1,
  };
  await saveDiscoveryState(next);
  await appendJournal(`Internet market research (${source})`, {
    summary: payload.summary,
    attacks: payload.attacks.map((a) => a.query),
    lesson: payload.lesson,
    source,
  });

  return {
    ok: true,
    detail: `${source}: ${payload.attacks[0]?.query ?? "no attack"} — ${payload.lesson.slice(0, 160)}`,
    state: next,
    source,
  };
}

export function topicToDoor(topic: PublishedTopic): DiscoveryDoor {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://mendhaus.shop").replace(/\/$/, "");
  return {
    id: topic.doorId || `door_${topic.slug}`,
    siteId: BRAND.siteId,
    slug: topic.slug,
    url: `${base}/topics/${topic.slug}`,
    query: topic.query,
    clusterKey: topic.clusterKey || clusterKeyFromQuery(topic.query),
    publishedAt: topic.publishedAt,
    status: topic.status ?? "active",
    exposureKey: `intent-topic:${topic.slug}`,
    investigateCount: topic.investigateCount,
    lastScore: topic.lastScore,
    killedAt: topic.killedAt,
    killReason: topic.killReason,
  };
}

export async function listDiscoveryDoorsFromState(): Promise<DiscoveryDoor[]> {
  const state = await loadDiscoveryState();
  return state.publishedTopics.map(topicToDoor);
}

export async function retireTopic(
  doorId: string,
  reason: string,
): Promise<{ ok: boolean; detail: string }> {
  const state = await loadDiscoveryState();
  const topics = state.publishedTopics.map((topic) => {
    if (topic.doorId !== doorId && `door_${topic.slug}` !== doorId) return topic;
    return {
      ...topic,
      status: "killed" as const,
      killedAt: new Date().toISOString(),
      killReason: reason,
    };
  });
  const hit = topics.find((t) => t.doorId === doorId || `door_${t.slug}` === doorId);
  if (!hit) return { ok: false, detail: `Door ${doorId} not found` };
  await saveDiscoveryState({ ...state, publishedTopics: topics });
  await appendJournal(`Retired discovery door ${hit.slug}`, { doorId, reason });
  return { ok: true, detail: `Retired /topics/${hit.slug}: ${reason}` };
}

export async function syncDoorScoreToTopic(door: DiscoveryDoor): Promise<void> {
  const state = await loadDiscoveryState();
  const topics = state.publishedTopics.map((topic) => {
    if (topic.doorId !== door.id && `door_${topic.slug}` !== door.id) return topic;
    return {
      ...topic,
      status: door.status,
      investigateCount: door.investigateCount,
      lastScore: door.lastScore,
      killedAt: door.killedAt,
      killReason: door.killReason,
    };
  });
  await saveDiscoveryState({ ...state, publishedTopics: topics });
}

export async function publishIntentTopic(input?: {
  force?: boolean;
}): Promise<{ ok: boolean; detail: string; topic?: PublishedTopic }> {
  const state = await loadDiscoveryState();
  if (
    !input?.force &&
    state.lastPublishAt &&
    Date.now() - Date.parse(state.lastPublishAt) < PUBLISH_COOLDOWN_MS
  ) {
    const left = Math.ceil(
      (PUBLISH_COOLDOWN_MS - (Date.now() - Date.parse(state.lastPublishAt))) / 1000,
    );
    return {
      ok: true,
      detail: `Intent publish on cooldown (${left}s). Live topics: ${state.publishedTopics.length}`,
    };
  }

  const active = state.publishedTopics.filter((t) => (t.status ?? "active") !== "killed");
  const overdue = active.filter((t) => {
    const age = (Date.now() - Date.parse(t.publishedAt)) / (24 * 60 * 60 * 1000);
    return age >= 3 && !t.lastScore;
  });
  if (!input?.force && overdue.length >= 3) {
    return {
      ok: false,
      detail: `Governor refused publish: ${overdue.length} doors overdue for scoring. Measure outcomes before more content.`,
    };
  }

  let working = state;
  if (!working.attacks.length) {
    const research = await runInternetMarketResearch({ force: true });
    working = research.state;
  }
  // Skip attacks whose clusters were already killed.
  const killed = new Set(
    working.publishedTopics
      .filter((t) => t.status === "killed")
      .map((t) => t.clusterKey || clusterKeyFromQuery(t.query)),
  );
  const attack = working.attacks.find(
    (a) => !killed.has(clusterKeyFromQuery(a.query)),
  );
  if (!attack) {
    return { ok: false, detail: "No attack query available to publish (all clusters killed or empty)" };
  }

  const slug = slugify(attack.query) || `attack-${Date.now().toString(36)}`;
  const clusterKey = clusterKeyFromQuery(attack.query);
  const productLines = attack.productIds
    .map((id) => PRODUCTS.find((p) => p.id === id))
    .filter(Boolean)
    .map((p) => `- ${p!.name}: ${p!.problem}`)
    .join("\n");

  let title = `${attack.query[0]?.toUpperCase()}${attack.query.slice(1)}`;
  let metaDescription = attack.angle.slice(0, 155);
  let body = [
    attack.angle,
    "",
    `What shoppers are actually looking for: ${attack.query}.`,
    "",
    `Competitor gap we can own with honesty: ${attack.competitorGap}`,
    "",
    "Products that answer this problem:",
    productLines || "- See Mendhaus kits for kitchen, bath, desk, and entry.",
    "",
    "We ship from US stock when listings are verified. No fake scarcity, no miracle claims.",
  ].join("\n");

  if (process.env.OPENAI_API_KEY) {
    try {
      const client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        timeout: 30_000,
        maxRetries: 0,
      });
      const response = await client.responses.create({
        model: process.env.OPENAI_MODEL || "gpt-5-mini",
        store: false,
        instructions:
          "Write a truthful Mendhaus SEO topic page. Return JSON: title, metaDescription, body. body is plain text with short paragraphs, max 900 chars. No fake reviews, scarcity, or invented specs. Use only supplied facts.",
        input: JSON.stringify({
          attack,
          products: attack.productIds.map((id) => PRODUCTS.find((p) => p.id === id)).filter(Boolean),
        }),
        text: { format: { type: "json_object" } },
      });
      const parsed = JSON.parse(response.output_text) as {
        title?: string;
        metaDescription?: string;
        body?: string;
      };
      if (parsed.title && parsed.body) {
        title = parsed.title.slice(0, 90);
        metaDescription = (parsed.metaDescription ?? metaDescription).slice(0, 155);
        body = parsed.body.slice(0, 1200);
      }
    } catch {
      // keep deterministic body
    }
  }

  const publishedAt = new Date().toISOString();
  const topic: PublishedTopic = {
    slug,
    title,
    metaDescription,
    body,
    productIds: attack.productIds,
    query: attack.query,
    clusterKey,
    publishedAt,
    sourceUrls: attack.sourceUrls,
    status: "active",
    doorId: `door_${slug}`,
  };

  const others = working.publishedTopics.filter((t) => t.slug !== slug);
  const next: DiscoveryState = {
    ...working,
    lastPublishAt: topic.publishedAt,
    publishedTopics: [topic, ...others].slice(0, 24),
    publishCount: working.publishCount + 1,
    lessons: [
      `Published /topics/${slug} for query "${attack.query}" to create a discoverable door for strangers.`,
      ...working.lessons,
    ].slice(0, 20),
  };
  await saveDiscoveryState(next);
  await appendJournal(`Published intent topic /topics/${slug}`, {
    query: attack.query,
    productIds: attack.productIds,
  });

  return {
    ok: true,
    detail: `Published /topics/${slug} for "${attack.query}"`,
    topic,
  };
}

export async function pingSitemap(): Promise<{ ok: boolean; detail: string }> {
  const state = await loadDiscoveryState();
  if (
    state.lastSitemapPingAt &&
    Date.now() - Date.parse(state.lastSitemapPingAt) < SITEMAP_COOLDOWN_MS
  ) {
    const left = Math.ceil(
      (SITEMAP_COOLDOWN_MS - (Date.now() - Date.parse(state.lastSitemapPingAt))) / 1000,
    );
    return { ok: true, detail: `Sitemap ping on cooldown (${left}s)` };
  }

  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://mendhaus.shop").replace(/\/$/, "");
  const sitemapUrl = `${base}/sitemap.xml`;
  const targets = [
    `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
    `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
  ];

  const results: string[] = [];
  for (const url of targets) {
    try {
      const response = await fetch(url, { method: "GET", cache: "no-store" });
      results.push(`${new URL(url).host}:${response.status}`);
    } catch (error) {
      results.push(`${new URL(url).host}:err`);
    }
  }

  await saveDiscoveryState({
    ...state,
    lastSitemapPingAt: new Date().toISOString(),
  });
  await appendJournal("Sitemap pinged", { sitemapUrl, results });
  return { ok: true, detail: `Sitemap ping ${results.join(" · ")}` };
}

/** Full zero-traffic attack: research internet → publish topic → ping sitemap. */
export async function runDiscoveryAttack(input?: {
  viewsLastHour?: number;
}): Promise<{ ok: boolean; detail: string }> {
  const research = await runInternetMarketResearch({
    viewsLastHour: input?.viewsLastHour ?? 0,
    force: false,
  });
  const publish = await publishIntentTopic({ force: false });
  const ping = await pingSitemap();
  const parts = [research.detail, publish.detail, ping.detail].filter(Boolean);
  return {
    ok: research.ok || publish.ok,
    detail: parts.join(" | ").slice(0, 480),
  };
}
