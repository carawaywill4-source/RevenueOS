import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  executeSiteMutation,
  rollbackSiteMutation,
} from "./site-mutations.js";

test("change_default_cta writes versioned business-scoped mutation", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ros-mut-"));
  const res = await executeSiteMutation({
    rootDir: root,
    siteId: "quotecraft",
    kind: "change_default_cta",
    appUrl: "https://quotecraft.example",
    productName: "QuoteCraft",
    priceUsd: 49,
    patternKey: "conv:cta_directness:buy_now",
  });
  assert.equal(res.ok, true);
  assert.match(res.detail, /change_default_cta/);
  assert.equal(res.mutation?.siteId, "quotecraft");
  assert.equal(res.mutation?.version, 1);
  assert.ok(res.realEffects.some((e) => e.startsWith("durable_mutation:")));
  const raw = await readFile(
    path.join(root, ".data", "revenueos", "site-mutations", "quotecraft", "current.json"),
    "utf8",
  );
  const doc = JSON.parse(raw);
  assert.equal(doc.siteId, "quotecraft");
  assert.equal(doc.payload.routeTopicCtaToCheckout, true);
});

test("ScopeGuard rejects path-traversal siteId", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ros-mut-"));
  await assert.rejects(
    () =>
      executeSiteMutation({
        rootDir: root,
        siteId: "../evil",
        kind: "rewrite_page_copy",
        appUrl: "https://x.example",
        productName: "X",
        priceUsd: 10,
      }),
    /scopeguard_invalid_siteId/,
  );
});

test("rollback restores previous version", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ros-mut-"));
  await executeSiteMutation({
    rootDir: root,
    siteId: "bidforge",
    kind: "rewrite_page_copy",
    appUrl: "https://bidforge.example",
    productName: "BidForge",
    priceUsd: 39,
    patternKey: "conv:guarantee:refund_30d",
  });
  await executeSiteMutation({
    rootDir: root,
    siteId: "bidforge",
    kind: "rewrite_page_copy",
    appUrl: "https://bidforge.example",
    productName: "BidForge",
    priceUsd: 39,
    patternKey: "conv:urgency:price_up_soon",
  });
  const rb = await rollbackSiteMutation({ rootDir: root, siteId: "bidforge" });
  assert.equal(rb.ok, true);
  const raw = await readFile(
    path.join(root, ".data", "revenueos", "site-mutations", "bidforge", "current.json"),
    "utf8",
  );
  const doc = JSON.parse(raw);
  assert.match(String(doc.payload.banner), /refund/i);
});
