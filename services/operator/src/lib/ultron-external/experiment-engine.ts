/**
 * Money-first experiment engine + commercial-scientist loop.
 * Prioritizes expected dollars, not activity.
 */

import type pg from "pg";
import type { Logger } from "../ultron-core/types.js";
import { applyCognitiveEscalation } from "./cognitive-escalation.js";

export async function runCommercialScientistTick(
  pool: pg.Pool,
  logger: Logger,
): Promise<{ experiments: number; next: string }> {
  await pool.query(`
    create table if not exists ros_money_experiments (
      experiment_id text primary key,
      hypothesis text not null,
      expected_value_usd numeric not null default 0,
      status text not null default 'PROPOSED',
      result jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await applyCognitiveEscalation(pool, logger, {
    taskKind: "commercial_scientist_prioritize",
    taskValueUsd: 0,
    novelty: 0.3,
    failureCount: 0,
    uncertainty: 0.4,
    architectureScope: false,
    risk: "LOW",
    economicMilestone: "E5",
    modelCostUsd: 0,
    availableBudgetUsd: 5,
  });

  const humans = await pool.query(
    `select count(*)::int as n from ros_traffic_events where class='VERIFIED_HUMAN_SIGNAL'`,
  );
  const customers = await pool.query(
    `select count(*)::int as n from ros_customer_events where kind in ('PAYMENT_SUCCEEDED','CHECKOUT_COMPLETED')`,
  ).catch(() => ({ rows: [{ n: 0 }] }));
  const e5 = Number(humans.rows[0]?.n ?? 0) === 0;
  const next = e5
    ? "obtain_legitimate_audience_exposure"
    : Number(customers.rows[0]?.n ?? 0) === 0
      ? "convert_verified_human_to_customer"
      : "repeat_profitable_mechanism";

  await pool.query(
    `insert into ros_money_experiments
       (experiment_id, hypothesis, expected_value_usd, status, result, updated_at)
     values ($1,$2,$3,'PROPOSED',$4::jsonb, now())
     on conflict (experiment_id) do update set
       result = excluded.result, updated_at = now()`,
    [
      `exp_money_first_${next}`,
      `Until E5/E9 are proven, every cycle must attack ${next}.`,
      next.includes("customer") ? 50 : 10,
      JSON.stringify({
        verifiedHumans: Number(humans.rows[0]?.n ?? 0),
        customers: Number(customers.rows[0]?.n ?? 0),
        at: new Date().toISOString(),
      }),
    ],
  );

  logger("info", "ultron.scientist.tick", { next, humans: Number(humans.rows[0]?.n ?? 0) });
  return { experiments: 1, next };
}
