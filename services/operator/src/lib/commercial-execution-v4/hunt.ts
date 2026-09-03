/**
 * Volume hunter. One tick cannot search the whole internet.
 * The hunt cursor never parks after four emails — every cycle takes
 * the next queries, fetches pages, stores contacts, and finds new submit URLs.
 */

import { createHash } from "node:crypto";
import type pg from "pg";
import { searchWeb } from "../titan-research-engine.js";
import { ensureCommercialExecutionSchema } from "./schema.js";
import {
  extractPublicEmails,
  persistContacts,
  type HarvestedContact,
} from "./contacts.js";
import type { ListingPayload } from "./directory.js";
import { nextChannelDiscoveryQueries } from "./channel-universe.js";

export const EMAIL_BURST = 8;
export const DAILY_EMAIL_CAP = 140;
export const HUNT_QUERIES_PER_TICK = 4;
export const HUNT_PAGES_PER_TICK = 6;

const SKIP_CONTACT_HOST =
  /sslip\.io|duckduckgo|bing\.com|brave\.com|facebook|linkedin|youtube|instagram|tiktok|x\.com|twitter|pinterest|comodo\.com|datacaptive|bookyourdata|dmdatabases|galileodata|spherescout|hunter\.io|apollo\.io|zoominfo|rocketreach|lusha|seamless\.ai|scrap\.io|lead411|uplead|emaillist|mailing-list|email-list/i;

const SKIP_CHANNEL_HOST =
  /sslip\.io|duckduckgo|bing\.com|brave\.com|facebook|linkedin|youtube|instagram|tiktok|x\.com|twitter|pinterest|datacaptive|bookyourdata|zoominfo|apollo\.io|hunter\.io|emaillist|mailing-list|email-list/i;

const SUBMIT_QUERY =
  /\bsubmit\b|saas directory|startup directory|add product|add-tool|launching next|futurepedia|devhunt|uneed\.best|tiny launch/i;

export const HUNT_QUERY_BANK: string[] = [
  "general contractor contact us",
  "construction project manager contact",
  "construction superintendent email",
  "punch list construction blog contact",
  "RFI log construction template contact",
  "jobsite operations manager contact",
  "AGC chapter contact us",
  "NAHB local association contact",
  "construction dive contact",
  "write for us construction",
  "contractor newsletter editor email",
  "remodeling contractor hello@",
  "commercial GC \"contact us\"",
  "project engineer construction contact",
  "construction software review blog contact",
  "field engineer punch list contact",
  "general contractor mailto",
  "remodeling company \"contact@\"",
  "construction estimator contact email",
  "jobsite superintendent \"contact us\"",
  "construction association staff directory email",
  "GC operations manager hello@",
  "punch list app blog \"contact us\"",
  "construction PM newsletter contact",
  "invoice freelancer contact",
  "small business bookkeeper contact",
  "accounts receivable consultant email",
  "property manager contact us",
  "vacation rental operator contact email",
  "resume writer blog contact",
  "career coach contact email",
  "moving company operations contact",
  "electrical contractor contact us",
  "plumbing contractor \"contact us\"",
  "roofing contractor contact email",
  "HVAC contractor hello@",
  "commercial painter contact us",
  "site superintendent email contact",
  "construction template pack contact",
  "contractor paperwork kit contact",
  "punch list spreadsheet contact",
];

const GEO_CITIES = [
  "Denver",
  "Austin",
  "Dallas",
  "Phoenix",
  "Houston",
  "Nashville",
  "Charlotte",
  "Tampa",
  "Columbus",
  "Kansas City",
  "Boise",
  "Salt Lake City",
  "Atlanta",
  "Chicago",
  "Indianapolis",
  "Louisville",
  "Oklahoma City",
  "Omaha",
  "Portland",
  "Sacramento",
  "San Antonio",
  "Seattle",
  "Raleigh",
  "Minneapolis",
  "Milwaukee",
  "Richmond",
  "Memphis",
  "Birmingham",
  "Tucson",
  "Albuquerque",
  "Las Vegas",
  "Jacksonville",
  "Orlando",
  "Pittsburgh",
  "Cincinnati",
  "St. Louis",
];
const GEO_TRADES = [
  "general contractor",
  "roofing contractor",
  "HVAC contractor",
  "electrical contractor",
  "remodeling contractor",
];

export function geoContactQueries(): string[] {
  const out: string[] = [];
  for (const city of GEO_CITIES) {
    for (const trade of GEO_TRADES) {
      out.push(`${city} ${trade} contact us`);
    }
  }
  return out;
}

export function contactSearchQueries(listing: ListingPayload): string[] {
  const name = listing.name.toLowerCase();
  const kws = (listing.intentKeywords ?? []).filter(
    (k) => k && !k.toLowerCase().includes(name) && !/^[a-z0-9-]{0,24}$/i.test(k),
  );
  const job = kws[0] || listing.category;
  return [
    ...kws.slice(0, 4).map((k) => `${k} contact`),
    `${job} "contact us"`,
    `${job} editor email`,
    `${job} project manager contact`,
    `${job} mailto`,
  ];
}

export function nextHuntQueries(
  cursor: number,
  listing: ListingPayload,
  n = HUNT_QUERIES_PER_TICK,
): { queries: string[]; nextCursor: number } {
  const bank = [
    ...HUNT_QUERY_BANK,
    ...geoContactQueries(),
    ...contactSearchQueries(listing),
  ].filter((q) => !SUBMIT_QUERY.test(q));
  const queries: string[] = [];
  let i = cursor;
  for (let k = 0; k < n; k++) {
    queries.push(bank[i % bank.length]!);
    i += 1;
  }
  return { queries, nextCursor: i };
}

async function fetchHtml(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        accept: "text/html",
      },
      signal: AbortSignal.timeout(4_000),
    });
    if (!res.ok) return "";
    return (await res.text()).slice(0, 100_000);
  } catch {
    return "";
  }
}

function contactUrlScore(url: string): number {
  return /contact|about|team|advertise|write-for|staff|mailto/i.test(url) ? 1 : 0;
}

async function fetchHtmlMany(
  urls: string[],
): Promise<Array<{ url: string; html: string }>> {
  const out: Array<{ url: string; html: string }> = [];
  for (let i = 0; i < urls.length; i += 4) {
    const chunk = urls.slice(i, i + 4);
    const rows = await Promise.all(
      chunk.map(async (url) => ({ url, html: await fetchHtml(url) })),
    );
    out.push(...rows);
  }
  return out;
}

export function contactDoorUrls(pageUrl: string): string[] {
  try {
    const origin = new URL(pageUrl).origin;
    return [
      `${origin}/contact`,
      `${origin}/contact-us`,
      `${origin}/about`,
      `${origin}/advertise`,
      `${origin}/write-for-us`,
    ].filter((u) => u !== pageUrl);
  } catch {
    return [];
  }
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

async function harvestedHosts(pool: pg.Pool): Promise<Set<string>> {
  const r = await pool.query(`select source_url from ros_commercial_contacts`);
  const hosts = new Set<string>();
  for (const row of r.rows as Array<{ source_url?: string }>) {
    const host = hostOf(row.source_url ?? "");
    if (host) hosts.add(host);
  }
  return hosts;
}

export async function huntInternetContacts(
  pool: pg.Pool,
  businessId: string,
  listing: ListingPayload,
): Promise<{ pages: number; stored: number; harvested: number; queries: string[]; engineCursor: number }> {
  await ensureCommercialExecutionSchema(pool);
  const cur = await pool.query(
    `select query_index from ros_hunt_cursor where id='web'`,
  );
  const cursor = Number(cur.rows[0]?.query_index ?? 0);
  const { queries, nextCursor } = nextHuntQueries(cursor, listing);
  const seenHosts = await harvestedHosts(pool);
  const urls = new Set<string>();
  for (const q of queries) {
    const hits = await searchWeb(q, 8).catch(() => []);
    for (const h of hits) {
      if (!h.url || SKIP_CONTACT_HOST.test(h.url)) continue;
      const host = hostOf(h.url);
      if (!host || seenHosts.has(host)) continue;
      urls.add(h.url);
      if (urls.size >= 16) break;
    }
    if (urls.size >= 16) break;
  }

  const ranked = [...urls].sort((a, b) => contactUrlScore(b) - contactUrlScore(a));
  const toFetch = ranked.slice(0, HUNT_PAGES_PER_TICK);
  const extra: string[] = [];
  for (const url of toFetch.slice(0, 4)) {
    extra.push(...contactDoorUrls(url).slice(0, 2));
  }
  const pages = [...toFetch, ...extra].slice(0, HUNT_PAGES_PER_TICK + 4);

  let stored = 0;
  let fetched = 0;
  const harvested: HarvestedContact[] = [];
  const htmls = await fetchHtmlMany(pages);
  for (const { url, html } of htmls) {
    if (!html) continue;
    fetched += 1;
    harvested.push(...extractPublicEmails(html, url));
  }
  stored = await persistContacts(pool, businessId, harvested);

  await pool.query(
    `insert into ros_hunt_cursor (id, query_index, pages_fetched, contacts_stored, last_engine, updated_at)
     values ('web', $1, $2, $3, 'bing_brave', now())
     on conflict (id) do update set
       query_index=$1,
       pages_fetched=ros_hunt_cursor.pages_fetched+$2,
       contacts_stored=ros_hunt_cursor.contacts_stored+$3,
       last_engine='bing_brave',
       updated_at=now()`,
    [nextCursor, fetched, stored],
  );
  return { pages: fetched, stored, harvested: harvested.length, queries, engineCursor: nextCursor };
}

export async function huntSubmitSurfaces(
  pool: pg.Pool,
  listing: ListingPayload,
): Promise<{ seeded: number; queries: string[] }> {
  const cur = await pool.query(`select query_index from ros_hunt_cursor where id='channels'`);
  const cursor = Number(cur.rows[0]?.query_index ?? 0);
  const extra = listing.intentKeywords?.[0]
    ? [`submit ${listing.intentKeywords[0]} free directory`]
    : [];
  const walked = nextChannelDiscoveryQueries(cursor, 4);
  const queries = [...extra, ...walked.queries];
  let seeded = 0;
  for (const q of queries) {
    const hits = await searchWeb(q, 8).catch(() => []);
    for (const h of hits) {
      if (!h.url || SKIP_CHANNEL_HOST.test(h.url)) continue;
      const looksChannel =
        /submit|add-product|add-tool|new-product|contribute|list-your|signup|sign-up|register|\/add\/|directory|tools|launch|startup/i.test(
          `${h.url} ${h.title}`,
        );
      if (!looksChannel) continue;
      try {
        const platform = new URL(h.url).hostname.replace(/^www\./, "");
        const id = `surf_${createHash("sha1").update(`${platform}|${h.url}`).digest("hex").slice(0, 16)}`;
        const r = await pool.query(
          `insert into ros_external_surfaces
             (surface_id, platform, url, automation_allowed, posting_allowed, policy_class, reason, updated_at)
           values ($1,$2,$3,null,null,'UNKNOWN_NEEDS_RESEARCH','cee_v46_web_hunt', now())
           on conflict (surface_id) do nothing`,
          [id, platform, h.url],
        );
        seeded += r.rowCount ?? 0;
      } catch {
        /* skip */
      }
    }
  }
  await pool.query(
    `insert into ros_hunt_cursor (id, query_index, pages_fetched, contacts_stored, last_engine, updated_at)
     values ('channels', $1, $2, 0, 'bing_brave', now())
     on conflict (id) do update set
       query_index=$1,
       pages_fetched=ros_hunt_cursor.pages_fetched+$2,
       last_engine='bing_brave',
       updated_at=now()`,
    [walked.nextCursor, seeded],
  );
  return { seeded, queries };
}

export async function emailsSentLast24h(pool: pg.Pool): Promise<number> {
  const r = await pool.query(
    `select count(*)::int as n from ros_commercial_actions
      where action_type = 'email_send'
        and executed=true
        and created_at > now() - interval '24 hours'`,
  );
  return Number(r.rows[0]?.n ?? 0);
}
