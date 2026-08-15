import pg from "pg";
import {
  assessCommercialReadiness,
  admissionAllowed,
  COMMERCIAL_REPAIR_QUEUE_KEY,
} from "../lib/commercial-readiness.js";
import { COMMERCIAL_STATE_KEY } from "../lib/storefront-repair-executor.js";

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const canonical = "https://storelift-alpha.vercel.app";
  try {
    await pool.query(
      `update ros_businesses
       set app_url=$2,
           metadata = coalesce(metadata,'{}'::jsonb) || $3::jsonb,
           updated_at=now()
       where site_id=$1`,
      [
        "storelift",
        canonical,
        JSON.stringify({
          commercialRepair: {
            action: "RESTORE_PUBLIC_STOREFRONT",
            at: new Date().toISOString(),
            publicUrl: canonical,
            note: "storelift.vercel.app is unrelated; RevenueOS alias is storelift-alpha",
          },
        }),
      ],
    );

    const r = await assessCommercialReadiness({
      siteId: "storelift",
      pool,
      canonicalUrl: canonical,
    });
    console.log(
      JSON.stringify(
        {
          ready: r.ready,
          status: r.status,
          admissionAllowed: admissionAllowed(r),
          failures: r.failures,
          checks: r.checks,
          evidence: r.evidence,
          canonicalUrl: r.canonicalUrl,
        },
        null,
        2,
      ),
    );
    if (r.status !== "READY") process.exit(2);

    const res = await pool.query(
      `select value from ros_config_meta where key=$1`,
      [COMMERCIAL_STATE_KEY],
    );
    const doc = (res.rows[0]?.value ?? {}) as {
      businesses?: Record<string, unknown>;
    };
    const businesses = { ...(doc.businesses ?? {}) };
    businesses.storelift = {
      siteId: "storelift",
      state: "COMMERCIAL_READY",
      gateVersion: r.gateVersion,
      failures: [],
      updatedAt: new Date().toISOString(),
      acquisitionSuppressed: false,
      grandfatheredManaged: true,
      publicVerifiedAt: new Date().toISOString(),
      attempts: 1,
      lastAction: "RESTORE_PUBLIC_STOREFRONT",
      lastDetail: `public verify on ${canonical}`,
    };
    await pool.query(
      `insert into ros_config_meta (key, value, updated_at, provenance)
       values ($1,$2::jsonb,now(),'COMMERCIAL_STATE')
       on conflict (key) do update set
         value=excluded.value, updated_at=now(), provenance='COMMERCIAL_STATE'`,
      [
        COMMERCIAL_STATE_KEY,
        JSON.stringify({
          version: "storefront-repair-v1",
          updatedAt: new Date().toISOString(),
          businesses,
        }),
      ],
    );

    const q = await pool.query(
      `select value from ros_config_meta where key=$1`,
      [COMMERCIAL_REPAIR_QUEUE_KEY],
    );
    const qdoc = (q.rows[0]?.value ?? { items: [] }) as {
      items?: Array<Record<string, unknown>>;
    };
    const items = (qdoc.items ?? []).map((item) =>
      item.siteId === "storelift"
        ? {
            ...item,
            status: "completed",
            note: `public verification passed on ${canonical}`,
            lastAttemptAt: new Date().toISOString(),
          }
        : item,
    );
    await pool.query(
      `insert into ros_config_meta (key, value, updated_at, provenance)
       values ($1,$2::jsonb,now(),'COMMERCIAL_REPAIR_QUEUE')
       on conflict (key) do update set
         value=excluded.value, updated_at=now(),
         provenance='COMMERCIAL_REPAIR_QUEUE'`,
      [
        COMMERCIAL_REPAIR_QUEUE_KEY,
        JSON.stringify({
          gateVersion: r.gateVersion,
          updatedAt: new Date().toISOString(),
          items,
        }),
      ],
    );
    console.log("STATE_UPDATED_COMMERCIAL_READY");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
