/**
 * Product / service cannot be commercially active merely because a file exists.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type pg from "pg";
import type { Logger } from "../ultron-core/types.js";
import { recordWorldFact } from "../ultron-core/world-model.js";

export type ProductGate = {
  businessId: string;
  pass: boolean;
  usefulness: number;
  completeness: number;
  accuracy: number;
  relevance: number;
  clarity: number;
  defects: string[];
  files: number;
  bytes: number;
};

function appRoot(): string {
  return process.env.REVENUEOS_APP_ROOT || process.env.APP_ROOT || "/opt/revenueos/app";
}

function walkProductFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walkProductFiles(p));
    else if (/\.(md|txt|pdf|csv|json)$/i.test(name)) out.push(p);
  }
  return out;
}

export function evaluateProductFiles(businessId: string): ProductGate {
  const root = appRoot();
  const dirs = [
    path.join(root, "apps", businessId, "content", "product"),
    path.join(root, "apps", businessId, "content"),
  ];
  const files = dirs.flatMap(walkProductFiles);
  const defects: string[] = [];
  let bytes = 0;
  let filler = 0;
  let substance = 0;
  for (const f of files) {
    const body = readFileSync(f, "utf8");
    bytes += body.length;
    if (body.length < 400) filler++;
    if (/replace bracketed fields|thanks for purchasing|files in this pack/i.test(body)) filler++;
    if (body.split(/\n/).filter((l) => l.trim().length > 40).length >= 8) substance++;
  }
  if (files.length === 0) defects.push("no_product_files");
  if (bytes < 2_000) defects.push("product_too_thin");
  if (filler >= files.length && files.length > 0) defects.push("template_filler");
  if (substance === 0) defects.push("no_substantive_deliverable");

  const completeness = Math.min(100, files.length * 18 + Math.min(40, Math.floor(bytes / 200)));
  const usefulness = substance > 0 ? Math.min(70, 20 + substance * 15) : 12;
  const clarity = files.length > 0 ? 40 : 10;
  const accuracy = 35; // UNKNOWN without buyer evidence
  const relevance = files.length > 0 ? 40 : 10;
  const pass = defects.length === 0 && usefulness >= 40 && completeness >= 50;
  return {
    businessId,
    pass,
    usefulness,
    completeness,
    accuracy,
    relevance,
    clarity,
    defects,
    files: files.length,
    bytes,
  };
}

export async function gateProduct(
  pool: pg.Pool,
  logger: Logger,
  businessId: string,
): Promise<ProductGate> {
  const gate = evaluateProductFiles(businessId);
  await pool.query(`
    create table if not exists ros_product_gates (
      business_id text primary key,
      pass boolean not null,
      usefulness numeric not null,
      completeness numeric not null,
      defects jsonb not null default '[]'::jsonb,
      evidence jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    )
  `);
  await pool.query(
    `insert into ros_product_gates (business_id, pass, usefulness, completeness, defects, evidence, updated_at)
     values ($1,$2,$3,$4,$5::jsonb,$6::jsonb, now())
     on conflict (business_id) do update set
       pass=excluded.pass, usefulness=excluded.usefulness, completeness=excluded.completeness,
       defects=excluded.defects, evidence=excluded.evidence, updated_at=now()`,
    [
      businessId,
      gate.pass,
      gate.usefulness,
      gate.completeness,
      JSON.stringify(gate.defects),
      JSON.stringify(gate),
    ],
  );
  await recordWorldFact(pool, {
    entityKind: "business",
    entityId: businessId,
    predicate: "product_quality_gate",
    value: { ...gate },
    source: "ultron.product-quality-gate",
    confidence: 0.7,
    ttlHours: 24,
  });
  logger("info", "ultron.product.gate", {
    businessId,
    pass: gate.pass,
    defects: gate.defects,
    files: gate.files,
    bytes: gate.bytes,
  });
  return gate;
}
