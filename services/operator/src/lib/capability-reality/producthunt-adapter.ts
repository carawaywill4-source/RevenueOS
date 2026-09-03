/**
 * Product Hunt adapter.
 * The public GraphQL API cannot create comments. Using it as a write
 * channel produced hundreds of FAILED receipts and a fake daily cap.
 * This adapter reads newest launches and harvests maker websites for
 * one-to-one outreach instead.
 */

import type pg from "pg";

const GRAPHQL = "https://api.producthunt.com/v2/api/graphql";

async function phGraphql<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<{ ok: true; data: T } | { ok: false; detail: string }> {
  const token = process.env.PRODUCTHUNT_DEVELOPER_TOKEN;
  if (!token) return { ok: false, detail: "PRODUCTHUNT_DEVELOPER_TOKEN missing" };
  try {
    const res = await fetch(GRAPHQL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        accept: "application/json",
        "user-agent": "RevenueOS-Titan/1.0",
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(20_000),
    });
    const body = (await res.json()) as {
      data?: T;
      errors?: Array<{ message?: string }>;
    };
    if (!res.ok) {
      return { ok: false, detail: `ph_${res.status}` };
    }
    if (body.errors?.length) {
      return {
        ok: false,
        detail: `ph_gql:${body.errors[0]?.message ?? "error"}`.slice(0, 140),
      };
    }
    if (!body.data) return { ok: false, detail: "ph_empty" };
    return { ok: true, data: body.data };
  } catch (e) {
    return {
      ok: false,
      detail: e instanceof Error ? e.message.slice(0, 120) : "ph_fetch_failed",
    };
  }
}

export async function harvestProductHuntMakerContacts(input: {
  pool: pg.Pool;
  businessId: string;
  keywords: string[];
  problem: string;
}): Promise<{
  ok: boolean;
  kind: string;
  detail: string;
  newAudience: boolean;
  destination?: string;
  stored?: number;
}> {
  if (!process.env.PRODUCTHUNT_DEVELOPER_TOKEN) {
    return {
      ok: false,
      kind: "auth_missing",
      detail: "producthunt token missing",
      newAudience: false,
      stored: 0,
    };
  }

  const search = await phGraphql<{
    posts: {
      edges: Array<{
        node: {
          id: string;
          name: string;
          tagline: string;
          url: string;
          website: string;
          makers: Array<{ websiteUrl?: string | null }>;
        };
      }>;
    };
  }>(
    `query($first:Int!){
      posts(first:$first, order:NEWEST){
        edges{
          node{
            id name tagline url website
            makers { websiteUrl }
          }
        }
      }
    }`,
    { first: 20 },
  );
  if (!search.ok) {
    return {
      ok: false,
      kind: "discover_failed",
      detail: search.detail,
      newAudience: false,
      stored: 0,
    };
  }

  const { extractPublicEmails, persistContacts } = await import(
    "../commercial-execution-v4/contacts.js"
  );
  const sites = new Set<string>();
  for (const edge of search.data.posts.edges) {
    const n = edge.node;
    if (n.website && /^https?:\/\//i.test(n.website)) sites.add(n.website);
    for (const mk of n.makers ?? []) {
      if (mk.websiteUrl && /^https?:\/\//i.test(mk.websiteUrl)) sites.add(mk.websiteUrl);
    }
    if (sites.size >= 8) break;
  }

  let stored = 0;
  let pages = 0;
  for (const url of [...sites].slice(0, 6)) {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: { "user-agent": "RevenueOS-acquisition/4.5" },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) continue;
      const html = (await res.text()).slice(0, 80_000);
      pages += 1;
      stored += await persistContacts(
        input.pool,
        input.businessId,
        extractPublicEmails(html, url),
      );
    } catch {
      /* next site */
    }
  }

  return {
    ok: stored > 0 || pages > 0,
    kind: "producthunt_maker_harvest",
    detail: `ph_sites_${sites.size}_pages_${pages}_stored_${stored}`,
    newAudience: false,
    stored,
  };
}

export async function executeProductHuntFrontierBet(input: {
  pool: pg.Pool;
  businessId: string;
  keywords: string[];
  problem: string;
}): Promise<{
  ok: boolean;
  kind: string;
  detail: string;
  newAudience: boolean;
  destination?: string;
  stored?: number;
}> {
  return harvestProductHuntMakerContacts(input);
}
