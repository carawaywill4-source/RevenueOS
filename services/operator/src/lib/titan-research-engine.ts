/**
 * Titan zero-cost internet research engine.
 *
 * Uses DuckDuckGo HTML + direct HTTP retrieval.
 * PAID_AI is never required.
 *
 * Security: all web content classified via classifyExternalContent —
 * WEB CONTENT = EVIDENCE, never CONTROL.
 */

import { classifyExternalContent } from "@revenueos/core";
import type pg from "pg";
import {
  corroborateSimilarClaims,
  finishResearchRun,
  insertClaim,
  insertDocument,
  startResearchRun,
  upsertSource,
  type SourceType,
} from "./titan-world-store.js";

export const TITAN_RESEARCH_VERSION = "titan-research-engine-v1";

export type ResearchBudget = {
  maxSearches: number;
  maxPages: number;
  maxMs: number;
};

const DEFAULT_BUDGET: ResearchBudget = {
  maxSearches: 3,
  maxPages: 6,
  maxMs: 25_000,
};

export type SearchHit = { url: string; title: string; snippet: string };

const SEARCH_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function decodeBingDestination(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("a1")) s = s.slice(2);
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const tryDecode = (alphabet: string) => {
    try {
      const t = Buffer.from(alphabet + pad, "base64").toString("utf8");
      return /^https?:\/\//i.test(t) ? t : "";
    } catch {
      return "";
    }
  };
  return (
    tryDecode(s) ||
    tryDecode(s.replace(/-/g, "+").replace(/_/g, "/"))
  );
}

function citeToUrl(cite: string): string {
  const cleaned = cite
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/›/g, "/")
    .replace(/\s+/g, "")
    .trim();
  if (/^https?:\/\//i.test(cleaned)) return cleaned.split("?")[0]!;
  if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(cleaned)) return `https://${cleaned.split("?")[0]}`;
  return "";
}

export function parseBingHits(html: string, limit = 8): SearchHit[] {
  const hits: SearchHit[] = [];
  const seen = new Set<string>();
  const add = (url: string, title = "") => {
    if (!/^https?:\/\//i.test(url)) return;
    if (/bing\.com|microsoft\.com|msn\.com|duckduckgo\.com/i.test(url)) return;
    const key = url.replace(/\/$/, "");
    if (seen.has(key) || hits.length >= limit) return;
    seen.add(key);
    hits.push({ url, title: title.slice(0, 180), snippet: "" });
  };
  const uParams = html.matchAll(/[?&](?:amp;)?u=([A-Za-z0-9_-]+)/g);
  for (const m of uParams) {
    add(decodeBingDestination(m[1]!));
    if (hits.length >= limit) return hits;
  }
  const cites = html.matchAll(/<cite[^>]*>([\s\S]*?)<\/cite>/gi);
  for (const m of cites) {
    add(citeToUrl(m[1] ?? ""));
    if (hits.length >= limit) return hits;
  }
  return hits;
}

export function parseBraveHits(html: string, limit = 8): SearchHit[] {
  const hits: SearchHit[] = [];
  const seen = new Set<string>();
  const re = /<a[^>]+href="(https?:\/\/[^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && hits.length < limit) {
    const url = (m[1] ?? "").split("?")[0]!;
    if (
      /brave\.com|cdn\.brave|duckduckgo\.com|google\.com\/|facebook\.com|twitter\.com|x\.com|youtube\.com|instagram\.com/i.test(
        url,
      )
    ) {
      continue;
    }
    const host = (() => {
      try {
        return new URL(url).hostname.replace(/^www\./, "");
      } catch {
        return url;
      }
    })();
    if (seen.has(host)) continue;
    seen.add(host);
    hits.push({ url, title: "", snippet: "" });
  }
  return hits;
}

export function parseDuckDuckGoHits(html: string, limit = 8): SearchHit[] {
  const hits: SearchHit[] = [];
  const re =
    /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && hits.length < limit) {
    let href = m[1] ?? "";
    const uddg = /uddg=([^&]+)/.exec(href);
    if (uddg) {
      try {
        href = decodeURIComponent(uddg[1]!);
      } catch {
        /* keep */
      }
    }
    if (!/^https?:\/\//i.test(href) || /duckduckgo\.com/i.test(href)) continue;
    hits.push({
      url: href,
      title: stripHtml(m[2] ?? "").slice(0, 180),
      snippet: "",
    });
  }
  return hits;
}

async function fetchSearchHtml(
  url: string,
  timeoutMs: number,
): Promise<string> {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "user-agent": SEARCH_UA,
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return "";
    return (await res.text()).slice(0, 400_000);
  } catch {
    return "";
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function classifySourceType(url: string): SourceType {
  const u = url.toLowerCase();
  if (/\.gov(\.|\/|$)/.test(u)) return "GOVERNMENT";
  if (/wikipedia\.org|docs\.|developer\./.test(u)) return "DOCUMENTATION";
  if (/reddit\.com|news\.ycombinator|forum|community|discourse/.test(u))
    return "FORUM_COMMUNITY";
  if (/g2\.com|capterra|trustpilot|producthunt|review/.test(u))
    return "CUSTOMER_REVIEW";
  if (/nytimes|bloomberg|techcrunch|forbes|reuters|wsj|industry/.test(u))
    return "NEWS_INDUSTRY";
  if (/directory|alternativeto|saasworthy|getapp/.test(u)) return "DIRECTORY";
  return "OTHER";
}

function qualityFor(type: SourceType): string {
  switch (type) {
    case "GOVERNMENT":
    case "ACADEMIC":
      return "HIGH";
    case "OFFICIAL_COMPANY":
    case "DOCUMENTATION":
      return "MEDIUM_HIGH";
    case "CUSTOMER_REVIEW":
    case "FORUM_COMMUNITY":
      return "MEDIUM";
    default:
      return "LOW_MEDIUM";
  }
}

async function fetchText(
  url: string,
  timeoutMs = 8_000,
): Promise<{ ok: boolean; status: number; text: string; finalUrl: string }> {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "user-agent":
          "RevenueOSTitanResearch/1.0 (+commercial-intelligence; respectful)",
        accept: "text/html,application/xhtml+xml,text/plain",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      text: text.slice(0, 200_000),
      finalUrl: res.url || url,
    };
  } catch {
    return { ok: false, status: 0, text: "", finalUrl: url };
  }
}

/**
 * Open-web search. DuckDuckGo HTML often times out from cloud VMs;
 * Bing and Brave are tried first so acquisition is not starved of pages.
 */
export async function searchDuckDuckGo(
  query: string,
  limit = 5,
): Promise<SearchHit[]> {
  return searchWeb(query, limit);
}

export async function searchWeb(
  query: string,
  limit = 8,
): Promise<SearchHit[]> {
  const q = encodeURIComponent(query);
  const bing = parseBingHits(
    await fetchSearchHtml(`https://www.bing.com/search?q=${q}`, 8_000),
    limit,
  );
  if (bing.length) return bing;
  const brave = parseBraveHits(
    await fetchSearchHtml(`https://search.brave.com/search?q=${q}`, 8_000),
    limit,
  );
  if (brave.length) return brave;
  const ddg = parseDuckDuckGoHits(
    await fetchSearchHtml(
      `https://html.duckduckgo.com/html/?q=${q}`,
      4_000,
    ),
    limit,
  );
  return ddg;
}

function extractClaimsFromPage(input: {
  text: string;
  url: string;
  topic: string;
  businessId?: string;
}): Array<{ claim: string; relevance: string }> {
  const text = input.text.slice(0, 12_000);
  const out: Array<{ claim: string; relevance: string }> = [];
  const price = text.match(
    /(?:\$|USD\s*)(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:\/\s*(?:mo|month|yr|year))?/gi,
  );
  if (price?.[0]) {
    out.push({
      claim: `Observed price signal near topic: ${price[0]} (source page)`,
      relevance: "pricing",
    });
  }
  const intent =
    text.match(
      /\b(looking for|need a|recommend|alternative to|how (?:do|can) I|best way to|pricing for|vs\.?|compared to)\b[^.?!]{10,120}[.?!]/gi,
    ) ?? [];
  for (const phrase of intent.slice(0, 3)) {
    out.push({
      claim: `Customer/intent language: "${phrase.trim()}"`,
      relevance: "customer_language",
    });
  }
  const complaint =
    text.match(
      /\b(frustrated|hate|broken|expensive|confusing|slow|manual|waste(?:s|d)? time)\b[^.?!]{8,100}[.?!]/gi,
    ) ?? [];
  for (const phrase of complaint.slice(0, 2)) {
    out.push({
      claim: `Pain/objection signal: "${phrase.trim()}"`,
      relevance: "objections",
    });
  }
  if (out.length === 0 && text.length > 200) {
    out.push({
      claim: `Page discusses ${input.topic}; title/body contains related commercial context.`,
      relevance: "market_context",
    });
  }
  return out.slice(0, 5);
}

export type ResearchResult = {
  runId: string;
  ok: boolean;
  question: string;
  sourcesInspected: number;
  usefulSources: number;
  claimIds: string[];
  claims: Array<{ id: string; claim: string; status: string; url?: string }>;
  summary: string;
  knowledgeGapsRemaining: string[];
  decisionRelevantFacts: string[];
};

/**
 * Full research cycle for a commercial question.
 * Bounded by budget; never blocks forever.
 */
export async function runTitanResearch(input: {
  pool: pg.Pool;
  question: string;
  businessId?: string;
  purpose: string;
  queries: string[];
  budget?: Partial<ResearchBudget>;
  logger?: (
    level: "info" | "warn" | "error",
    event: string,
    meta?: Record<string, unknown>,
  ) => void;
}): Promise<ResearchResult> {
  const budget = { ...DEFAULT_BUDGET, ...input.budget };
  const started = Date.now();
  const runId = await startResearchRun(input.pool, {
    question: input.question,
    businessId: input.businessId,
    purpose: input.purpose,
    plan: { queries: input.queries, budget, version: TITAN_RESEARCH_VERSION },
  });

  let sourcesInspected = 0;
  let usefulSources = 0;
  const claimIds: string[] = [];
  const claims: ResearchResult["claims"] = [];
  const facts: string[] = [];
  const seenUrls = new Set<string>();

  try {
    let searches = 0;
    for (const q of input.queries) {
      if (searches >= budget.maxSearches) break;
      if (Date.now() - started > budget.maxMs) break;
      searches += 1;
      const hits = await searchDuckDuckGo(q, 5);
      input.logger?.("info", "titan.research.search", {
        query: q,
        hits: hits.length,
        runId,
      });

      for (const hit of hits) {
        if (sourcesInspected >= budget.maxPages) break;
        if (Date.now() - started > budget.maxMs) break;
        if (seenUrls.has(hit.url)) continue;
        seenUrls.add(hit.url);
        sourcesInspected += 1;

        const page = await fetchText(hit.url, 8_000);
        const raw = page.ok ? stripHtml(page.text) : hit.snippet;
        if (!raw || raw.length < 40) continue;

        const safety = classifyExternalContent(raw.slice(0, 8000));
        const sourceType = classifySourceType(hit.url);
        const sourceId = await upsertSource(input.pool, {
          url: hit.url,
          title: hit.title,
          sourceType,
          qualityTier: qualityFor(sourceType),
          trustNotes: safety.contains_injection_attempt
            ? "injection_patterns_flagged"
            : undefined,
        });
        await insertDocument(input.pool, {
          sourceId,
          url: hit.url,
          title: hit.title,
          contentText: raw,
          injectionFlagged: safety.contains_injection_attempt,
        });

        if (!safety.safe_to_inform_beliefs) {
          input.logger?.("warn", "titan.research.injection_discarded", {
            url: hit.url,
            signals: safety.signals,
          });
          continue;
        }

        usefulSources += 1;
        const extracted = extractClaimsFromPage({
          text: raw,
          url: hit.url,
          topic: input.question,
          businessId: input.businessId,
        });
        for (const ex of extracted) {
          const corr = await corroborateSimilarClaims(
            input.pool,
            input.question.slice(0, 80),
            ex.claim,
          );
          const cid = await insertClaim(input.pool, {
            topic: input.question.slice(0, 120),
            claim: ex.claim,
            entities: input.businessId ? [input.businessId] : [],
            sourceId,
            sourceUrl: hit.url,
            sourceType,
            confidence:
              corr.status === "CORROBORATED"
                ? 0.75
                : corr.status === "SINGLE_SOURCE"
                  ? 0.55
                  : 0.4,
            freshness:
              ex.relevance === "pricing" ? "SHORT" : "MEDIUM",
            affectedBusinesses: input.businessId ? [input.businessId] : [],
            commercialRelevance: ex.relevance,
            status: corr.status,
          });
          claimIds.push(cid);
          claims.push({
            id: cid,
            claim: ex.claim,
            status: corr.status,
            url: hit.url,
          });
          facts.push(ex.claim);
        }
      }
    }

    const gaps: string[] = [];
    if (usefulSources < 2) gaps.push("insufficient_independent_sources");
    if (!facts.some((f) => /price|\$/i.test(f)))
      gaps.push("pricing_evidence_thin");
    if (!facts.some((f) => /Customer\/intent|Pain\/objection/i.test(f)))
      gaps.push("customer_language_thin");

    const summary =
      usefulSources === 0
        ? `Research completed with no useful sources for: ${input.question}`
        : `Inspected ${sourcesInspected} sources (${usefulSources} useful); stored ${claimIds.length} claims. Top facts: ${facts
            .slice(0, 3)
            .join(" | ")}`;

    await finishResearchRun(input.pool, runId, {
      status:
        Date.now() - started > budget.maxMs ? "BUDGET_STOPPED" : "COMPLETED",
      sourcesInspected,
      usefulSources,
      claimsCreated: claimIds.length,
      resultSummary: summary,
      meta: { version: TITAN_RESEARCH_VERSION, gaps },
    });

    return {
      runId,
      ok: usefulSources > 0,
      question: input.question,
      sourcesInspected,
      usefulSources,
      claimIds,
      claims,
      summary,
      knowledgeGapsRemaining: gaps,
      decisionRelevantFacts: facts.slice(0, 12),
    };
  } catch (err) {
    await finishResearchRun(input.pool, runId, {
      status: "FAILED",
      sourcesInspected,
      usefulSources,
      claimsCreated: claimIds.length,
      resultSummary: err instanceof Error ? err.message : String(err),
    });
    return {
      runId,
      ok: false,
      question: input.question,
      sourcesInspected,
      usefulSources,
      claimIds,
      claims,
      summary: "research_failed",
      knowledgeGapsRemaining: ["research_failed"],
      decisionRelevantFacts: [],
    };
  }
}
