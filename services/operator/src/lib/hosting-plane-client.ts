/**
 * Thin Core → Hosting Plane client.
 * Core decides; hosting plane executes. Core failure ≠ storefront offline.
 */

const DEFAULT_URL = process.env.HOSTING_PLANE_URL || "http://127.0.0.1:8090";
const TOKEN =
  process.env.HOSTING_PLANE_TOKEN || process.env.CRON_SECRET || "";

export type HostingPlaneClient = {
  baseUrl: string;
  available(): Promise<boolean>;
  status(): Promise<Record<string, unknown>>;
  deploy(input: {
    siteId: string;
    appDir?: string;
    version?: string;
    reason: string;
    hypothesis?: string;
    domain?: string;
    env?: Record<string, string>;
  }): Promise<Record<string, unknown>>;
  rollback(siteId: string): Promise<Record<string, unknown>>;
  pause(siteId: string): Promise<Record<string, unknown>>;
  resume(siteId: string): Promise<Record<string, unknown>>;
  restart(siteId: string): Promise<Record<string, unknown>>;
  retire(siteId: string): Promise<Record<string, unknown>>;
};

async function call(
  path: string,
  init?: RequestInit,
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(init?.headers as Record<string, string>),
  };
  if (TOKEN) headers.authorization = `Bearer ${TOKEN}`;
  const res = await fetch(`${DEFAULT_URL}${path}`, {
    ...init,
    headers,
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      ...body,
    };
  }
  return body;
}

export function createHostingPlaneClient(): HostingPlaneClient {
  return {
    baseUrl: DEFAULT_URL,
    async available() {
      try {
        const res = await fetch(`${DEFAULT_URL}/healthz`, {
          signal: AbortSignal.timeout(2000),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
    status() {
      return call("/status");
    },
    deploy(input) {
      return call("/deploy", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    rollback(siteId) {
      return call("/rollback", {
        method: "POST",
        body: JSON.stringify({ siteId }),
      });
    },
    pause(siteId) {
      return call("/pause", {
        method: "POST",
        body: JSON.stringify({ siteId }),
      });
    },
    resume(siteId) {
      return call("/resume", {
        method: "POST",
        body: JSON.stringify({ siteId }),
      });
    },
    restart(siteId) {
      return call("/restart", {
        method: "POST",
        body: JSON.stringify({ siteId }),
      });
    },
    retire(siteId) {
      return call("/retire", {
        method: "POST",
        body: JSON.stringify({ siteId }),
      });
    },
  };
}
