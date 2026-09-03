import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fetchBusinessOverviews,
  fetchDrafts,
  fetchChannels,
  fetchLeads,
} from "./data";

test("fetchBusinessOverviews returns empty overview when Supabase unset", async () => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const rows = await fetchBusinessOverviews([
    { siteId: "x", displayName: "X", appUrl: "http://x" },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.actionsPastHour, 0);
  assert.equal(rows[0]!.alerts.length, 0);
});

test("fetchDrafts returns empty list without Supabase", async () => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const drafts = await fetchDrafts();
  assert.deepEqual(drafts, []);
});

test("fetchChannels returns empty registry without Supabase", async () => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetchChannels("raiseready");
  assert.equal(res.siteId, "raiseready");
  assert.deepEqual(res.channels, []);
});

test("fetchLeads returns empty list without Supabase", async () => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const leads = await fetchLeads("raiseready");
  assert.deepEqual(leads, []);
});
