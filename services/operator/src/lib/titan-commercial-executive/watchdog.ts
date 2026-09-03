/**
 * Commercial / traffic watchdog — escalate before owner notices.
 */

import { randomBytes } from "node:crypto";
import type pg from "pg";

function eid(): string {
  return `wd_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
}

export async function runCommercialWatchdog(input: {
  pool: pg.Pool;
  managed: string[];
}): Promise<{
  criticalFailures: number;
  stalls: number;
  details: Array<Record<string, unknown>>;
}> {
  const details: Array<Record<string, unknown>> = [];
  let criticalFailures = 0;
  let stalls = 0;

  for (const businessId of input.managed.slice(0, 40)) {
    const clocks = await input.pool.query(
      `select
         (select max(created_at) from aq_distribution_receipts
           where business_id=$1 and is_new_audience=true) as last_new_aud,
         (select max(created_at) from ros_traffic_events
           where business_id=$1 and class in ('LIKELY_HUMAN','QUALIFIED')) as last_human,
         (select count(*)::int from aq_distribution_receipts
           where business_id=$1 and is_new_audience=true
             and created_at > now() - interval '24 hours') as new_aud_24h,
         (select count(*)::int from titan_commercial_failures
           where business_id=$1 and created_at > now() - interval '24 hours') as fails_24h`,
      [businessId],
    );
    const row = clocks.rows[0] ?? {};
    const newAud24 = Number(row.new_aud_24h ?? 0);
    const fails24 = Number(row.fails_24h ?? 0);
    const lastNew = row.last_new_aud
      ? Date.parse(String(row.last_new_aud))
      : 0;
    const hoursSinceNew = lastNew
      ? (Date.now() - lastNew) / 3_600_000
      : 999;

    // Stall: commercially ready but no new-audience in 6h
    if (newAud24 === 0 && hoursSinceNew > 6) {
      stalls++;
      details.push({
        businessId,
        kind: "TRAFFIC_WATCHDOG_STALL",
        hoursSinceNew,
        fails24,
      });
    }

    // Critical: many failures + zero new-audience in 24h
    if (fails24 >= 3 && newAud24 === 0) {
      const open = await input.pool.query(
        `select 1 from titan_commercial_stagnation_incidents
         where business_id=$1 and kind='CRITICAL_COMMERCIAL_FAILURE'
           and status='OPEN' and created_at > now() - interval '12 hours' limit 1`,
        [businessId],
      );
      if (!open.rows[0]) {
        await input.pool.query(
          `insert into titan_commercial_stagnation_incidents
           (id, business_id, kind, diagnosis, escalation, status)
           values ($1,$2,'CRITICAL_COMMERCIAL_FAILURE',$3::jsonb,$4,'OPEN')`,
          [
            eid(),
            businessId,
            JSON.stringify({
              detectedBy: "commercial_watchdog",
              withoutOwnerPrompt: true,
              fails24,
              newAud24,
              hoursSinceNew,
            }),
            "Deep diagnosis: rotate channel families, open capability gaps, consider tournament challenge / pivot",
          ],
        );
        criticalFailures++;
        details.push({
          businessId,
          kind: "CRITICAL_COMMERCIAL_FAILURE",
          fails24,
        });
      }
    }
  }

  await input.pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ('commercial_watchdog_last', $1::jsonb, now(), 'NATIVE_POSTGRES')
     on conflict (key) do update set value=excluded.value, updated_at=now()`,
    [
      JSON.stringify({
        at: new Date().toISOString(),
        stalls,
        criticalFailures,
        details: details.slice(0, 20),
      }),
    ],
  );

  return { criticalFailures, stalls, details };
}
