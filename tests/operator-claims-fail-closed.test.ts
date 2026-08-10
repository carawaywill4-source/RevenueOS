/**
 * Step 3 — smallest targeted proof that Supabase outages fail CLOSED
 * so Vercel cron cannot wake runPursuitTick during lookup failures.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkOperatorHosting } from "../packages/revenueos/src/modules/operator-claims.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Mirrors storefront cron route: brain only runs when not hosted. */
function vercelCronWouldRunBrain(host: { hosted: boolean }): boolean {
  return !host.hosted;
}

test("BidBinder production cron schedule is empty (no minute wakeups)", () => {
  const vercelJson = JSON.parse(
    readFileSync(path.join(root, "apps/bidbinder/vercel.json"), "utf8"),
  ) as { crons?: unknown[] };
  assert.deepEqual(vercelJson.crons, []);
});

test("BidBinder cron route skips runPursuitTick when hosted", () => {
  const route = readFileSync(
    path.join(root, "apps/bidbinder/src/app/api/cron/revenueos/route.ts"),
    "utf8",
  );
  assert.match(route, /checkOperatorHosting/);
  assert.match(route, /if \(host\.hosted\)/);
  assert.match(route, /skipped: true/);
  // Call site (not the import) must sit after the hosted early-return.
  const hostedIdx = route.indexOf("if (host.hosted)");
  const tickCallIdx = route.indexOf("await runPursuitTick");
  assert.ok(hostedIdx >= 0, "missing hosted guard");
  assert.ok(tickCallIdx > hostedIdx, "brain call must follow hosted guard");
});

test("BidBinder vendor operator-claims matches fail-closed core", () => {
  const pkg = readFileSync(
    path.join(root, "packages/revenueos/src/modules/operator-claims.ts"),
    "utf8",
  );
  const vendor = readFileSync(
    path.join(
      root,
      "apps/bidbinder/vendor/revenueos/src/modules/operator-claims.ts",
    ),
    "utf8",
  );
  assert.equal(vendor, pkg);
  assert.match(vendor, /lookup_failed_fail_closed/);
  assert.doesNotMatch(
    vendor,
    /hosted:\s*false,\s*reason:\s*"lookup_failed"/,
  );
});

test("native claim HTTP error fails closed — cron must not run brain", async () => {
  const prev = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response("upstream_error", { status: 503 })) as typeof fetch;
  try {
    const host = await checkOperatorHosting("bidbinder", {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test-key",
    });
    assert.equal(host.hosted, true);
    assert.equal(
      (host as { owner?: string }).owner,
      "lookup_failed_fail_closed",
    );
    assert.equal(vercelCronWouldRunBrain(host), false);
  } finally {
    globalThis.fetch = prev;
  }
});

test("thrown/timeout lookup fails closed — cron must not run brain", async () => {
  const prev = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("AbortError: timeout");
  }) as typeof fetch;
  try {
    const host = await checkOperatorHosting("bidbinder", {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test-key",
    });
    assert.equal(host.hosted, true);
    assert.equal(
      (host as { owner?: string }).owner,
      "lookup_failed_fail_closed",
    );
    assert.equal(vercelCronWouldRunBrain(host), false);
  } finally {
    globalThis.fetch = prev;
  }
});

test("document-claim HTTP error fails closed after native table missing", async () => {
  const prev = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls += 1;
    const url = String(input);
    if (url.includes("revenueos_operator_claims")) {
      return new Response(JSON.stringify({ message: "does not exist" }), {
        status: 404,
      });
    }
    return new Response("db_down", { status: 522 });
  }) as typeof fetch;
  try {
    const host = await checkOperatorHosting("bidbinder", {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test-key",
    });
    assert.ok(calls >= 2);
    assert.equal(host.hosted, true);
    assert.equal(
      (host as { owner?: string }).owner,
      "lookup_failed_fail_closed",
    );
    assert.equal(vercelCronWouldRunBrain(host), false);
  } finally {
    globalThis.fetch = prev;
  }
});

test("REVENUEOS_OPERATOR_HOSTED=1 forces skip without Supabase", async () => {
  const host = await checkOperatorHosting("bidbinder", {
    REVENUEOS_OPERATOR_HOSTED: "1",
  });
  assert.equal(host.hosted, true);
  assert.equal(vercelCronWouldRunBrain(host), false);
});
