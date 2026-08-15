/**
 * Compliance guard for external HTTP execution.
 *
 * RevenueOS is aggressive but must not violate host policies or crawler rules.
 * Before an executor performs any real external HTTP contact (form POST,
 * outreach ping, comment submission, index submission), this module checks:
 *
 *   1. robots.txt — respect Disallow for the intended path.
 *   2. /.well-known/policies — if present and JSON, look for a machine-readable
 *      `disallow` or `allow` list.
 *   3. /terms — human-readable; scanned for hard-block phrases that any
 *      reasonable operator would honor ("no automated", "no scraping",
 *      "prohibited", etc.). This is intentionally conservative — a positive
 *      match blocks the action.
 *
 * The result is a { allowed, reasons } tuple. Reasons are always populated so
 * the caller can log or escalate. Network failures fail-safe (allowed=true)
 * only for GET-shaped exposure actions; write-shaped actions default to
 * allowed=false when the policy documents cannot be fetched.
 */

export type ComplianceAction =
  | "http_get"
  | "http_post"
  | "http_put"
  | "http_delete"
  | "form_submit"
  | "outreach";

export type ComplianceInput = {
  targetUrl: string;
  action: ComplianceAction;
  message?: string;
  /**
   * User agent RevenueOS presents. If omitted, defaults to the RevenueOS
   * canonical agent so robots.txt authors can allow/deny explicitly.
   */
  userAgent?: string;
  /** Injected fetch (mainly for tests). Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Timeout for each policy fetch. Default 3s. */
  timeoutMs?: number;
};

export type ComplianceVerdict = {
  allowed: boolean;
  reasons: string[];
  robots?: { fetched: boolean; matched: boolean; rule?: string };
  policies?: { fetched: boolean; allowed?: boolean };
  terms?: { fetched: boolean; blocked: boolean; matchedPhrase?: string };
};

const DEFAULT_AGENT = "RevenueOSBot/1.0";
const HARD_BLOCK_PHRASES = [
  "no automated",
  "no automation",
  "no scraping",
  "no crawling",
  "prohibited",
  "not permitted to automate",
  "must not use bots",
  "may not use bots",
  "may not use automated",
  "unauthorized use",
  "unauthorized access",
];
const WRITE_ACTIONS = new Set<ComplianceAction>([
  "http_post",
  "http_put",
  "http_delete",
  "form_submit",
  "outreach",
]);

function baseUrl(u: string): URL | null {
  try {
    return new URL(u);
  } catch {
    return null;
  }
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  ms: number,
  userAgent: string,
): Promise<{ ok: boolean; status: number; text: string } | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetchImpl(url, {
      method: "GET",
      headers: { "User-Agent": userAgent, Accept: "text/plain, */*" },
      signal: ctrl.signal,
    });
    const text = await res.text().catch(() => "");
    return { ok: res.ok, status: res.status, text };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Parse robots.txt lightly. Not a full RFC implementation — we only need to
 * match `Disallow:` rules for either `*` or our declared UA and check them
 * against the target pathname.
 */
export function robotsDisallows(input: {
  robotsTxt: string;
  userAgent: string;
  pathname: string;
}): { blocked: boolean; rule?: string } {
  const ua = input.userAgent.toLowerCase();
  const lines = input.robotsTxt.split(/\r?\n/);
  let currentAgents: string[] = [];
  let applies = false;
  const rules: Array<{ agent: string; disallow: string }> = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const [rawKey, ...rest] = line.split(":");
    if (!rawKey) continue;
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") {
      if (!applies) currentAgents = [];
      currentAgents.push(value.toLowerCase());
      applies = true;
    } else if (key === "disallow" && applies) {
      for (const agent of currentAgents) rules.push({ agent, disallow: value });
    } else if (key === "allow" && applies) {
      // Note: not implemented as override; treated as neutral for our purposes.
    } else {
      applies = false;
    }
  }
  for (const rule of rules) {
    const matchesAgent = rule.agent === "*" || ua.includes(rule.agent);
    if (!matchesAgent) continue;
    if (!rule.disallow) continue;
    const disallowed = rule.disallow;
    // Simple prefix match — sufficient for our conservative check.
    if (input.pathname.startsWith(disallowed)) {
      return { blocked: true, rule: `${rule.agent}: Disallow ${disallowed}` };
    }
  }
  return { blocked: false };
}

function termsBlock(termsText: string): { blocked: boolean; phrase?: string } {
  const lower = termsText.toLowerCase();
  for (const phrase of HARD_BLOCK_PHRASES) {
    if (lower.includes(phrase)) return { blocked: true, phrase };
  }
  return { blocked: false };
}

/**
 * Public entrypoint. Returns { allowed, reasons }. Never throws.
 */
export async function shouldAllowExternalContact(
  input: ComplianceInput,
): Promise<ComplianceVerdict> {
  const url = baseUrl(input.targetUrl);
  const reasons: string[] = [];
  if (!url) {
    return { allowed: false, reasons: ["invalid_url"] };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { allowed: false, reasons: ["unsupported_scheme"] };
  }
  const isWrite = WRITE_ACTIONS.has(input.action);
  const userAgent = input.userAgent ?? DEFAULT_AGENT;
  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? 3_000;
  const origin = `${url.protocol}//${url.host}`;

  // robots.txt
  const robotsRes = await fetchWithTimeout(
    fetchImpl,
    `${origin}/robots.txt`,
    timeoutMs,
    userAgent,
  );
  let robotsDecision: { fetched: boolean; matched: boolean; rule?: string } = {
    fetched: false,
    matched: false,
  };
  if (robotsRes) {
    robotsDecision.fetched = true;
    if (robotsRes.ok || robotsRes.status === 404 || robotsRes.status === 0) {
      const parsed = robotsDisallows({
        robotsTxt: robotsRes.text,
        userAgent,
        pathname: url.pathname,
      });
      if (parsed.blocked) {
        robotsDecision.matched = true;
        robotsDecision.rule = parsed.rule;
        reasons.push(`robots_disallow:${parsed.rule ?? "*"}`);
      }
    }
  } else if (isWrite) {
    // Write actions require positive confirmation.
    reasons.push("robots_fetch_failed");
  }

  // policies
  let policiesDecision: { fetched: boolean; allowed?: boolean } = {
    fetched: false,
  };
  const policiesRes = await fetchWithTimeout(
    fetchImpl,
    `${origin}/.well-known/policies`,
    timeoutMs,
    userAgent,
  );
  if (policiesRes && policiesRes.ok) {
    policiesDecision.fetched = true;
    try {
      const j = JSON.parse(policiesRes.text) as {
        disallow?: string[];
        allow?: string[];
      };
      if (Array.isArray(j.disallow)) {
        const p = url.pathname;
        for (const rule of j.disallow) {
          if (typeof rule === "string" && p.startsWith(rule)) {
            reasons.push(`policies_disallow:${rule}`);
            policiesDecision.allowed = false;
            break;
          }
        }
      }
      if (policiesDecision.allowed === undefined) {
        policiesDecision.allowed = true;
      }
    } catch {
      // JSON-unparseable policies — treat as neutral.
    }
  }

  // terms — conservative substring match
  let termsDecision: {
    fetched: boolean;
    blocked: boolean;
    matchedPhrase?: string;
  } = { fetched: false, blocked: false };
  const termsRes = await fetchWithTimeout(
    fetchImpl,
    `${origin}/terms`,
    timeoutMs,
    userAgent,
  );
  if (termsRes && termsRes.ok) {
    termsDecision.fetched = true;
    if (isWrite) {
      const t = termsBlock(termsRes.text);
      if (t.blocked) {
        termsDecision.blocked = true;
        termsDecision.matchedPhrase = t.phrase;
        reasons.push(`terms_block:${t.phrase ?? "hard_phrase"}`);
      }
    }
  }

  const allowed = reasons.length === 0;
  return {
    allowed,
    reasons: allowed ? ["ok"] : reasons,
    robots: robotsDecision,
    policies: policiesDecision,
    terms: termsDecision,
  };
}
