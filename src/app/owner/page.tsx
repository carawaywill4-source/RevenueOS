import type { Metadata } from "next";
import { timingSafeEqual } from "node:crypto";
import { summarizeCapabilityGaps } from "@tributeready/revenueos";
import {
  buildGrowthSnapshot,
  formatExecutiveReport,
  type GrowthSnapshot,
} from "@/lib/growthos";
import { createTributeReadyAdapter } from "@/revenueos/adapter";

export const metadata: Metadata = {
  title: "Owner dashboard",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function tokenMatches(supplied: string | undefined) {
  const expected =
    process.env.OWNER_DASHBOARD_TOKEN || process.env.CRON_SECRET;
  if (!expected || !supplied) return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function Money({ snapshot }: { snapshot: GrowthSnapshot }) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
        Money (7-day)
      </h2>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {[
          ["Revenue", `$${snapshot.money.revenueUsd.toFixed(2)}`],
          ["Purchases", String(snapshot.money.purchases)],
          ["Awaiting payment", String(snapshot.money.awaitingPayment)],
          ["Refunds", String(snapshot.money.refunded)],
          [
            "Est. variable cost",
            `$${snapshot.money.estimatedVariableCostUsd.toFixed(2)}`,
          ],
          ["Est. profit", `$${snapshot.money.estimatedProfitUsd.toFixed(2)}`],
          ["MRR", `$${snapshot.money.mrr.toFixed(2)}`],
          ["ARR", `$${snapshot.money.arr.toFixed(2)}`],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-stone-500">{label}</dt>
            <dd className="text-lg text-stone-900">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default async function OwnerPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  if (!tokenMatches(t)) {
    return (
      <main className="mx-auto max-w-xl px-6 py-24 text-stone-700">
        <h1 className="font-serif text-3xl text-stone-900">Owner dashboard</h1>
        <p className="mt-4 text-sm leading-6">
          This page is private. Open it with the dashboard token as{" "}
          <code className="rounded bg-stone-100 px-1">?t=…</code>.
        </p>
      </main>
    );
  }

  const snapshot = await buildGrowthSnapshot();
  const report = formatExecutiveReport(snapshot);
  const adapter = createTributeReadyAdapter();
  const store = adapter.getExperimentStore();
  const capabilityGaps = store?.listCapabilityGaps
    ? await store.listCapabilityGaps(adapter.id)
    : [];
  const gapSummary = summarizeCapabilityGaps(capabilityGaps);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 text-stone-800">
      <header className="mb-10">
        <p className="text-xs tracking-[0.2em] text-stone-500 uppercase">
          RevenueOS · TributeReady adapter
        </p>
        <h1 className="mt-2 font-serif text-4xl text-stone-900">
          Owner dashboard
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          Generated {snapshot.generatedAt}. Not indexed.
          {snapshot.cycle
            ? ` Confidence ${snapshot.cycle.scorecard.confidence}.`
            : ""}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Money snapshot={snapshot} />

        <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
            Bottleneck
          </h2>
          <p className="mt-4 font-serif text-2xl text-stone-900">
            Level {snapshot.bottleneck.level} — {snapshot.bottleneck.label}
          </p>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            {snapshot.bottleneck.detail}
          </p>
          <p className="mt-6 text-sm leading-6">
            <span className="font-semibold text-stone-900">Next action:</span>{" "}
            {snapshot.nextAction}
          </p>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
          Capability gaps
        </h2>
        <p className="mt-2 text-sm text-stone-600">
          High-EV moves blocked by missing limbs (GSC, discovery publish,
          outreach). Training signal for the next RevenueOS capabilities.
        </p>
        {gapSummary.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500">
            No persisted gaps yet — they appear after cycles block high-EV
            plays.
          </p>
        ) : (
          <ul className="mt-4 space-y-3 text-sm">
            {gapSummary.map((gap) => (
              <li
                key={gap.missingCapability}
                className="border-b border-stone-100 pb-3 last:border-0"
              >
                <div className="font-medium text-stone-900">
                  {gap.missingCapability.replace(/_/g, " ")} ·{" "}
                  {gap.importance.toUpperCase()}
                </div>
                <p className="mt-1 text-stone-600">
                  Blocked {gap.timesBlocked}× · EV pressure $
                  {gap.expectedValueUsd.toFixed(0)}
                </p>
                <p className="mt-1 text-xs text-stone-500">{gap.recommendation}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {snapshot.cycle ? (
        <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
            RevenueOS scorecard
          </h2>
          {snapshot.cycle.hourPlan ? (
            <div
              className={`mt-4 rounded-xl border p-4 ${
                snapshot.cycle.hourPlan.overdrive
                  ? "border-rose-900 bg-rose-950 text-rose-50"
                  : "border-amber-200 bg-amber-50 text-amber-950"
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-xs font-semibold tracking-wide uppercase opacity-80">
                  Last hour · {snapshot.cycle.hourPlan.hourVerdict}
                  {snapshot.cycle.hourPlan.overdrive ? " · OVERDRIVE" : ""}
                </span>
                <span className="text-xs opacity-70">
                  $
                  {snapshot.cycle.hourPlan.lastHourRevenueUsd.toFixed(2)} ·{" "}
                  {snapshot.cycle.hourPlan.lastHourPurchases} sale(s)
                </span>
              </div>
              <p className="mt-2 text-sm leading-6">
                {snapshot.cycle.hourPlan.confession}
              </p>
              <p className="mt-3 text-sm leading-6">
                <span className="font-semibold">Learned last hour:</span>{" "}
                {snapshot.cycle.hourPlan.learnedFromLastHour}
              </p>
              <p className="mt-1 text-xs opacity-70">
                Next-hour bar: beat $
                {snapshot.cycle.hourPlan.nextHourBarUsd.toFixed(2)} · never give
                up
              </p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide opacity-80">
                Next hour — maximize profit
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6">
                {snapshot.cycle.hourPlan.nextHourMoves.map((move) => (
                  <li key={move.title}>
                    <span className="font-medium">{move.title}</span>
                    {move.ownerGated ? " (needs you)" : ""} — {move.why}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
          {snapshot.cycle.ambition ? (
            <div className="mt-4 rounded-xl border border-stone-900 bg-stone-900 p-4 text-stone-50">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-xs font-semibold tracking-wide text-stone-400 uppercase">
                  $10k-day north star ·{" "}
                  {snapshot.cycle.ambition.dayVerdict === "won_day"
                    ? "day won"
                    : "lost day"}{" "}
                  · aggression {snapshot.cycle.ambition.aggression}/3
                </span>
                <span className="text-xs text-stone-400">
                  {snapshot.cycle.ambition.concurrentBets} bet(s) this cycle
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-stone-100">
                {snapshot.cycle.ambition.verdict}
              </p>
              <p className="mt-2 text-xs text-stone-400">
                Shortfall $
                {(snapshot.cycle.ambition.shortfallUsd ?? 0).toFixed(0)} of $
                {(
                  snapshot.cycle.ambition.northStarDailyProfitUsd ?? 10_000
                ).toLocaleString()}{" "}
                · record $
                {snapshot.cycle.ambition.recordProfitUsd.toFixed(2)} → target $
                {snapshot.cycle.ambition.targetProfitUsd.toFixed(2)} · current $
                {snapshot.cycle.ambition.currentProfitUsd.toFixed(2)}
              </p>
              {snapshot.cycle.ambition.path ? (
                <p className="mt-2 text-xs text-stone-400">
                  Path: {snapshot.cycle.ambition.path.ordersNeeded} orders/day ·{" "}
                  {snapshot.cycle.ambition.path.bottleneckToClose}
                </p>
              ) : null}
            </div>
          ) : null}
          {snapshot.cycle.shortfall ? (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-sm font-semibold text-rose-900">
                Day accounting · {snapshot.cycle.shortfall.dayVerdict}
              </p>
              <p className="mt-1 text-sm leading-6 text-rose-900/90">
                {snapshot.cycle.shortfall.learningImperative}
              </p>
            </div>
          ) : null}
          {snapshot.cycle.curriculum || snapshot.cycle.regime ? (
            <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-4">
              {snapshot.cycle.regime ? (
                <p className="text-xs text-stone-500">
                  Regime:{" "}
                  <span className="font-medium text-stone-800">
                    {snapshot.cycle.regime.regime}
                  </span>{" "}
                  — {snapshot.cycle.regime.note}
                </p>
              ) : null}
              {snapshot.cycle.metaPolicy ? (
                <p className="mt-2 text-xs text-stone-500">
                  Meta: {snapshot.cycle.metaPolicy.reason}
                </p>
              ) : null}
              {snapshot.cycle.curriculum ? (
                <p className="mt-2 text-sm leading-6 text-stone-800">
                  <span className="font-semibold">Learn next:</span>{" "}
                  {snapshot.cycle.curriculum.priority} (
                  {snapshot.cycle.curriculum.focusCategory})
                </p>
              ) : null}
            </div>
          ) : null}
          {snapshot.cycle.moneyPlan ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-emerald-900">
                  Money machine · plan projection
                </p>
                <span className="text-xs text-emerald-700">
                  effort {snapshot.cycle.moneyPlan.effortUsed}/
                  {snapshot.cycle.moneyPlan.effortBudget}
                </span>
              </div>
              <p className="mt-1 font-serif text-3xl text-emerald-900">
                ~$
                {snapshot.cycle.moneyPlan.totalProjectedMonthlyProfitUsd.toFixed(
                  0,
                )}
                <span className="text-base text-emerald-700">/mo projected</span>
              </p>
              <p className="mt-1 text-xs text-emerald-700">
                {snapshot.cycle.moneyPlan.marginalDollar}
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-emerald-900/90">
                {snapshot.cycle.moneyPlan.items.slice(0, 5).map((item) => (
                  <li key={item.opportunityId}>
                    <span className="font-medium">{item.title}</span> — ~$
                    {item.projectedMonthlyProfitUsd.toFixed(0)}/mo ($
                    {item.profitPerEffort.toFixed(1)}/effort)
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              [
                "Experiments won / lost",
                `${snapshot.cycle.scorecard.experimentsWon} / ${snapshot.cycle.scorecard.experimentsLost}`,
              ],
              [
                "Open experiments",
                String(snapshot.cycle.scorecard.openExperiments),
              ],
              [
                "Attributed this cycle",
                String(snapshot.cycle.scorecard.attributionsClosed),
              ],
              [
                "Open EV pipeline",
                `$${snapshot.cycle.scorecard.expectedProfitPipelineUsd.toFixed(2)}`,
              ],
              [
                "Actions this cycle",
                String(snapshot.cycle.executed.length),
              ],
              [
                "Contribution profit",
                `$${snapshot.cycle.scorecard.contributionProfitUsd.toFixed(2)}`,
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-stone-500">{label}</dt>
                <dd className="text-base text-stone-900">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm leading-6 text-stone-600">
            <span className="font-semibold text-stone-900">Learning:</span>{" "}
            {snapshot.cycle.scorecard.learningDelta}
          </p>
          {snapshot.cycle.scorecard.forecast ? (
            <p className="mt-2 text-sm leading-6 text-stone-600">
              <span className="font-semibold text-stone-900">Forecast:</span>{" "}
              {snapshot.cycle.scorecard.forecast.note}
              {snapshot.cycle.scorecard.forecast.cyclesToFirstSale !== null
                ? ` (~${snapshot.cycle.scorecard.forecast.cyclesToFirstSale} cycles to first sale)`
                : ""}
            </p>
          ) : null}
          {snapshot.cycle.scorecard.unitEconomics ? (
            <p className="mt-2 text-sm leading-6 text-stone-600">
              <span className="font-semibold text-stone-900">Unit economics:</span>{" "}
              LTV ${snapshot.cycle.scorecard.unitEconomics.ltvUsd.toFixed(2)} · CAC
              ceiling $
              {snapshot.cycle.scorecard.unitEconomics.cacCeilingUsd.toFixed(2)} ·
              break-even{" "}
              {snapshot.cycle.scorecard.unitEconomics.breakEvenVisitors ?? "n/a"}{" "}
              visitors/sale
              {snapshot.cycle.scorecard.calibrationBrier !== undefined
                ? ` · calibration ${snapshot.cycle.scorecard.calibrationBrier}`
                : ""}
            </p>
          ) : null}
          {snapshot.cycle.anomalies && snapshot.cycle.anomalies.length ? (
            <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm leading-6 text-red-900">
              <span className="font-semibold">Anomalies:</span>
              <ul className="mt-1 list-disc pl-5">
                {snapshot.cycle.anomalies.map((a) => (
                  <li key={a.metric}>
                    <span className="uppercase">[{a.severity}]</span> {a.note}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {snapshot.cycle.scorecard.diagnosis ? (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
              <span className="font-semibold">Diagnosis:</span>{" "}
              {snapshot.cycle.scorecard.diagnosis}
            </p>
          ) : null}
          {snapshot.cycle.strategy && snapshot.cycle.strategy.steps.length ? (
            <div className="mt-4">
              <p className="text-sm font-semibold text-stone-900">
                Strategy · ~${snapshot.cycle.strategy.projectedProfitUsd.toFixed(0)}{" "}
                horizon profit
              </p>
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm leading-6 text-stone-600">
                {snapshot.cycle.strategy.steps.map((step) => (
                  <li key={step.opportunityId}>
                    <span className="font-medium text-stone-800">
                      {step.title}
                    </span>{" "}
                    — {step.rationale}
                    {step.blockedBy ? " (blocked until prior step lands)" : ""}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
            {[
              ["Business", snapshot.cycle.world.business.monetizationStage],
              ["Market discovery", snapshot.cycle.world.market.discoveryCoverage],
              ["Shopper friction", snapshot.cycle.world.shopper.primaryFriction],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-stone-500">{label}</dt>
                <dd className="text-stone-800 capitalize">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-stone-900">
                Audience & acquisition
              </p>
              <span className="text-xs text-stone-500">
                Sales difficulty{" "}
                {snapshot.cycle.world.audience.salesDifficulty.toFixed(2)} · resolve
                ×{snapshot.cycle.world.audience.resolveMultiplier} · traffic is
                never the excuse
              </span>
            </div>
            <p className="mt-1 text-xs text-stone-500">
              Personas:{" "}
              {snapshot.cycle.world.audience.personas
                .map((p) => p.label)
                .join(", ")}
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-stone-600">
              {snapshot.cycle.world.audience.channelPlan
                .slice(0, 5)
                .map((play) => (
                  <li key={play.patternKey}>
                    <span className="font-medium text-stone-800">
                      {play.channel.replace(/_/g, " ")}
                    </span>{" "}
                    <span className="text-xs text-stone-400">
                      [{play.intent} intent · fit {play.fit}]
                    </span>{" "}
                    — &ldquo;{play.angle}&rdquo;
                  </li>
                ))}
            </ol>
          </div>
          {snapshot.cycle.executed.length > 0 ? (
            <ul className="mt-4 space-y-2 text-sm text-stone-600">
              {snapshot.cycle.executed.map((item) => (
                <li key={`${item.action.type}-${item.result.detail}`}>
                  {item.action.type}: {item.result.ok ? "ok" : "fail"} —{" "}
                  {item.result.detail}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
          Funnel (7-day)
        </h2>
        <ul className="mt-4 divide-y divide-stone-100">
          {snapshot.funnel.steps.map((step) => (
            <li
              key={step.step}
              className="flex items-center justify-between py-3 text-sm"
            >
              <span className="font-medium text-stone-800">{step.step}</span>
              <span className="text-stone-600">
                {step.count}
                {step.dropRate !== null
                  ? ` · drop ${(step.dropRate * 100).toFixed(0)}%`
                  : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
          Ranked opportunities
        </h2>
        <ol className="mt-4 space-y-4">
          {snapshot.opportunities.map((item) => (
            <li key={item.id} className="rounded-xl bg-stone-50 p-4">
              <div className="flex items-baseline justify-between gap-4">
                <p className="font-medium text-stone-900">{item.title}</p>
                <p className="text-xs tracking-wide text-stone-500 uppercase">
                  score {item.score}
                </p>
              </div>
              <p className="mt-1 text-xs text-stone-500">
                Improves: {item.metric}
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-700">
                {item.action}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-6 rounded-2xl border border-stone-200 bg-stone-950 p-6 text-stone-100 shadow-sm">
        <h2 className="text-sm font-semibold tracking-wide text-stone-400 uppercase">
          Raw executive report
        </h2>
        <pre className="mt-4 overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-5 text-stone-200">
          {report}
        </pre>
      </section>
    </main>
  );
}
