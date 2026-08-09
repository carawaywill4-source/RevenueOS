/**
 * Exit-intent email capture.
 *
 * Emits a page-level snippet (JS + minimal HTML/CSS) returned to the beacon
 * endpoint. On mouseleave (desktop) or scroll-up spike (mobile), a modal
 * shows a compact capture form that POSTs to `/api/exit-intent-capture`
 * which persists the row to the `revenueos_captured_emails` table.
 *
 * Deployment is idempotent: `executeExitIntentDeploy` returns a snippet
 * bundle and marks the site's deploy state so we don't re-emit it every hour.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type ExitIntentSnippet = {
  scriptTag: string;
  scriptBody: string;
  css: string;
  beaconEndpoint: string;
  version: string;
};

const SNIPPET_VERSION = "1.0.0";

const SNIPPET_CSS = `#revos-exit-modal{position:fixed;inset:0;background:rgba(15,23,42,0.62);display:none;align-items:center;justify-content:center;z-index:2147483647;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#0f172a}
#revos-exit-modal[data-open="1"]{display:flex}
#revos-exit-card{background:#fff;border-radius:14px;box-shadow:0 24px 60px rgba(15,23,42,0.35);width:min(420px,92vw);padding:26px 26px 22px}
#revos-exit-card h2{margin:0 0 8px;font-size:20px;line-height:1.25}
#revos-exit-card p{margin:0 0 16px;font-size:14px;color:#475569}
#revos-exit-card form{display:flex;gap:8px;flex-wrap:wrap}
#revos-exit-card input[type=email]{flex:1 1 200px;font-size:15px;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px}
#revos-exit-card button{font-size:14px;font-weight:600;padding:10px 16px;border-radius:8px;border:0;background:#0f172a;color:#fff;cursor:pointer}
#revos-exit-card button.secondary{background:transparent;color:#475569;padding:8px}
#revos-exit-thanks{display:none;font-size:14px;color:#166534;padding:6px 0}
#revos-exit-thanks[data-shown="1"]{display:block}
#revos-exit-close{position:absolute;top:8px;right:12px;background:none;border:0;color:#94a3b8;font-size:22px;cursor:pointer}`;

function snippetBody(input: {
  siteId: string;
  beaconEndpoint: string;
  headline: string;
  subhead: string;
  ctaLabel: string;
}) {
  const cfg = {
    siteId: input.siteId,
    endpoint: input.beaconEndpoint,
    headline: input.headline,
    subhead: input.subhead,
    cta: input.ctaLabel,
    version: SNIPPET_VERSION,
  };
  return `!(function(){
  if (window.__revosExitLoaded) return;
  window.__revosExitLoaded = true;
  var cfg = ${JSON.stringify(cfg)};
  var storeKey = "revos_exit_shown_" + cfg.siteId;
  if (sessionStorage.getItem(storeKey)) return;
  var modal = document.createElement("div");
  modal.id = "revos-exit-modal";
  modal.innerHTML =
    '<div id="revos-exit-card" role="dialog" aria-modal="true" aria-labelledby="revos-exit-title">' +
    '<button id="revos-exit-close" aria-label="Close">&times;</button>' +
    '<h2 id="revos-exit-title"></h2><p></p>' +
    '<form><input type="email" required placeholder="you@example.com" autocomplete="email" />' +
    '<button type="submit"></button></form>' +
    '<div id="revos-exit-thanks">Thanks — check your inbox.</div></div>';
  document.body.appendChild(modal);
  modal.querySelector("h2").textContent = cfg.headline;
  modal.querySelector("p").textContent = cfg.subhead;
  modal.querySelector("button[type=submit]").textContent = cfg.cta;
  function open(){ modal.setAttribute("data-open","1"); sessionStorage.setItem(storeKey,"1"); }
  function close(){ modal.removeAttribute("data-open"); }
  modal.addEventListener("click", function(e){ if(e.target===modal) close(); });
  modal.querySelector("#revos-exit-close").addEventListener("click", close);
  document.addEventListener("mouseleave", function(e){
    if (e.clientY < 6 && !sessionStorage.getItem(storeKey)) open();
  });
  var lastScroll = window.scrollY, lastAt = Date.now();
  window.addEventListener("scroll", function(){
    var now = Date.now();
    if (window.scrollY < lastScroll - 220 && now - lastAt < 220) open();
    lastScroll = window.scrollY; lastAt = now;
  }, { passive: true });
  modal.querySelector("form").addEventListener("submit", function(ev){
    ev.preventDefault();
    var email = modal.querySelector("input[type=email]").value.trim();
    if (!email) return;
    fetch(cfg.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteId: cfg.siteId,
        email: email,
        source: "exit_intent",
        url: window.location.href,
        referrer: document.referrer || "",
        ts: new Date().toISOString(),
      }),
    }).finally(function(){
      modal.querySelector("form").style.display = "none";
      modal.querySelector("#revos-exit-thanks").setAttribute("data-shown","1");
      setTimeout(close, 2000);
    });
  });
})();`;
}

export function buildExitIntentSnippet(input: {
  siteId: string;
  appUrl: string;
  headline?: string;
  subhead?: string;
  ctaLabel?: string;
  beaconEndpoint?: string;
}): ExitIntentSnippet {
  const endpoint =
    input.beaconEndpoint ??
    `${input.appUrl.replace(/\/$/, "")}/api/exit-intent-capture`;
  const body = snippetBody({
    siteId: input.siteId,
    beaconEndpoint: endpoint,
    headline: input.headline ?? "Before you go —",
    subhead:
      input.subhead ??
      "Get one email when the next feature ships. No spam, unsubscribe anytime.",
    ctaLabel: input.ctaLabel ?? "Notify me",
  });
  return {
    scriptTag: `<script defer data-revos-exit-intent>${body}</script><style data-revos-exit-intent>${SNIPPET_CSS}</style>`,
    scriptBody: body,
    css: SNIPPET_CSS,
    beaconEndpoint: endpoint,
    version: SNIPPET_VERSION,
  };
}

function dataDir(rootDir: string): string {
  return path.join(rootDir, ".data", "exit-intent");
}

async function readJson<T>(p: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(p, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(p: string, data: unknown) {
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(data, null, 2));
}

export type ExitIntentDeployment = {
  version: string;
  deployedAt: string;
  beaconEndpoint: string;
};

/**
 * Materialise the exit-intent snippet to disk so the beacon endpoint /
 * page-level layout can serve it. Idempotent per version.
 */
export async function executeExitIntentDeploy(input: {
  rootDir: string;
  siteId: string;
  appUrl: string;
  headline?: string;
  subhead?: string;
  ctaLabel?: string;
  now?: Date;
}): Promise<{
  ok: true;
  detail: string;
  url?: string;
  snippet: ExitIntentSnippet;
  deployment: ExitIntentDeployment;
}> {
  const snippet = buildExitIntentSnippet({
    siteId: input.siteId,
    appUrl: input.appUrl,
    headline: input.headline,
    subhead: input.subhead,
    ctaLabel: input.ctaLabel,
  });
  const deployFile = path.join(dataDir(input.rootDir), "deployment.json");
  const existing = await readJson<ExitIntentDeployment | null>(deployFile, null);
  const deployment: ExitIntentDeployment = {
    version: snippet.version,
    deployedAt: (input.now ?? new Date()).toISOString(),
    beaconEndpoint: snippet.beaconEndpoint,
  };
  await writeJson(deployFile, deployment);
  await writeJson(path.join(dataDir(input.rootDir), "snippet.json"), snippet);
  const changed = existing?.version !== snippet.version;
  return {
    ok: true,
    detail: changed
      ? `exit_intent_deploy: snippet v${snippet.version} materialised → ${snippet.beaconEndpoint}`
      : `exit_intent_deploy: snippet already at v${snippet.version} (idempotent no-op)`,
    url: snippet.beaconEndpoint,
    snippet,
    deployment,
  };
}
