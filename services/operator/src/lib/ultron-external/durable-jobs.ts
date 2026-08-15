/**
 * Durable economic jobs. The 5-minute tick is a wake-up, not the work unit.
 */

import { randomUUID, createHash } from "node:crypto";
import type pg from "pg";
import type { Logger } from "../ultron-core/types.js";
import { createHostingPlaneClient } from "../hosting-plane-client.js";
import { researchSurfacePolicy } from "./surface-intelligence.js";
import { researchMarketForBusiness } from "./market-intelligence.js";
import { gateProduct } from "./product-quality-gate.js";
import { runSiteCommerceQa } from "./site-commerce-qa.js";
import { upgradeFrontierDestination } from "./frontier-upgrade.js";

export type JobKind =
  | "DEPLOY_SITE"
  | "RESEARCH_SURFACE"
  | "MARKET_RESEARCH"
  | "PRODUCT_GATE"
  | "SITE_QA"
  | "TRUST_REPAIR"
  | "CHECKOUT_READY"
  | "FIRST_CUSTOMER_CYCLE";

async function ensureJobs(pool: pg.Pool): Promise<void> {
  /* Live schema already exists: ros_jobs(job_id, business_id, job_type, ...). Do not recreate. */
  await pool.query(`select 1 from ros_jobs limit 0`);
}

function jobIdFromKey(uniqueKey: string): string {
  return `ej_${createHash("sha1").update(uniqueKey).digest("hex").slice(0, 18)}`;
}

export async function enqueueJob(
  pool: pg.Pool,
  input: {
    kind: JobKind;
    businessId?: string;
    payload?: Record<string, unknown>;
    uniqueKey?: string;
  },
): Promise<string> {
  await ensureJobs(pool);
  const id = jobIdFromKey(input.uniqueKey ?? `${input.kind}:${input.businessId ?? "na"}:${randomUUID()}`);
  await pool.query(
    `insert into ros_jobs (job_id, business_id, job_type, priority, payload, status, attempts, scheduled_at)
     values ($1,$2,$3,80,$4::jsonb,'QUEUED',0, now())
     on conflict (job_id) do update set
       status='QUEUED', scheduled_at=now(), error=null, started_at=null, completed_at=null
     where ros_jobs.status='FAILED'
       and coalesce(ros_jobs.completed_at, ros_jobs.created_at) < now() - interval '20 minutes'`,
    [
      id,
      input.businessId || "_",
      input.kind,
      JSON.stringify(input.payload ?? {}),
    ],
  );
  return id;
}

async function mark(
  pool: pg.Pool,
  jobId: string,
  status: string,
  result?: unknown,
  err?: string,
): Promise<void> {
  await pool.query(
    `update ros_jobs set status=$2, result=$3::jsonb, error=$4, attempts=attempts+1, completed_at=now()
      where job_id=$1`,
    [jobId, status, JSON.stringify(result ?? {}), err ?? null],
  );
}

async function runOne(
  pool: pg.Pool,
  logger: Logger,
  job: { job_id: string; kind: string; business_id: string | null; payload: Record<string, unknown> },
): Promise<void> {
  const biz = job.business_id && job.business_id !== "_" ? job.business_id : "";
  if (job.kind === "DEPLOY_SITE" && biz) {
    const hp = createHostingPlaneClient();
    const available = await hp.available();
    if (!available) {
      await mark(pool, job.job_id, "QUEUED", { wait: "hosting_plane" }, "hosting_unavailable");
      return;
    }
    const appRoot = process.env.REVENUEOS_APP_ROOT || "/opt/revenueos/app";
    const dep = await hp.deploy({
      siteId: biz,
      appDir: `${appRoot}/apps/${biz}`,
      reason: "durable_job_deploy_site",
    });
    const ok = Boolean((dep as { ok?: boolean }).ok);
      await mark(pool, job.job_id, ok ? "SUCCEEDED" : "FAILED", dep, ok ? undefined : String((dep as { detail?: string }).detail));
    return;
  }
  if (job.kind === "RESEARCH_SURFACE") {
    const url = String(job.payload.url ?? "");
    if (!url) {
      await mark(pool, job.job_id, "FAILED", {}, "missing_url");
      return;
    }
    const researched = await researchSurfacePolicy(url);
    await pool.query(
      `update ros_external_surfaces
          set policy_class=$2, reason=$3, posting_allowed=$4, automation_allowed=$5,
              last_researched_at=now(), updated_at=now()
        where url=$1`,
      [url, researched.policyClass, researched.reason, researched.postingAllowed, researched.automationAllowed],
    );
      await mark(pool, job.job_id, "SUCCEEDED", researched);
    return;
  }
  if (job.kind === "MARKET_RESEARCH" && biz) {
    const r = await researchMarketForBusiness(pool, logger, {
      businessId: biz,
      industry: String(job.payload.industry ?? "unknown"),
      productName: String(job.payload.productName ?? biz),
      audience: String(job.payload.audience ?? "UNKNOWN"),
    });
    await mark(pool, job.job_id, "SUCCEEDED", r);
    return;
  }
  if (job.kind === "PRODUCT_GATE" && biz) {
    const g = await gateProduct(pool, logger, biz);
    await mark(pool, job.job_id, g.pass ? "SUCCEEDED" : "FAILED", g, g.pass ? undefined : g.defects.join(","));
    return;
  }
  if (job.kind === "SITE_QA" && biz) {
    const url = String(job.payload.url ?? `https://${biz}.130.131.15.68.sslip.io`);
    const qa = await runSiteCommerceQa(pool, logger, { businessId: biz, url, withBrowser: false });
    await mark(pool, job.job_id, qa.trafficReadySite ? "SUCCEEDED" : "FAILED", qa);
    return;
  }
  if (job.kind === "TRUST_REPAIR" && biz) {
    const up = await upgradeFrontierDestination(pool, logger, biz);
    await enqueueJob(pool, { kind: "DEPLOY_SITE", businessId: biz, uniqueKey: `deploy:${biz}:${Date.now()}` });
    await mark(pool, job.job_id, "SUCCEEDED", up);
    return;
  }
  if (job.kind === "CHECKOUT_READY" && biz) {
    const url = `https://${biz}.130.131.15.68.sslip.io/api/checkout/ready`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    const ok = Boolean(res?.ok && (body as { ok?: boolean }).ok);
    await mark(pool, job.job_id, ok ? "SUCCEEDED" : "FAILED", { status: res?.status, body });
    return;
  }
  await mark(pool, job.job_id, "FAILED", {}, `unsupported_kind:${job.kind}`);
}

export async function drainJobs(
  pool: pg.Pool,
  logger: Logger,
  input?: { budgetMs?: number; limit?: number },
): Promise<{ ran: number; done: number; failed: number; open: number }> {
  await ensureJobs(pool);
  const budget = input?.budgetMs ?? 90_000;
  const limit = input?.limit ?? 8;
  const t0 = Date.now();
  let ran = 0;
  let done = 0;
  let failed = 0;
  while (Date.now() - t0 < budget && ran < limit) {
    const q = await pool.query(
      `update ros_jobs set status='RUNNING', started_at=now(), heartbeat_at=now()
        where job_id = (
          select job_id from ros_jobs
           where status='QUEUED' and attempts < 8
           order by scheduled_at asc, created_at asc
           limit 1
        )
        returning job_id, job_type as kind, business_id, payload`,
    );
    if (!q.rows[0]) break;
    const job = q.rows[0] as {
      job_id: string;
      kind: string;
      business_id: string | null;
      payload: Record<string, unknown>;
    };
    ran++;
    try {
      await runOne(pool, logger, job);
    } catch (e) {
      await mark(pool, job.job_id, "QUEUED", {}, e instanceof Error ? e.message : String(e));
    }
    const st = await pool.query(`select status from ros_jobs where job_id=$1`, [job.job_id]);
    if (st.rows[0]?.status === "SUCCEEDED") done++;
    if (st.rows[0]?.status === "FAILED") failed++;
  }
  const open = await pool.query(`select count(*)::int as n from ros_jobs where status='QUEUED'`);
  logger("info", "ultron.jobs.drain", { ran, done, failed, open: open.rows[0]?.n ?? 0 });
  return { ran, done, failed, open: Number(open.rows[0]?.n ?? 0) };
}

export async function enqueueFrontierWork(
  pool: pg.Pool,
  businessId: string,
): Promise<void> {
  await enqueueJob(pool, { kind: "TRUST_REPAIR", businessId, uniqueKey: `trust:${businessId}` });
  await enqueueJob(pool, { kind: "DEPLOY_SITE", businessId, uniqueKey: `deploy:${businessId}:boot` });
  await enqueueJob(pool, { kind: "CHECKOUT_READY", businessId, uniqueKey: `checkout:${businessId}` });
  await enqueueJob(pool, { kind: "SITE_QA", businessId, uniqueKey: `qa:${businessId}` });
  await enqueueJob(pool, {
    kind: "MARKET_RESEARCH",
    businessId,
    uniqueKey: `market:${businessId}`,
    payload: { productName: businessId },
  });
  await enqueueJob(pool, { kind: "PRODUCT_GATE", businessId, uniqueKey: `product:${businessId}` });
}

export async function enqueuePortfolioRedeploy(pool: pg.Pool): Promise<number> {
  const r = await pool.query(
    `select site_id from ros_businesses where status in ('active','LAUNCHED','ACCEPTED','LIVE','LAUNCHING') limit 80`,
  );
  for (const row of r.rows) {
    await enqueueJob(pool, {
      kind: "DEPLOY_SITE",
      businessId: String(row.site_id),
      uniqueKey: `deploy:${row.site_id}:premium_v3`,
    });
  }
  return r.rows.length;
}
