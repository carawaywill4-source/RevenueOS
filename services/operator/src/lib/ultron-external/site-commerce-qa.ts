/**
 * Website trust engine + design/buyer/commercial critics + owned visual QA.
 * Owned browser runs are C2/C3 evidence only — never E5.
 */

import type pg from "pg";
import type { Logger } from "../ultron-core/types.js";
import { recordWorldFact } from "../ultron-core/world-model.js";
import { verifyPublicArtifactExists } from "./browser-operator.js";
import { detectSlop } from "./premium-site-system.js";
import { isOwnedSurface } from "../traffic-classify.js";

export type CriticFinding = {
  critic: "BUYER" | "DESIGN" | "COMMERCIAL" | "TRUST";
  ok: boolean;
  note: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
};

export type SiteQaResult = {
  businessId: string;
  url: string;
  trustScore: number;
  trafficReadySite: boolean;
  findings: CriticFinding[];
  desktopQa?: { ok: boolean; screenshot?: string; error?: string };
  mobileQa?: { ok: boolean; screenshot?: string; error?: string };
};

async function fetchHtml(url: string): Promise<{ ok: boolean; html: string; status: number }> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": "RevenueOS-site-qa/1.0" },
      signal: AbortSignal.timeout(8_000),
    });
    return { ok: res.ok, html: (await res.text()).slice(0, 250_000), status: res.status };
  } catch {
    return { ok: false, html: "", status: 0 };
  }
}

export function critiqueHtml(html: string, url: string): CriticFinding[] {
  const findings: CriticFinding[] = [];
  const hasPrice = /\$\s?\d|pricing/i.test(html);
  const hasCheckout = /checkout|buy now|purchase|stripe/i.test(html);
  const hasPrivacy = /privacy/i.test(html);
  const hasTerms = /terms/i.test(html);
  const hasContact = /mailto:|contact/i.test(html);
  const hasFaq = /faq|questions/i.test(html);
  const hasNav = /<nav|site-nav/i.test(html);
  const hasFooter = /<footer/i.test(html);
  const slop = detectSlop(html);

  findings.push({
    critic: "BUYER",
    ok: hasPrice && hasCheckout,
    note: hasPrice && hasCheckout ? "price and purchase path present" : "buyer cannot see price or how to buy",
    severity: hasPrice && hasCheckout ? "LOW" : "HIGH",
  });
  findings.push({
    critic: "BUYER",
    ok: hasFaq,
    note: hasFaq ? "FAQ present" : "no FAQ addressing objections",
    severity: hasFaq ? "LOW" : "MEDIUM",
  });
  findings.push({
    critic: "DESIGN",
    ok: hasNav && hasFooter,
    note: hasNav && hasFooter ? "nav+footer structure" : "missing nav or footer — template/thin layout",
    severity: hasNav && hasFooter ? "LOW" : "MEDIUM",
  });
  findings.push({
    critic: "DESIGN",
    ok: slop.length === 0,
    note: slop.length ? `slop:${slop.join(",")}` : "no generic-slop markers",
    severity: slop.length ? "HIGH" : "LOW",
  });
  findings.push({
    critic: "COMMERCIAL",
    ok: hasPrice && hasCheckout,
    note: "offer path requires visible price + checkout",
    severity: hasPrice && hasCheckout ? "LOW" : "HIGH",
  });
  findings.push({
    critic: "TRUST",
    ok: hasPrivacy && hasTerms && hasContact,
    note: `privacy=${hasPrivacy} terms=${hasTerms} contact=${hasContact} https=${url.startsWith("https")}`,
    severity: hasPrivacy && hasContact ? "LOW" : "HIGH",
  });
  return findings;
}

export function trustScoreFrom(findings: CriticFinding[], htmlOk: boolean): number {
  let score = htmlOk ? 35 : 5;
  for (const f of findings) {
    if (f.ok) score += 8;
    else if (f.severity === "HIGH") score -= 12;
    else if (f.severity === "MEDIUM") score -= 6;
  }
  return Math.max(0, Math.min(100, score));
}

export async function runSiteCommerceQa(
  pool: pg.Pool,
  logger: Logger,
  input: { businessId: string; url: string; withBrowser?: boolean },
): Promise<SiteQaResult> {
  const page = await fetchHtml(input.url);
  const findings = critiqueHtml(page.html, input.url);
  const trust = trustScoreFrom(findings, page.ok);

  for (const f of findings.filter((x) => !x.ok && x.severity !== "LOW")) {
    await pool.query(
      `insert into ros_trust_defects (defect_id, business_id, kind, detail, severity)
       values ($1,$2,'TRUST_DEFECT',$3,$4)
       on conflict (defect_id) do update set detail=excluded.detail, status='OPEN'`,
      [`td_${input.businessId}_${f.critic}_${f.note}`.slice(0, 80), input.businessId, f.note, f.severity],
    );
  }

  const result: SiteQaResult = {
    businessId: input.businessId,
    url: input.url,
    trustScore: trust,
    trafficReadySite: page.ok && trust >= 55 && findings.every((f) => f.ok || f.severity !== "HIGH"),
    findings,
  };

  if (input.withBrowser && isOwnedSurface(input.url)) {
    const recentQa = await pool.query(
      `select updated_at from ros_site_qa where business_id=$1 and updated_at > now() - interval '6 hours'`,
      [input.businessId],
    ).catch(() => ({ rows: [] as unknown[] }));
    if (recentQa.rows.length === 0) {
    const desk = await verifyPublicArtifactExists(pool, logger, {
      url: input.url,
      businessId: input.businessId,
      sessionPurpose: "owned_visual_qa_desktop",
    });
    result.desktopQa = desk.ok
      ? { ok: true, screenshot: desk.value.screenshot }
      : { ok: false, error: desk.error };
    // Mobile is a second owned screenshot; skip if desktop failed (RAM).
    if (desk.ok) {
      const mobileUrl = input.url;
      const mob = await verifyPublicArtifactExists(pool, logger, {
        url: mobileUrl,
        businessId: input.businessId,
        sessionPurpose: "owned_visual_qa_mobile",
      });
      result.mobileQa = mob.ok
        ? { ok: true, screenshot: mob.value.screenshot }
        : { ok: false, error: mob.error };
    }
    }
  }

  await pool.query(`
    create table if not exists ros_site_qa (
      business_id text primary key,
      url text not null,
      trust_score numeric not null,
      traffic_ready_site boolean not null,
      findings jsonb not null default '[]'::jsonb,
      desktop_qa jsonb,
      mobile_qa jsonb,
      updated_at timestamptz not null default now()
    )
  `);
  await pool.query(
    `insert into ros_site_qa
       (business_id, url, trust_score, traffic_ready_site, findings, desktop_qa, mobile_qa, updated_at)
     values ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb, now())
     on conflict (business_id) do update set
       url=excluded.url, trust_score=excluded.trust_score, traffic_ready_site=excluded.traffic_ready_site,
       findings=excluded.findings, desktop_qa=excluded.desktop_qa, mobile_qa=excluded.mobile_qa, updated_at=now()`,
    [
      input.businessId,
      input.url,
      result.trustScore,
      result.trafficReadySite,
      JSON.stringify(result.findings),
      JSON.stringify(result.desktopQa ?? null),
      JSON.stringify(result.mobileQa ?? null),
    ],
  );
  await recordWorldFact(pool, {
    entityKind: "business",
    entityId: input.businessId,
    predicate: "site_qa",
    value: {
      trust: result.trustScore,
      trafficReadySite: result.trafficReadySite,
      findings: result.findings,
      evidenceClass: "OWNED_SURFACE_BROWSER_PROOF",
      e5: false,
    },
    source: "ultron.site-commerce-qa",
    confidence: 0.65,
    ttlHours: 24,
  });
  logger("info", "ultron.site.qa", {
    businessId: input.businessId,
    trust: result.trustScore,
    trafficReadySite: result.trafficReadySite,
    desktop: result.desktopQa?.ok ?? null,
  });
  return result;
}
