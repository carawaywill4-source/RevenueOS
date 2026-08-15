/**
 * FIX 8 — External surface discovery + policy intelligence.
 *
 * Turns "obtain_legitimate_audience_exposure" into candidate real-world
 * paths without hardcoding a platform. Surfaces that prohibit automation
 * are recorded as constraints, not attempted.
 */

import { createHash } from "node:crypto";
import type pg from "pg";
import type { Logger } from "../ultron-core/types.js";

const OWNED = new Set(["owned_domain", "owned", "portfolio", "owned_rss", ""]);

export type SurfacePolicy = {
  surfaceId: string;
  platform: string;
  url: string;
  automationAllowed: boolean | null;
  postingAllowed: boolean | null;
  policyClass:
    | "PERMITTED_PUBLISH"
    | "PERMITTED_READ"
    | "CONDITIONAL"
    | "PROHIBITED_AUTOMATION"
    | "UNKNOWN_NEEDS_RESEARCH"
    | "OWNED";
  reason: string;
};

function classifyPolicy(row: {
  platform: string;
  automation_allowed: unknown;
  posting_allowed: unknown;
  surface_url: string;
}): SurfacePolicy["policyClass"] {
  const plat = String(row.platform ?? "").toLowerCase();
  if (OWNED.has(plat) || /sslip\.io|owned/.test(String(row.surface_url ?? ""))) return "OWNED";
  // Search-index pings are not audience surfaces.
  if (/indexnow|bing|google|websub/.test(plat) || /indexnow\.org/.test(String(row.surface_url ?? ""))) {
    return "PROHIBITED_AUTOMATION";
  }
  const auto = row.automation_allowed;
  const post = row.posting_allowed;
  if (auto === false) return "PROHIBITED_AUTOMATION";
  if (post === true && auto === true) return "PERMITTED_PUBLISH";
  if (post === true && auto !== false) return "CONDITIONAL";
  if (auto === true && post !== false) return "PERMITTED_READ";
  return "UNKNOWN_NEEDS_RESEARCH";
}

export async function refreshExternalSurfaces(
  pool: pg.Pool,
  logger: Logger,
): Promise<{ surfaces: number; permittedPublish: number; prohibited: number; unknown: number; conditional: number }> {
  await pool.query(`
    create table if not exists ros_external_surfaces (
      surface_id text primary key,
      platform text not null,
      url text not null,
      automation_allowed boolean,
      posting_allowed boolean,
      policy_class text not null,
      reason text not null default '',
      last_researched_at timestamptz,
      updated_at timestamptz not null default now()
    )
  `);

  const rows = await pool.query(
    `select surface_url, platform, channel_family, automation_allowed, posting_allowed
       from aq_channel_surfaces
      where surface_url is not null
      limit 2000`,
  );

  let surfaces = 0;
  let permittedPublish = 0;
  let prohibited = 0;
  let unknown = 0;
  let conditional = 0;

  for (const r of rows.rows) {
    const url = String(r.surface_url);
    const platform = String(r.platform ?? r.channel_family ?? "unknown");
    const policyClass = classifyPolicy({
      platform,
      automation_allowed: r.automation_allowed,
      posting_allowed: r.posting_allowed,
      surface_url: url,
    });
    const id = `surf_${createHash("sha1").update(`${platform}|${url}`).digest("hex").slice(0, 16)}`;
    let reason = "from aq_channel_surfaces";
    if (policyClass === "OWNED") reason = "owned_or_portfolio_surface";
    if (policyClass === "PROHIBITED_AUTOMATION") reason = "automation_allowed=false";
    if (policyClass === "PERMITTED_PUBLISH") reason = "posting_allowed=true AND automation_allowed=true";
    if (policyClass === "CONDITIONAL") reason = "posting_allowed=true but automation not proven — account/policy research required";
    if (policyClass === "UNKNOWN_NEEDS_RESEARCH") reason = "posting/automation flags unset — must research actual rules before write";

    await pool.query(
      `insert into ros_external_surfaces
         (surface_id, platform, url, automation_allowed, posting_allowed, policy_class, reason, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7, now())
       on conflict (surface_id) do update set
         policy_class = excluded.policy_class,
         reason = excluded.reason,
         automation_allowed = excluded.automation_allowed,
         posting_allowed = excluded.posting_allowed,
         updated_at = now()`,
      [
        id,
        platform,
        url,
        r.automation_allowed ?? null,
        r.posting_allowed ?? null,
        policyClass,
        reason,
      ],
    );
    surfaces++;
    if (policyClass === "PERMITTED_PUBLISH") permittedPublish++;
    if (policyClass === "PROHIBITED_AUTOMATION") prohibited++;
    if (policyClass === "UNKNOWN_NEEDS_RESEARCH") unknown++;
    if (policyClass === "CONDITIONAL") conditional++;
  }

  const researched = await researchDiscoverWriteSurfaces(pool, logger).catch((e) => {
    logger("warn", "ultron.surfaces.research_failed", { e: String(e) });
    return { added: 0, classified: 0 };
  });

  logger("info", "ultron.surfaces.refresh", {
    surfaces,
    permittedPublish,
    prohibited,
    unknown,
    conditional,
    researched,
  });
  return { surfaces, permittedPublish, prohibited, unknown, conditional };
}

export async function permittedPublishSurfaces(pool: pg.Pool): Promise<SurfacePolicy[]> {
  const r = await pool.query(
    `select surface_id, platform, url, automation_allowed, posting_allowed, policy_class, reason
       from ros_external_surfaces
      where policy_class = 'PERMITTED_PUBLISH'
      order by updated_at desc
      limit 50`,
  );
  return r.rows.map((row) => ({
    surfaceId: String(row.surface_id),
    platform: String(row.platform),
    url: String(row.url),
    automationAllowed: row.automation_allowed,
    postingAllowed: row.posting_allowed,
    policyClass: "PERMITTED_PUBLISH",
    reason: String(row.reason),
  }));
}

export async function compileExposurePaths(
  pool: pg.Pool,
): Promise<{
  executable: boolean;
  paths: Array<{ platform: string; url: string; skills: string[] }>;
  blocker: string | null;
}> {
  const permitted = await permittedPublishSurfaces(pool);
  if (permitted.length > 0) {
    return {
      executable: true,
      paths: permitted.slice(0, 5).map((s) => ({
        platform: s.platform,
        url: s.url,
        skills: ["VERIFY_PUBLIC_ARTIFACT_EXISTS", "browser_open_page"],
      })),
      blocker: null,
    };
  }
  const unknown = await pool.query(
    `select count(*)::int as n from ros_external_surfaces where policy_class='UNKNOWN_NEEDS_RESEARCH'`,
  );
  const prohibited = await pool.query(
    `select count(*)::int as n from ros_external_surfaces where policy_class='PROHIBITED_AUTOMATION'`,
  );
  const conditional = await pool.query(
    `select count(*)::int as n from ros_external_surfaces where policy_class='CONDITIONAL'`,
  );
  return {
    executable: false,
    paths: [],
    blocker:
      `no PERMITTED_PUBLISH third-party surface (unknown=${unknown.rows[0]?.n ?? 0}, conditional=${conditional.rows[0]?.n ?? 0}, prohibited=${prohibited.rows[0]?.n ?? 0}). ` +
      `CONDITIONAL surfaces need account+policy proof before write; compiler will not invent a platform.`,
  };
}

const WRITE_SEARCHES = [
  "submit free software directory listing",
  "add product vendor directory submit listing",
  "public marketplace listing API documentation",
  "business listing submission no account required",
  "industry supplier directory add company",
  "submit tool to SaaS directory free listing",
  "B2B product discovery platform submit product",
  "freelance marketplace public profile API",
  "local business directory add listing form",
  "open professional community classifieds posting policy",
  "niche marketplace seller onboarding no paid ads",
  "public RFP bid board registration",
  "startup launch platform submit product guidelines",
  "industry association member directory submit company",
  "syndication feed submit resource directory",
];

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

async function fetchText(url: string, timeoutMs = 8_000): Promise<string> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": "RevenueOS-surface-research/1.0" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    return (await res.text()).slice(0, 80_000);
  } catch {
    return "";
  }
}

export async function researchSurfacePolicy(url: string): Promise<{
  policyClass: SurfacePolicy["policyClass"];
  reason: string;
  postingAllowed: boolean | null;
  automationAllowed: boolean | null;
}> {
  const host = hostOf(url);
  if (/sslip\.io|130\.131\.15\.68|localhost/.test(url)) {
    return { policyClass: "OWNED", reason: "owned_host", postingAllowed: true, automationAllowed: true };
  }
  if (/indexnow|bing\.com\/webmaster|google\.com\/webmasters|websub/.test(url + host)) {
    return {
      policyClass: "PROHIBITED_AUTOMATION",
      reason: "search_index_ping_not_audience",
      postingAllowed: false,
      automationAllowed: true,
    };
  }

  const robots = await fetchText(`https://${host}/robots.txt`, 5_000);
  if (/^user-agent:\s*\*\s*$/im.test(robots) && /disallow:\s*\/\s*$/im.test(robots)) {
    return {
      policyClass: "PROHIBITED_AUTOMATION",
      reason: "robots.txt disallows all",
      postingAllowed: false,
      automationAllowed: false,
    };
  }

  const html = (await fetchText(url)).toLowerCase();
  if (!html) {
    return {
      policyClass: "UNKNOWN_NEEDS_RESEARCH",
      reason: "fetch_failed",
      postingAllowed: null,
      automationAllowed: null,
    };
  }
  return classifyFetchedHtml(url, html);
}

export function extractCandidateSurfaceUrls(pageUrl: string, html: string): string[] {
  let origin = "";
  try {
    origin = new URL(pageUrl).origin;
  } catch {
    origin = "";
  }
  const found = new Set<string>();
  const re = /https?:\/\/[a-z0-9.-]+\.[a-z]{2,}[^"'\\\s<>]*/gi;
  for (const raw of html.match(re) ?? []) {
    try {
      const u = new URL(raw.replace(/[),.;]+$/, ""));
      if (origin && u.origin === origin) continue;
      const host = u.hostname.replace(/^www\./, "");
      if (
        /sslip\.io|facebook\.|twitter\.|x\.com|linkedin\.|google\.|youtube\.|wikipedia\.|cloudflare\.|schema\.org/.test(
          host,
        )
      ) {
        continue;
      }
      const blob = `${host}${u.pathname}`.toLowerCase();
      if (/submit|add-?(your-?)?(product|listing|company|tool)|get-listed|directory|launch/.test(blob)) {
        found.add(`${u.origin}${u.pathname.replace(/\/$/, "") || "/"}`);
      }
    } catch {
      /* ignore */
    }
  }
  return [...found].slice(0, 24);
}

export function isDirectoryIndexPage(url: string, html: string): boolean {
  const path = url.toLowerCase();
  if (/\/blog\/|\/articles\//.test(path)) return true;
  if (/directories-list|saas-directories|review-sites-and-directories|80-plus-list/.test(path)) {
    return true;
  }
  const hosts = new Set<string>();
  for (const m of html.match(/https?:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi) ?? []) {
    try {
      hosts.add(new URL(m).hostname.replace(/^www\./, ""));
    } catch {
      /* ignore */
    }
  }
  return hosts.size >= 10 && /directory|submit your|list of/.test(html);
}

export function classifyFetchedHtml(
  url: string,
  html: string,
): {
  policyClass: SurfacePolicy["policyClass"];
  reason: string;
  postingAllowed: boolean | null;
  automationAllowed: boolean | null;
} {
  const bansAutomation =
    /no\s+automated|automated\s+(posting|submissions)\s+not|bots?\s+not\s+allowed|captcha required/.test(html);
  const hasSubmit =
    /submit(\s+your)?\s+(listing|product|tool|startup)|add\s+(your\s+)?(product|listing|company)|list\s+your\s+(product|software)/.test(
      html,
    );
  const noAccount =
    /no\s+account\s+required|without\s+(an?\s+)?account|anonymous\s+submit/.test(html);
  const apiWrite = /public\s+api/.test(html) && /post|create\s+listing|submit/.test(html);
  const tosBan = /prohibits?\s+automation|scraping\s+prohibited|no\s+bots/.test(html);

  if (bansAutomation || tosBan) {
    return {
      policyClass: "PROHIBITED_AUTOMATION",
      reason: "page_or_tos_bans_automation",
      postingAllowed: hasSubmit,
      automationAllowed: false,
    };
  }
  if (isDirectoryIndexPage(url, html)) {
    return {
      policyClass: "PERMITTED_READ",
      reason: "directory_index_page_not_a_write_surface",
      postingAllowed: false,
      automationAllowed: true,
    };
  }
  if (apiWrite && noAccount && hasSubmit) {
    return {
      policyClass: "PERMITTED_PUBLISH",
      reason: "public_submit_and_api_language_no_account",
      postingAllowed: true,
      automationAllowed: true,
    };
  }
  if (hasSubmit && noAccount) {
    return {
      policyClass: "PERMITTED_PUBLISH",
      reason: "public_submit_no_account_required",
      postingAllowed: true,
      automationAllowed: true,
    };
  }
  if (hasSubmit) {
    return {
      policyClass: "CONDITIONAL",
      reason: "public_submit_form_detected_account_or_policy_unproven",
      postingAllowed: true,
      automationAllowed: null,
    };
  }
  return {
    policyClass: "UNKNOWN_NEEDS_RESEARCH",
    reason: "no_submit_affordance_found",
    postingAllowed: null,
    automationAllowed: null,
  };
}

export async function surfaceCensus(pool: pg.Pool): Promise<{
  permitted: number;
  conditional: number;
  unknown: number;
  prohibited: number;
  owned: number;
  total: number;
}> {
  const r = await pool.query(
    `select policy_class, count(*)::int as n from ros_external_surfaces group by 1`,
  );
  const counts: Record<string, number> = {};
  for (const row of r.rows) counts[String(row.policy_class)] = Number(row.n);
  return {
    permitted: counts.PERMITTED_PUBLISH ?? 0,
    conditional: counts.CONDITIONAL ?? 0,
    unknown: counts.UNKNOWN_NEEDS_RESEARCH ?? 0,
    prohibited: counts.PROHIBITED_AUTOMATION ?? 0,
    owned: counts.OWNED ?? 0,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
  };
}

export async function researchDiscoverWriteSurfaces(
  pool: pg.Pool,
  logger: Logger,
): Promise<{ added: number; classified: number }> {
  let added = 0;
  let classified = 0;
  const permittedN = await pool.query(
    `select count(*)::int as n from ros_external_surfaces where policy_class='PERMITTED_PUBLISH'`,
  );
  const lastDdg = await pool.query(
    `select max(updated_at) as t from ros_external_surfaces where reason like 'ddg:%'`,
  );
  const lastDdgMs = lastDdg.rows[0]?.t ? new Date(lastDdg.rows[0].t).getTime() : 0;
  const skipDiscovery =
    Number(permittedN.rows[0]?.n ?? 0) > 0 &&
    Boolean(lastDdgMs && Date.now() - lastDdgMs < 4 * 60 * 60_000);
  try {
    if (!skipDiscovery) {
    const { searchDuckDuckGo } = await import("../titan-research-engine.js");
    for (const q of WRITE_SEARCHES.slice(0, 8)) {
      const hits = await searchDuckDuckGo(q, 4);
      for (const hit of hits) {
        const url = hit.url;
        if (!/^https?:\/\//i.test(url)) continue;
        const researched = await researchSurfacePolicy(url);
        const platform = hostOf(url);
        const id = `surf_${createHash("sha1").update(`${platform}|${url}`).digest("hex").slice(0, 16)}`;
        await pool.query(
          `insert into ros_external_surfaces
             (surface_id, platform, url, automation_allowed, posting_allowed, policy_class, reason, last_researched_at, updated_at)
           values ($1,$2,$3,$4,$5,$6,$7, now(), now())
           on conflict (surface_id) do update set
             policy_class = excluded.policy_class,
             reason = excluded.reason,
             automation_allowed = excluded.automation_allowed,
             posting_allowed = excluded.posting_allowed,
             last_researched_at = now(),
             updated_at = now()`,
          [
            id,
            platform,
            url,
            researched.automationAllowed,
            researched.postingAllowed,
            researched.policyClass,
            `ddg:${q} | ${researched.reason}`,
          ],
        );
        added++;
        classified++;
      }
    }
    } else {
      logger("info", "ultron.surfaces.discovery_skipped_fresh", {});
    }
  } catch (e) {
    logger("warn", "ultron.surfaces.ddg_failed", { e: String(e) });
  }

  const unknowns = await pool.query(
    `select surface_id, url, platform from ros_external_surfaces
      where policy_class in ('UNKNOWN_NEEDS_RESEARCH','CONDITIONAL','PERMITTED_READ')
        and url not ilike '%sslip.io%'
      order by last_researched_at asc nulls first, updated_at asc
      limit 12`,
  );
  for (const row of unknowns.rows) {
    const pageUrl = String(row.url);
    const html = await fetchText(pageUrl);
    const researched = html
      ? classifyFetchedHtml(pageUrl, html.toLowerCase())
      : await researchSurfacePolicy(pageUrl);
    await pool.query(
      `update ros_external_surfaces
          set policy_class = $2, reason = $3, posting_allowed = $4, automation_allowed = $5,
              last_researched_at = now(), updated_at = now()
        where surface_id = $1`,
      [row.surface_id, researched.policyClass, researched.reason, researched.postingAllowed, researched.automationAllowed],
    );
    classified++;
    if (html && (researched.policyClass === "PERMITTED_READ" || researched.policyClass === "CONDITIONAL")) {
      for (const extracted of extractCandidateSurfaceUrls(pageUrl, html)) {
        const platform = hostOf(extracted);
        const id = `surf_${createHash("sha1").update(`${platform}|${extracted}`).digest("hex").slice(0, 16)}`;
        const ins = await pool.query(
          `insert into ros_external_surfaces
             (surface_id, platform, url, automation_allowed, posting_allowed, policy_class, reason, last_researched_at, updated_at)
           values ($1,$2,$3,null,null,'UNKNOWN_NEEDS_RESEARCH',$4, null, now())
           on conflict (surface_id) do nothing`,
          [id, platform, extracted, `extracted_from:${pageUrl.slice(0, 80)}`],
        );
        added += ins.rowCount ?? 0;
      }
    }
  }

  logger("info", "ultron.surfaces.research", { added, classified, skipDiscovery });
  return { added, classified };
}
