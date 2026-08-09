/**
 * Sidecar bridge tests.
 *
 * The bridge is a pure function of fetch responses. We inject a stub
 * fetch and assert the mapping from SafeAction → sidecar route + body
 * is stable. If someone renames a SafeAction type on the brain side we
 * want the CI test to fail before it silently breaks execution.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  executeThroughSidecar,
  isSidecarAction,
} from "../lib/sidecar-executor.js";

function stubFetch(handler: (url: string, body: unknown) => unknown) {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    const result = handler(url, body);
    const parsed =
      typeof result === "object" && result !== null ? result : { ok: false };
    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}

test("recognizes sidecar-supported actions", () => {
  assert.equal(
    isSidecarAction({
      type: "reddit_helpful_reply",
      risk: "safe",
      description: "",
    }),
    true,
  );
  assert.equal(
    isSidecarAction({
      type: "scorecard_snapshot",
      risk: "safe",
      description: "",
    }),
    false,
  );
});

test("routes reddit_helpful_reply to /reddit/reply", async () => {
  let capturedUrl = "";
  let capturedBody: Record<string, unknown> = {};
  const fetchImpl = stubFetch((url, body) => {
    capturedUrl = url;
    capturedBody = body as Record<string, unknown>;
    return { ok: true, url: "https://reddit.com/r/foo/comments/bar" };
  }) as unknown as typeof fetch;

  const result = await executeThroughSidecar({
    action: {
      type: "reddit_helpful_reply",
      risk: "safe",
      description: "help",
      payload: { threadUrl: "https://reddit.com/x", body: "hi" },
    },
    config: {
      baseUrl: "http://sidecar",
      token: "s3cr3t",
      fetchImpl,
      dryRun: false,
    },
  });

  assert.equal(capturedUrl, "http://sidecar/reddit/reply");
  assert.equal(capturedBody.threadUrl, "https://reddit.com/x");
  assert.equal(capturedBody.body, "hi");
  assert.equal(capturedBody.dryRun, false);
  assert.equal(result.ok, true);
});

test("routes hackernews_show_hn_draft to /post/hackernews", async () => {
  let captured = "";
  const fetchImpl = stubFetch((url) => {
    captured = url;
    return { ok: true, url: "https://news.ycombinator.com/item?id=1" };
  }) as unknown as typeof fetch;

  await executeThroughSidecar({
    action: {
      type: "hackernews_show_hn_draft",
      risk: "safe",
      description: "Show HN",
      payload: { title: "Show HN: test", url: "https://ex.com" },
    },
    config: { baseUrl: "http://sidecar", token: "t", fetchImpl },
  });
  assert.equal(captured, "http://sidecar/post/hackernews");
});

test("routes indiehackers_community_post_draft to /post/indiehackers", async () => {
  let captured = "";
  const fetchImpl = stubFetch((url) => {
    captured = url;
    return { ok: true };
  }) as unknown as typeof fetch;

  await executeThroughSidecar({
    action: {
      type: "indiehackers_community_post_draft",
      risk: "safe",
      description: "IH post",
      payload: { productSlug: "foo", body: "hello" },
    },
    config: { baseUrl: "http://sidecar", token: "t", fetchImpl },
  });
  assert.equal(captured, "http://sidecar/post/indiehackers");
});

test("returns unsupported detail for non-sidecar actions", async () => {
  const result = await executeThroughSidecar({
    action: {
      type: "scorecard_snapshot",
      risk: "safe",
      description: "",
    },
    config: {
      baseUrl: "http://sidecar",
      token: "t",
      fetchImpl: (() => {
        throw new Error("fetch should not be called");
      }) as unknown as typeof fetch,
    },
  });
  assert.equal(result.ok, false);
  assert.match(result.detail, /sidecar cannot execute/);
});

test("propagates sidecar error to ActionResult", async () => {
  const fetchImpl = stubFetch(() => ({ ok: false, error: "logged_out" })) as unknown as typeof fetch;
  const result = await executeThroughSidecar({
    action: {
      type: "reddit_helpful_reply",
      risk: "safe",
      description: "",
      payload: { threadUrl: "x", body: "y" },
    },
    config: { baseUrl: "http://sidecar", token: "t", fetchImpl },
  });
  assert.equal(result.ok, false);
  assert.match(result.detail, /logged_out/);
});
