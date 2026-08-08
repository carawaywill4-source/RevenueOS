import type { Metadata } from "next";
import { timingSafeEqual } from "node:crypto";
import { PRODUCT_OPPORTUNITIES } from "@/catalog/opportunities";
import { PRODUCTS } from "@/catalog/products";
import { BRAND } from "@/lib/brand";
import { buildMoneyPlan, getLastHourPulse, getWindowSnapshot, listJournal } from "@/lib/metrics";
import { ownerGates } from "@/lib/readiness";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase";
import {
  buildWorldModel,
  scoreOrganicMastery,
  summarizeCapabilityGaps,
} from "@tributeready/revenueos";
import { probeDurableLedger } from "@/revenueos/durable-store";
import { createMendhausAdapter } from "@/revenueos/adapter";

export const metadata: Metadata = {
  title: "Owner",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function tokenMatches(supplied: string | undefined) {
  const expected = process.env.OWNER_DASHBOARD_TOKEN || process.env.CRON_SECRET;
  if (!expected || !supplied) return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function OwnerPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  if (!tokenMatches(t)) {
    return (
      <main className="mx-auto max-w-xl px-6 py-24 text-ink/80">
        <h1 className="font-display text-3xl text-ink">Owner dashboard</h1>
        <p className="mt-4 text-sm">
          Private. Open with <code className="rounded bg-sand px-1">?t=TOKEN</code> using
          OWNER_DASHBOARD_TOKEN or CRON_SECRET.
        </p>
      </main>
    );
  }

  const [plan, hour, d7, journal, durable, adapter, pendingOrders, shippingNotes] =
    await Promise.all([
      buildMoneyPlan(7),
      getLastHourPulse(),
      getWindowSnapshot(7),
      listJournal(50),
      probeDurableLedger(),
      Promise.resolve(createMendhausAdapter()),
      supabaseConfigured()
        ? getSupabaseAdmin()
            .from("mh_orders")
            .select("id,email,status,items,gross_revenue_usd,shipping_address,paid_at,created_at")
            .in("status", ["paid", "fulfilling"])
            .order("paid_at", { ascending: true })
            .limit(20)
            .then((r) => r.data ?? [])
        : Promise.resolve([]),
      supabaseConfigured()
        ? getSupabaseAdmin()
            .from("mh_journal")
            .select("detail,created_at")
            .eq("kind", "order_shipping")
            .order("created_at", { ascending: false })
            .limit(40)
            .then((r) => r.data ?? [])
        : Promise.resolve([]),
    ]);
  const shippingByOrder = new Map<string, Record<string, unknown>>();
  for (const row of shippingNotes as Array<{ detail?: { orderId?: string; shippingAddress?: Record<string, unknown> } }>) {
    const orderId = row.detail?.orderId;
    if (orderId && row.detail?.shippingAddress) {
      shippingByOrder.set(orderId, row.detail.shippingAddress);
    }
  }
  const store = adapter.getExperimentStore();
  const [experiments, lessons, discoveryDoors, capabilityGaps, observation, context] =
    await Promise.all([
      store.listExperiments(BRAND.siteId),
      store.listLessons({ siteId: BRAND.siteId, industry: BRAND.industry }),
      adapter.listDiscoveryDoors ? adapter.listDiscoveryDoors() : Promise.resolve([]),
      store.listCapabilityGaps
        ? store.listCapabilityGaps(BRAND.siteId)
        : Promise.resolve([]),
      adapter.observe(),
      adapter.getContext(),
    ]);
  const gapSummary = summarizeCapabilityGaps(capabilityGaps);
  const world = buildWorldModel({
    context,
    observation,
    banditStats: new Map(),
  });
  const organicMastery = scoreOrganicMastery({
    observation,
    world,
    doors: discoveryDoors,
  });
  const gates = ownerGates();
  const running = experiments.filter((e) => e.status === "running" || e.status === "proposed");
  const winning = experiments
    .filter((e) => e.status === "won")
    .sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1))[0];

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 text-ink">
      <header className="mb-10">
        <p className="text-xs uppercase tracking-[0.2em] text-moss">RevenueOS · Mendhaus</p>
        <h1 className="mt-2 font-display text-4xl">Owner dashboard</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink/70">
          We are not trying to become popular. We are trying to become profitable. TributeReady
          remains customer 1; this store is customer 2 on the same portable brain.
        </p>
      </header>

      <section className="mb-10 rounded-2xl border border-line bg-paper p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-moss">Owner gates</h2>
        <p className="mt-2 text-sm text-ink/70">
          RevenueOS will not fake Stripe, suppliers, tax, or domain. Complete these yourself.
        </p>
        <ul className="mt-4 space-y-3 text-sm">
          {gates.map((gate) => (
            <li key={gate.id} className="flex gap-3">
              <span className={gate.done ? "text-moss" : "text-clay"}>{gate.done ? "✓" : "○"}</span>
              <div>
                <p className="font-medium">
                  {gate.href ? (
                    <a href={gate.href} className="underline" target="_blank" rel="noreferrer">
                      {gate.title}
                    </a>
                  ) : (
                    gate.title
                  )}
                </p>
                <p className="text-ink/65">{gate.why}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-ink/50">
          Durable RevenueOS ledger: {durable ? "connected" : "file fallback / not applied yet"}
        </p>
      </section>

      <section className="mb-10 rounded-2xl border border-line bg-paper p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-moss">
          Organic mastery era
        </h2>
        <p className="mt-2 text-sm text-ink/70">
          RevenueOS is the sole business manager. Ads stay locked until organic
          leads→sales is a weapon — not okay, mastery.
        </p>
        <p className="mt-4 font-display text-2xl text-ink">
          {organicMastery.level.toUpperCase()} · {organicMastery.score}/100 · ads{" "}
          {organicMastery.adsReadiness}
        </p>
        <p className="mt-2 text-sm text-ink/75">{organicMastery.verdict}</p>
        {organicMastery.drills.length > 0 ? (
          <ul className="mt-4 list-decimal space-y-1 pl-5 text-sm text-ink/70">
            {organicMastery.drills.map((drill) => (
              <li key={drill}>{drill}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="mb-10 rounded-2xl border border-line bg-paper p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-moss">
          Discovery doors (governor)
        </h2>
        <p className="mt-2 text-sm text-ink/70">
          Intent topics are scored after 3d/7d. Kill = stop cloning that cluster. Expand = invest more.
        </p>
        {discoveryDoors.length === 0 ? (
          <p className="mt-4 text-sm text-ink/65">No published discovery doors yet.</p>
        ) : (
          <ul className="mt-4 space-y-3 text-sm">
            {discoveryDoors.slice(0, 12).map((door) => (
              <li key={door.id} className="border-b border-line/70 pb-3">
                <p className="font-medium">
                  {door.status.toUpperCase()}
                  {door.lastScore ? ` · ${door.lastScore.verdict} · ${door.lastScore.stage}` : " · unscored"}
                  {" · "}
                  <a className="underline" href={door.url}>
                    /topics/{door.slug}
                  </a>
                </p>
                <p className="text-ink/65">
                  Query: {door.query} · cluster {door.clusterKey}
                </p>
                {door.lastScore ? (
                  <p className="text-xs text-ink/55">{door.lastScore.reason}</p>
                ) : null}
                {door.killReason ? (
                  <p className="text-xs text-clay">Killed: {door.killReason}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-10 rounded-2xl border border-line bg-paper p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-moss">
          Capability gaps
        </h2>
        <p className="mt-2 text-sm text-ink/70">
          High-EV moves RevenueOS wants but cannot execute yet. These train the next limbs of the portable brain.
        </p>
        {gapSummary.length === 0 ? (
          <p className="mt-4 text-sm text-ink/65">No capability gaps recorded yet.</p>
        ) : (
          <ul className="mt-4 space-y-3 text-sm">
            {gapSummary.map((gap) => (
              <li key={gap.missingCapability} className="border-b border-line/70 pb-3">
                <p className="font-medium">
                  CAPABILITY GAP: {gap.missingCapability.replace(/_/g, " ")} · {gap.importance.toUpperCase()}
                </p>
                <p className="text-ink/70">
                  Blocked {gap.timesBlocked} high-value opportunities · EV pressure $
                  {gap.expectedValueUsd.toFixed(0)}
                </p>
                <p className="text-xs text-ink/55">{gap.recommendation}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-10 rounded-2xl border border-line bg-paper p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-moss">
          Fulfillment queue
        </h2>
        <p className="mt-2 text-sm text-ink/70">
          Place the CJ order by hand, then mark shipped:{" "}
          <code className="rounded bg-sand px-1 text-xs">
            POST /api/admin/fulfill {"{"} orderId, trackingNumber, carrier {"}"}
          </code>
        </p>
        {(pendingOrders as Array<Record<string, unknown>>).length === 0 ? (
          <p className="mt-4 text-sm text-ink/65">No paid orders waiting on fulfillment.</p>
        ) : (
          <ul className="mt-4 space-y-4 text-sm">
            {(pendingOrders as Array<Record<string, unknown>>).map((order) => {
              const id = String(order.id);
              const ship =
                (order.shipping_address as Record<string, unknown> | null) ??
                shippingByOrder.get(id) ??
                null;
              const items = (order.items as Array<{ name: string; quantity: number }>) ?? [];
              return (
                <li key={id} className="border-b border-line/70 pb-4">
                  <p className="font-medium">
                    {String(order.status)} · ${Number(order.gross_revenue_usd ?? 0).toFixed(2)} ·{" "}
                    {String(order.email)}
                  </p>
                  <p className="text-xs text-ink/50">{id}</p>
                  <p className="mt-1 text-ink/75">
                    {items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
                  </p>
                  {ship ? (
                    <p className="mt-1 text-ink/70">
                      Ship to: {String(ship.name ?? "")}, {String(ship.line1 ?? "")}
                      {ship.line2 ? `, ${String(ship.line2)}` : ""}, {String(ship.city ?? "")}{" "}
                      {String(ship.state ?? "")} {String(ship.postal_code ?? "")}
                    </p>
                  ) : (
                    <p className="mt-1 text-clay">
                      No shipping address in DB yet — check Stripe session or run
                      schema-shipping-address.sql.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mb-10 rounded-2xl border border-line bg-paper p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-moss">Money plan (7 days)</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            ["Real revenue", `$${plan.revenueUsd.toFixed(2)}`],
            ["Orders", String(plan.orders)],
            ["AOV", `$${plan.aovUsd.toFixed(2)}`],
            ["COGS", `$${plan.cogsUsd.toFixed(2)}`],
            ["Gross profit", `$${plan.grossProfitUsd.toFixed(2)}`],
            ["Refunds", `$${plan.refundsUsd.toFixed(2)} (${plan.refundCount})`],
            ["Net contribution", `$${plan.netContributionUsd.toFixed(2)}`],
            ["Visitors", String(plan.visitors)],
            ["Conversion rate", `${(plan.conversionRate * 100).toFixed(2)}%`],
            ["Profit / visitor", `$${plan.profitPerVisitorUsd.toFixed(4)}`],
            ["Top channel", plan.topChannel ?? "—"],
            ["Top persona", plan.topPersona ?? "—"],
            ["Top angle", plan.topAngle ?? "—"],
            ["Top product", plan.topProductName ?? "—"],
            ["Top landing", plan.topLandingPage ?? "—"],
            ["Winning experiment", winning?.id ?? "—"],
            ["Exploration rate", plan.explorationRate.toFixed(2)],
            ["Learning confidence", plan.learningConfidence.toFixed(2)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-ink/55">{label}</dt>
              <dd className="text-lg">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-ink/55">
          Last hour: ${hour.revenueUsd.toFixed(2)} · {hour.purchases} orders · {hour.landingViews}{" "}
          views · {hour.zeroHour ? "ZERO HOUR — overdrive" : "non-zero"}
        </p>
      </section>

      <section className="mb-10 rounded-2xl border border-line bg-paper p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-moss">Funnel (7 days)</h2>
        <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
          {["landing_view", "product_view", "engagement", "add_to_cart", "checkout_started", "purchase"].map(
            (step) => (
              <li key={step}>
                {step.replaceAll("_", " ")}: {d7.events[step] ?? 0}
              </li>
            ),
          )}
        </ul>
      </section>

      <section className="mb-10 rounded-2xl border border-line bg-paper p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-moss">
          RevenueOS decision journal
        </h2>
        {journal.length === 0 ? (
          <p className="mt-4 text-sm text-ink/65">No cycles logged yet. Hourly cron writes here.</p>
        ) : (
          <ol className="mt-4 space-y-4 text-sm">
            {journal.map((row) => (
              <li key={String((row as { id: number }).id)}>
                <p className="text-xs text-ink/50">
                  {new Date(String((row as { created_at: string }).created_at)).toLocaleString()}
                </p>
                <p className="text-ink">{String((row as { summary: string }).summary)}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="mb-10 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-paper p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-moss">Experiments</h2>
          {running.length === 0 ? (
            <p className="mt-3 text-sm text-ink/65">None open. Next cron will propose organic bets.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {running.map((exp) => (
                <li key={exp.id}>
                  <span className="font-medium">{exp.status}</span> · {exp.hypothesis.title}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border border-line bg-paper p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-moss">
            Lessons (portable memory)
          </h2>
          <p className="mt-1 text-xs text-ink/50">
            Industry/global lessons persist across businesses — attaching RevenueOS
            to a new site loads this learning instead of starting over. Site =
            local only. ×N = evidence from repeated cycles/sites.
          </p>
          <ul className="mt-3 max-h-80 space-y-2 overflow-auto text-sm">
            {lessons.slice(0, 20).map((lesson) => (
              <li key={lesson.id}>
                <span className="text-xs uppercase text-moss">{lesson.scope}</span>
                {lesson.evidenceCount > 1 ? ` · ×${lesson.evidenceCount}` : ""}
                {lesson.originSiteIds && lesson.originSiteIds.length > 1
                  ? ` · ${lesson.originSiteIds.length} businesses`
                  : ""}{" "}
                · {lesson.summary}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mb-10 rounded-2xl border border-line bg-paper p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-moss">Catalog economics</h2>
        <p className="mt-2 text-sm text-ink/65">{PRODUCTS.length} live SKUs. Supplier SKUs are hints until you confirm.</p>
        <div className="mt-4 overflow-x-auto text-xs">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-line text-ink/55">
                <th className="py-2 pr-3">Product</th>
                <th className="py-2 pr-3">Price</th>
                <th className="py-2 pr-3">Est. profit</th>
                <th className="py-2 pr-3">Margin</th>
                <th className="py-2 pr-3">ETA</th>
                <th className="py-2">Network</th>
              </tr>
            </thead>
            <tbody>
              {PRODUCTS.map((p) => (
                <tr key={p.id} className="border-b border-line/60">
                  <td className="py-2 pr-3">{p.name}</td>
                  <td className="py-2 pr-3">${p.priceUsd.toFixed(0)}</td>
                  <td className="py-2 pr-3">${p.estimatedGrossProfitUsd.toFixed(2)}</td>
                  <td className="py-2 pr-3">{Math.round(p.marginRatio * 100)}%</td>
                  <td className="py-2 pr-3">
                    {p.supplier.etaDaysMin}–{p.supplier.etaDaysMax}d
                  </td>
                  <td className="py-2">{p.supplier.network}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-paper p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-moss">
          Product opportunities
        </h2>
        <ul className="mt-4 space-y-4 text-sm">
          {PRODUCT_OPPORTUNITIES.map((opp) => (
            <li key={opp.id}>
              <p className="font-medium">
                {opp.recommendedAction}: {opp.name}
              </p>
              <p className="text-ink/70">{opp.hypothesis}</p>
              <p className="text-xs text-ink/50">Confidence {opp.confidence.toFixed(2)}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
