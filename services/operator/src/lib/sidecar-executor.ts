/**
 * Bridge from RevenueOS safe actions to the browser sidecar.
 *
 * The operator service runs remotely. Actions that require the owner's
 * real logged-in browser session (Reddit, HN, IH, Substack, Quora) get
 * dispatched to the local browser sidecar via HTTP. Everything else
 * returns an "unsupported" ActionResult so the brain records the gap and
 * reallocates budget.
 *
 * All calls include an X-Sidecar-Token so the sidecar never accepts
 * commands from anywhere but the paired operator.
 */

import type { ActionResult, SafeAction } from "@revenueos/core";

export type SidecarBridgeConfig = {
  baseUrl: string;
  token: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  dryRun?: boolean;
};

type SidecarResponse = {
  ok: boolean;
  detail?: string;
  url?: string;
  screenshotPath?: string;
  error?: string;
};

async function post(
  config: SidecarBridgeConfig,
  path: string,
  body: unknown,
): Promise<SidecarResponse> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const controller = new AbortController();
  const t = setTimeout(
    () => controller.abort(),
    config.timeoutMs ?? 45_000,
  );
  try {
    const res = await fetchImpl(`${config.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-sidecar-token": config.token,
      },
      body: JSON.stringify({ ...(body as object), dryRun: config.dryRun }),
      signal: controller.signal,
    });
    const text = await res.text();
    let parsed: SidecarResponse;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { ok: res.ok, detail: text.slice(0, 200) };
    }
    if (!res.ok && !parsed.error) {
      parsed.error = `sidecar HTTP ${res.status}`;
    }
    return parsed;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Return true iff this SafeAction is something the sidecar can execute.
 * The registry stays authoritative in @revenueos/core; this is only about
 * routing already-decided actions to a real logged-in browser.
 */
export function isSidecarAction(action: SafeAction): boolean {
  return (
    action.type === "reddit_helpful_reply" ||
    action.type === "reddit_discover_intent" ||
    action.type === "hackernews_show_hn_draft" ||
    action.type === "indiehackers_product_listing_draft" ||
    action.type === "indiehackers_community_post_draft" ||
    action.type === "substack_publish" ||
    action.type === "quora_answer_public"
  );
}

function mapToSidecarPath(action: SafeAction): {
  path: string;
  body: Record<string, unknown>;
} | null {
  const payload = action.payload ?? {};
  switch (action.type) {
    case "reddit_helpful_reply":
      return {
        path: "/reddit/reply",
        body: {
          threadUrl: String(payload.threadUrl ?? payload.url ?? ""),
          body: String(payload.body ?? payload.message ?? ""),
        },
      };
    case "reddit_discover_intent":
      return {
        path: "/reddit/post",
        body: {
          subreddit: String(payload.subreddit ?? "SideProject"),
          title: String(payload.title ?? "Feedback wanted"),
          body: String(payload.body ?? action.description),
        },
      };
    case "hackernews_show_hn_draft":
      return {
        path: "/post/hackernews",
        body: {
          title: String(payload.title ?? action.description),
          url: String(payload.url ?? ""),
        },
      };
    case "indiehackers_product_listing_draft":
    case "indiehackers_community_post_draft":
      return {
        path: "/post/indiehackers",
        body: {
          productSlug: String(payload.productSlug ?? payload.slug ?? ""),
          body: String(payload.body ?? action.description),
        },
      };
    case "substack_publish":
      return {
        path: "/post/substack",
        body: {
          publicationId: String(payload.publicationId ?? ""),
          html: String(payload.html ?? payload.body ?? ""),
          subject: String(payload.subject ?? payload.title ?? ""),
        },
      };
    case "quora_answer_public":
      return {
        path: "/post/quora",
        body: {
          questionId: String(payload.questionId ?? ""),
          body: String(payload.body ?? action.description),
        },
      };
    default:
      return null;
  }
}

export async function executeThroughSidecar(input: {
  action: SafeAction;
  config: SidecarBridgeConfig;
}): Promise<ActionResult> {
  if (!isSidecarAction(input.action)) {
    return {
      ok: false,
      detail: `sidecar cannot execute ${input.action.type}`,
    };
  }
  const routed = mapToSidecarPath(input.action);
  if (!routed) {
    return {
      ok: false,
      detail: `sidecar has no route for ${input.action.type}`,
    };
  }
  const res = await post(input.config, routed.path, routed.body);
  return {
    ok: Boolean(res.ok),
    detail:
      res.detail ??
      res.error ??
      (res.ok ? `sidecar posted ${input.action.type}` : "sidecar_failed"),
    exposureKey: input.action.exposureKey,
    exposureVersion: res.url ?? undefined,
  };
}
