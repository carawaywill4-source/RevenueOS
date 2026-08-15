/**
 * Traffic classification for economic proof.
 *
 * E6 uses VERIFIED_HUMAN_SIGNAL only.
 * LIKELY_HUMAN requires a real browser UA AND a third-party (non-owned)
 * referer AND a non-internal IP. Owned-domain traversal is INTERNAL.
 */

export type TrafficClass =
  | "INTERNAL"
  | "BOT"
  | "CRAWLER"
  | "SYNTHETIC_TEST"
  | "UNKNOWN"
  | "LIKELY_HUMAN"
  | "VERIFIED_HUMAN_SIGNAL"
  | "QUALIFIED";

export type ClassifiedRequest = {
  class: TrafficClass;
  reason: string;
  qualified: boolean;
};

const OWNED_HOST =
  /sslip\.io|130\.131\.15\.68|localhost|127\.0\.0\.1|revenueos-core/i;

const INTERNAL_UA =
  /RevenueOS|TitanAcquisition|HostingPlane|commercial-gate|repair-diagnoser|CustomerZero|curl\/|Wget|python-requests|Go-http-client|HealthCheck|kube-probe|UptimeRobot|BetterStack|Playwright/i;

const CRAWLER_UA =
  /Googlebot|Bingbot|DuckDuckBot|Applebot|Yandex|Baiduspider|Slurp|Bytespider|Semrush|Ahrefs|DotBot|PetalBot|MJ12bot|ia_archiver|facebookexternalhit|Twitterbot|LinkedInBot|bingpreview/i;

const BOT_UA = /bot|crawl|spider|slurp|headless|phantom|selenium|puppeteer/i;

const BROWSER_UA =
  /Mozilla\/5\.0.*(Chrome|Firefox|Safari|Edg|OPR|CriOS|FxiOS)/i;

const DATACENTER_IP =
  /^(23\.94\.|23\.27\.|143\.198\.|164\.92\.|147\.182\.|143\.110\.|167\.99\.|159\.89\.|134\.209\.|206\.189\.|68\.183\.|157\.245\.|161\.35\.|178\.62\.|46\.101\.|104\.248\.|165\.227\.|138\.68\.|139\.59\.|3\.|18\.|34\.|35\.|44\.|52\.|54\.|13\.|100\.24\.|107\.20\.|149\.57\.)/;

const SYNTHETIC_MARKERS =
  /utm_source=acquisitionos|utm_source=titan|utm_medium=operator|ros-evo-|e5_owned_artifact_probe|ultron-external-agency/i;

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function isOwnedSurface(urlOrHost: string | null | undefined): boolean {
  if (!urlOrHost) return false;
  return OWNED_HOST.test(urlOrHost);
}

export function classifyTraffic(input: {
  userAgent?: string | null;
  path?: string | null;
  referer?: string | null;
  remoteIp?: string | null;
  eventKind?: string | null;
  host?: string | null;
  url?: string | null;
}): ClassifiedRequest {
  const ua = String(input.userAgent ?? "").trim();
  const path = String(input.path ?? "/");
  const kind = String(input.eventKind ?? "").toLowerCase();
  const ip = String(input.remoteIp ?? "").replace(/^::ffff:/, "");
  const referer = String(input.referer ?? "");
  const host = String(input.host ?? "");
  const url = String(input.url ?? "");
  const blob = `${ua} ${path} ${referer} ${url} ${kind}`;

  if (
    kind === "titan_probe" ||
    kind === "health" ||
    kind === "telemetry_test" ||
    kind === "browser_fixture" ||
    INTERNAL_UA.test(ua) ||
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("10.") ||
    ip === "130.131.15.68"
  ) {
    return { class: "INTERNAL", reason: kind === "titan_probe" ? "titan_probe" : "internal_ua_or_ip", qualified: false };
  }

  if (SYNTHETIC_MARKERS.test(blob)) {
    return { class: "SYNTHETIC_TEST", reason: "synthetic_utm_or_probe", qualified: false };
  }

  if (CRAWLER_UA.test(ua)) {
    return { class: "CRAWLER", reason: "crawler_ua", qualified: false };
  }

  if (!ua) {
    return { class: "UNKNOWN", reason: "empty_ua", qualified: false };
  }

  if (BOT_UA.test(ua)) {
    return { class: "BOT", reason: "bot_ua", qualified: false };
  }

  if (!ip) {
    return { class: "UNKNOWN", reason: "missing_remote_ip", qualified: false };
  }

  if (!referer && DATACENTER_IP.test(ip)) {
    return { class: "BOT", reason: "datacenter_empty_referer_scan", qualified: false };
  }

  const refererOwned = isOwnedSurface(referer) || isOwnedSurface(hostOf(referer));
  const hostOwned = isOwnedSurface(host) || isOwnedSurface(url);

  // Owned-domain traversal / self-referer is INTERNAL, never a human proof.
  if (refererOwned && hostOwned) {
    return { class: "INTERNAL", reason: "owned_domain_traversal", qualified: false };
  }
  if (refererOwned && !referer) {
    return { class: "INTERNAL", reason: "owned_referer", qualified: false };
  }
  if (referer && refererOwned) {
    return { class: "INTERNAL", reason: "owned_referer", qualified: false };
  }

  if (DATACENTER_IP.test(ip) && (!referer || refererOwned)) {
    return { class: "BOT", reason: "datacenter_owned_or_empty_referer", qualified: false };
  }

  const intentPath =
    /checkout|buy|#buy|\/api\/checkout|success|fulfillment|pricing|offer/i.test(path) ||
    kind === "checkout_start" ||
    kind === "cta" ||
    kind === "purchase";

  const externalReferer = referer.length > 0 && !isOwnedSurface(referer) && !isOwnedSurface(hostOf(referer));

  if (BROWSER_UA.test(ua)) {
    if (intentPath && externalReferer && !DATACENTER_IP.test(ip)) {
      return {
        class: "VERIFIED_HUMAN_SIGNAL",
        reason: "browser_intent_third_party_referer",
        qualified: true,
      };
    }
    if (externalReferer && !DATACENTER_IP.test(ip)) {
      return {
        class: "LIKELY_HUMAN",
        reason: "browser_third_party_referer",
        qualified: false,
      };
    }
    if (intentPath) {
      return { class: "UNKNOWN", reason: "browser_direct_intent_unverified", qualified: false };
    }
    return { class: "UNKNOWN", reason: "browser_direct_or_owned_referer", qualified: false };
  }

  return { class: "UNKNOWN", reason: "unclassified_ua", qualified: false };
}

/** E6 gate: only this class counts as a legitimate attributable human. */
export function isEconomicHuman(cls: string): boolean {
  return cls === "VERIFIED_HUMAN_SIGNAL";
}
