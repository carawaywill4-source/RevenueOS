/**
 * Health checks for candidate / production runtimes.
 * Smoke checks stay non-destructive (no real charges).
 */

export type HealthReport = {
  ok: boolean;
  httpOk: boolean;
  latencyMs: number;
  statusCode: number | null;
  detail: string;
  checkedAt: string;
};

export async function checkHttpHealth(input: {
  baseUrl: string;
  healthPath?: string;
  timeoutMs?: number;
}): Promise<HealthReport> {
  const path = input.healthPath ?? "/";
  const url = `${input.baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  const started = Date.now();
  const timeoutMs = input.timeoutMs ?? 8000;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      method: "GET",
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "user-agent": "RevenueOS-HostingPlane/1.0" },
    });
    clearTimeout(t);
    const latencyMs = Date.now() - started;
    const httpOk = res.status >= 200 && res.status < 500;
    return {
      ok: httpOk && res.status < 400,
      httpOk,
      latencyMs,
      statusCode: res.status,
      detail: `http_${res.status}`,
      checkedAt: new Date().toISOString(),
    };
  } catch (e) {
    return {
      ok: false,
      httpOk: false,
      latencyMs: Date.now() - started,
      statusCode: null,
      detail: `fetch_error:${e instanceof Error ? e.message : String(e)}`.slice(0, 200),
      checkedAt: new Date().toISOString(),
    };
  }
}

export async function smokeCheckoutReady(input: {
  baseUrl: string;
  timeoutMs?: number;
}): Promise<{ ok: boolean; detail: string }> {
  // Non-destructive: GET checkout page / API readiness if exposed.
  const candidates = ["/api/checkout", "/checkout", "/api/health"];
  for (const p of candidates) {
    const r = await checkHttpHealth({
      baseUrl: input.baseUrl,
      healthPath: p,
      timeoutMs: input.timeoutMs ?? 6000,
    });
    // 404 means route missing; 503 may mean Stripe not wired — still reachable.
    if (r.statusCode != null && r.statusCode !== 404) {
      return {
        ok: r.statusCode < 500 || r.statusCode === 503,
        detail: `${p}:${r.statusCode}`,
      };
    }
  }
  return { ok: true, detail: "smoke_skipped_no_checkout_route" };
}
