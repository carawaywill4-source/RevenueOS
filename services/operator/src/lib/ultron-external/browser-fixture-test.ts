/**
 * FIX 10 — Safe browser primitive tests against a RevenueOS-controlled fixture.
 * Establishes C2/C3 actuator mechanics. Does NOT count as E5.
 */

import { randomUUID } from "node:crypto";
import type pg from "pg";
import type { Logger } from "../ultron-core/types.js";
import {
  acquireBrowserSlot,
  releaseBrowserSlot,
  ensureSecureArtifactRoot,
  redactSecrets,
} from "./browser-governance.js";

export const BROWSER_FIXTURE_PATH = "/ultron/browser-fixture";

export async function runOwnedFixturePrimitiveTest(
  pool: pg.Pool,
  logger: Logger,
  fixtureUrl: string,
): Promise<{ ok: boolean; steps: string[]; detail: string }> {
  const slot = await acquireBrowserSlot(logger);
  if (!slot.ok) return { ok: false, steps: [], detail: slot.reason };

  const pwMod = await Function("return import('playwright')")().catch(() => null);
  if (!pwMod) {
    releaseBrowserSlot();
    return { ok: false, steps: [], detail: "playwright_not_installed" };
  }

  ensureSecureArtifactRoot();
  const sessionId = `sess_fix_${randomUUID().slice(0, 10)}`;
  const steps: string[] = [];
  let browser: { close: () => Promise<void> } | null = null;

  await pool.query(
    `insert into ros_browser_sessions
       (session_id, purpose, business_id, platform, state, isolation_key, created_at, updated_at)
     values ($1,'owned_fixture_primitive_test',null,'owned_fixture','ACTIVE',$2, now(), now())`,
    [sessionId, "org::owned_fixture"],
  );

  try {
    browser = await pwMod.chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
      timeout: 45_000,
    });
    const ctx = await (browser as unknown as {
      newContext: (o: unknown) => Promise<{
        newPage: () => Promise<{
          goto: (u: string, o: unknown) => Promise<unknown>;
          click: (s: string) => Promise<void>;
          fill: (s: string, v: string) => Promise<void>;
          locator: (s: string) => { textContent: () => Promise<string | null> };
          waitForSelector: (s: string, o?: unknown) => Promise<unknown>;
        }>;
        storageState: () => Promise<unknown>;
        close: () => Promise<void>;
      }>;
    }).newContext({
      viewport: { width: 800, height: 600 },
      userAgent: "RevenueOS/ultron-external-agency (+https://revenueos.dev/bot)",
    });
    const page = await ctx.newPage();
    await page.goto(fixtureUrl, { waitUntil: "domcontentloaded", timeout: 15_000 });
    steps.push("open");
    await record(pool, sessionId, "open_page", fixtureUrl, "SUCCESS");

    await page.click("#ros-fixture-btn");
    steps.push("click");
    await record(pool, sessionId, "click", fixtureUrl, "SUCCESS");

    await page.fill("#ros-fixture-input", "hello-revenueos");
    steps.push("type");
    await record(pool, sessionId, "type", fixtureUrl, "SUCCESS", redactSecrets("hello-revenueos"));

    await page.click("#ros-fixture-submit");
    steps.push("submit");
    await page.waitForSelector("#ros-fixture-ok", { timeout: 5_000 });
    steps.push("wait");
    await record(pool, sessionId, "submit_form", fixtureUrl, "SUCCESS");

    const state = await ctx.storageState();
    await pool.query(
      `update ros_browser_sessions
          set storage_state = $2::jsonb, state='COMPLETED', last_url=$3, last_action_at=now(), updated_at=now()
        where session_id=$1`,
      [sessionId, JSON.stringify(state), fixtureUrl],
    );

    await ctx.close();
    await (browser as { close: () => Promise<void> }).close();
    browser = null;

    // Resume: new launch, load storage_state, confirm page still reachable.
    const browser2 = await pwMod.chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
      timeout: 45_000,
    });
    const ctx2 = await browser2.newContext({
      storageState: state as never,
      userAgent: "RevenueOS/ultron-external-agency (+https://revenueos.dev/bot)",
    });
    const page2 = await ctx2.newPage();
    await page2.goto(fixtureUrl, { waitUntil: "domcontentloaded", timeout: 15_000 });
    steps.push("session_resume");
    await record(pool, sessionId, "session_resume", fixtureUrl, "SUCCESS");
    await ctx2.close();
    await browser2.close();

    logger("info", "ultron.browser.fixture_test.ok", { sessionId, steps });
    return { ok: true, steps, detail: "owned_fixture C2/C3 mechanics; not E5" };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    await record(pool, sessionId, "fixture_test", fixtureUrl, "FAILURE", err);
    await pool.query(
      `update ros_browser_sessions set state='FAILED', updated_at=now() where session_id=$1`,
      [sessionId],
    );
    logger("warn", "ultron.browser.fixture_test.failed", { err });
    return { ok: false, steps, detail: err };
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    releaseBrowserSlot();
  }
}

async function record(
  pool: pg.Pool,
  sessionId: string,
  kind: string,
  url: string,
  result: string,
  value?: string | null,
): Promise<void> {
  await pool.query(
    `insert into ros_browser_actions
       (action_id, session_id, kind, url, result, value, surface_class, evidence, created_at)
     values ($1,$2,$3,$4,$5,$6,'OWNED_SURFACE_BROWSER_PROOF',$7::jsonb, now())`,
    [
      `bra_${randomUUID().slice(0, 12)}`,
      sessionId,
      kind,
      url,
      result,
      value ?? null,
      JSON.stringify({ fixture: true, e5: false }),
    ],
  );
}
