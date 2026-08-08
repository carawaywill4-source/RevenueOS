import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("policy keeps the brain inside hard boundaries", async () => {
  const { policyAllows, classifyActionType } = await import(
    "@tributeready/revenueos"
  );
  assert.equal(classifyActionType("indexnow_submit"), "safe");
  assert.equal(classifyActionType("spend_ads"), "owner_gate");
  assert.equal(classifyActionType("delete_production_data"), "forbidden");
  assert.equal(
    policyAllows({
      type: "rewrite_page_copy",
      risk: "owner_gate",
      description: "no",
    }).ok,
    false,
  );
});

test("a single cycle runs the full Observe→Model→ROI→Prioritize→Learn loop", async () => {
  const { createExampleStaticAdapter, runCycle } = await import(
    "@tributeready/revenueos"
  );
  const dir = await mkdtemp(path.join(tmpdir(), "revenueos-loop-"));
  const adapter = createExampleStaticAdapter(dir);
  const result = await runCycle(adapter);

  assert.equal(adapter.id, "example-static");
  // Model
  assert.ok(result.world.business);
  assert.ok(result.world.market.discoveryCoverage);
  assert.ok(result.world.shopper.primaryFriction);
  // Opportunities carry dollar-denominated ROI
  assert.ok(result.opportunities.length >= 1);
  assert.ok(
    result.opportunities.every((o) => typeof o.predicted?.expectedProfitUsd === "number"),
    "every opportunity must have a predicted profit",
  );
  // Scorecard + report
  assert.ok(result.scorecard.confidence > 0);
  assert.match(result.reportText, /RevenueOS cycle/);
  assert.match(result.reportText, /WORLD MODEL/);
  assert.ok(result.lessons.length >= 1, "seed lessons should load");

  // Objective: at pre-revenue the top lever must move a money precursor, never
  // a zero-value maintenance chore.
  const top = result.opportunities[0];
  assert.notEqual(
    top.category,
    "operations",
    "maintenance must not outrank acquisition when there is no revenue to protect",
  );
  assert.ok(
    (top.predicted?.expectedProfitUsd ?? 0) > 0,
    "the top lever must have positive expected profit",
  );
});

test("the brain changes future behavior after a loss (attribution → learning)", async () => {
  const { createExampleStaticAdapter, runCycle, newId } = await import(
    "@tributeready/revenueos"
  );
  const dir = await mkdtemp(path.join(tmpdir(), "revenueos-learn-"));
  const adapter = createExampleStaticAdapter(dir);
  const store = adapter.getExperimentStore();

  // Cycle 1: establish a baseline ranking for the discovery lever.
  const first = await runCycle(adapter);
  const indexOppBefore = first.opportunities.find(
    (o) => o.patternKey === "indexnow-discovery",
  );
  assert.ok(indexOppBefore, "discovery lever should be proposed pre-revenue");
  const scoreBefore = indexOppBefore!.score;

  // Inject a completed-but-unattributed experiment for that lever whose signal
  // window has already elapsed and whose measured metric REGRESSED (a loss).
  const past = new Date(Date.now() - 30 * 86_400_000).toISOString();
  await store.saveExperiment({
    id: newId("exp"),
    siteId: "example-static",
    status: "running",
    hypothesis: {
      id: "hyp_index-known-urls",
      title: "Get public URLs discovered and indexed",
      metric: "indexed URLs",
      predictedDelta: "more traffic",
      confidence: 0.55,
      effort: 1,
      expectedImpact: 7,
      action: "submit URLs",
      category: "acquisition",
      precursorMetric: "landing_views",
      patternKey: "indexnow-discovery",
      constraintsChecked: [],
    },
    actions: [],
    predictedOutcome: "more traffic",
    category: "acquisition",
    measurement: {
      metric: "landing_views",
      baselineValue: 9999, // current observed landing (12) is far below → loss
      targetDelta: 100,
      timeToSignalDays: 14,
      scheduledCheckAt: past,
    },
    createdAt: past,
    updatedAt: past,
  });

  // Cycle 2: the brain should attribute the loss, record a negative lesson, and
  // downrank the losing lever rather than repeating it.
  const second = await runCycle(adapter);

  assert.ok(
    second.attributions.some((a) => a.verdict === "lost"),
    "the elapsed regressed experiment must be attributed as a loss",
  );
  assert.ok(
    second.lessons.some((l) => l.sentiment === "negative"),
    "a loss must produce a negative lesson",
  );
  const indexOppAfter = second.opportunities.find(
    (o) => o.patternKey === "indexnow-discovery",
  );
  assert.ok(indexOppAfter, "lever still visible but should be suppressed");
  assert.ok(
    indexOppAfter!.score < scoreBefore,
    `losing lever must be downranked (before ${scoreBefore}, after ${indexOppAfter!.score})`,
  );

  const attributions = await store.listAttributions("example-static");
  assert.ok(attributions.length >= 1, "attribution must be persisted");
});

test("Bayesian confidence shrinks on thin data and updates with evidence", async () => {
  const { evidenceConfidence, shrinkForSample, wilsonInterval } = await import(
    "@tributeready/revenueos"
  );
  // A confident prior barely moves with almost no data.
  const thin = evidenceConfidence(0.8, 0, 1);
  assert.ok(thin < 0.8 && thin > 0.5, `thin should regress toward prior mass: ${thin}`);
  // Strong contradicting evidence pulls confidence down materially.
  const contradicted = evidenceConfidence(0.8, 5, 100);
  assert.ok(contradicted < 0.3, `strong losses should crush confidence: ${contradicted}`);
  // Sample shrink pulls toward 0.5 when under the minimum.
  assert.ok(shrinkForSample(0.9, 3, 30) < 0.6);
  assert.equal(shrinkForSample(0.9, 100, 30), 0.9);
  const w = wilsonInterval(2, 10);
  assert.ok(w.lower < w.mean && w.mean < w.upper);
});

test("calibration scales EV down for an over-promising category", async () => {
  const { buildCalibration, calibrationFactor } = await import(
    "@tributeready/revenueos"
  );
  const now = new Date().toISOString();
  // Acquisition predicted ~0.7 win prob but actually lost every time.
  const experiments = [1, 2, 3, 4].map((n) => ({
    id: `exp_${n}`,
    siteId: "s",
    status: "lost" as const,
    hypothesis: {
      id: `h${n}`,
      title: "t",
      metric: "m",
      predictedDelta: "",
      confidence: 0.7,
      effort: 2,
      expectedImpact: 6,
      action: "a",
      category: "acquisition" as const,
      constraintsChecked: [],
    },
    actions: [],
    predictedOutcome: "",
    category: "acquisition" as const,
    createdAt: now,
    updatedAt: now,
  }));
  const attributions = experiments.map((e, i) => ({
    id: `attr_${i}`,
    experimentId: e.id,
    siteId: "s",
    metric: "landing_views" as const,
    baselineValue: 100,
    postValue: 90,
    delta: -10,
    verdict: "lost" as const,
    confidence: 0.6,
    createdAt: now,
  }));
  const model = buildCalibration(experiments, attributions);
  const factor = calibrationFactor(model, "acquisition");
  assert.ok(factor < 1, `over-promising category must be scaled down: ${factor}`);
  assert.ok(model.overall.brier > 0);
});

test("bandit rewards proven winners and explores novel patterns", async () => {
  const { banditStatsFromExperiments, banditMultiplier } = await import(
    "@tributeready/revenueos"
  );
  const now = new Date().toISOString();
  const mk = (id: string, patternKey: string, status: "won" | "lost") => ({
    id,
    siteId: "s",
    status,
    hypothesis: {
      id: `h_${id}`,
      title: "t",
      metric: "m",
      predictedDelta: "",
      confidence: 0.5,
      effort: 1,
      expectedImpact: 5,
      action: "a",
      patternKey,
      constraintsChecked: [],
    },
    actions: [],
    predictedOutcome: "",
    createdAt: now,
    updatedAt: now,
  });
  const experiments = [
    mk("1", "winner", "won"),
    mk("2", "winner", "won"),
    mk("3", "loser", "lost"),
    mk("4", "loser", "lost"),
  ];
  const stats = banditStatsFromExperiments(experiments);
  const winnerMult = banditMultiplier("winner", stats);
  const loserMult = banditMultiplier("loser", stats);
  const noveltyMult = banditMultiplier("never-tried", stats);
  assert.ok(winnerMult > loserMult, "winners should outrank losers");
  assert.ok(
    noveltyMult > loserMult,
    "an untested lever should get an exploration bonus over a proven loser",
  );
});

test("forecast estimates cycles to first sale from a rising traffic trend", async () => {
  const { buildForecast } = await import("@tributeready/revenueos");
  const base = {
    generatedAt: "",
    siteId: "s",
    revenueUsd: 0,
    contributionProfitUsd: 0,
    purchases: 0,
    visitorToPurchase: null,
    experimentsWon: 0,
    experimentsLost: 0,
    openExperiments: 0,
    failures: 0,
    confidence: 0.2,
    bottleneckLevel: 4 as const,
    nextAction: "",
    topOpportunities: [],
    expectedProfitPipelineUsd: 0,
    attributionsClosed: 0,
    learningDelta: "",
  };
  // newest-first (as listScorecards returns): traffic 40, 30, 20, 10
  const scorecards = [
    { ...base, landingViews: 40 },
    { ...base, landingViews: 30 },
    { ...base, landingViews: 20 },
    { ...base, landingViews: 10 },
  ];
  const forecast = buildForecast(scorecards, 0.01);
  assert.ok(forecast.trafficSlopePerCycle > 0, "rising traffic → positive slope");
  assert.ok(
    typeof forecast.cyclesToFirstSale === "number" &&
      forecast.cyclesToFirstSale! > 0,
    "should project a positive number of cycles to first sale",
  );
});

test("counterfactual attribution: no credit for organic trend", async () => {
  const { attributeExperiment } = await import("@tributeready/revenueos");
  const experiment = {
    id: "exp1",
    siteId: "s",
    status: "running" as const,
    hypothesis: {
      id: "h",
      title: "t",
      metric: "landing views",
      predictedDelta: "+",
      confidence: 0.5,
      effort: 1,
      expectedImpact: 5,
      action: "a",
      constraintsChecked: [],
    },
    actions: [],
    predictedOutcome: "more traffic",
    measurement: {
      metric: "landing_views" as const,
      baselineValue: 100,
      targetDelta: 20,
      timeToSignalDays: 0,
      scheduledCheckAt: new Date(Date.now() - 86_400_000).toISOString(),
    },
    createdAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
    updatedAt: new Date().toISOString(),
  };
  // Metric rose to 130 but trend alone predicted 128 — only +2 causal < target.
  const beatsTrend = attributeExperiment(experiment, 130, new Date(), 128);
  assert.equal(
    beatsTrend.attribution.verdict,
    "inconclusive",
    "beating baseline but not the trend should not be a win",
  );
  // Same raw value, but if the trend predicted only 105, causal lift is +25 ≥ target.
  const realWin = attributeExperiment(experiment, 130, new Date(), 105);
  assert.equal(realWin.attribution.verdict, "won");
});

test("value of information rewards under-explored high-upside levers", async () => {
  const { valueOfInformation } = await import("@tributeready/revenueos");
  const opp = (patternKey: string) => ({
    id: patternKey,
    title: "t",
    action: "a",
    metric: "m",
    rationale: "r",
    score: 1,
    effort: 1,
    expectedImpact: 5,
    confidence: 0.5,
    patternKey,
    predicted: {
      precursorMetric: "landing_views" as const,
      expectedProfitUsd: 100,
      confidence: 0.5,
      effort: 1,
      costUsd: 0,
      timeToSignalDays: 7,
    },
  });
  const stats = new Map([
    [
      "known",
      { patternKey: "known", wins: 8, losses: 2, trials: 10, posteriorWinRate: 0.8 },
    ],
  ]);
  const voiKnown = valueOfInformation(opp("known"), stats);
  const voiNovel = valueOfInformation(opp("novel"), stats);
  assert.ok(
    voiNovel > voiKnown,
    "an untested lever of equal upside is worth more information",
  );
});

test("anomaly detection flags fulfillment failure and precursor crashes", async () => {
  const { detectAnomalies } = await import("@tributeready/revenueos");
  const scBase = {
    generatedAt: "",
    siteId: "s",
    revenueUsd: 0,
    contributionProfitUsd: 0,
    purchases: 0,
    landingViews: 100,
    visitorToPurchase: null,
    experimentsWon: 0,
    experimentsLost: 0,
    openExperiments: 0,
    failures: 0,
    confidence: 0.2,
    bottleneckLevel: 4 as const,
    nextAction: "",
    topOpportunities: [],
    expectedProfitPipelineUsd: 0,
    attributionsClosed: 0,
    learningDelta: "",
  };
  const observation = {
    observedAt: new Date().toISOString(),
    money: {
      revenueUsd: 0,
      purchases: 0,
      awaitingPayment: 0,
      refunded: 0,
      estimatedVariableCostUsd: 0,
      estimatedProfitUsd: 0,
      mrr: 0,
      arr: 0,
    },
    funnel: {
      steps: [],
      largestDrop: null,
      landingViews: 30,
      checkouts: 0,
      fulfillmentFailed: 1,
    },
    bottleneck: { level: 4 as const, label: "", detail: "" },
    openExperimentIds: [],
    errors: [],
  };
  const anomalies = detectAnomalies(observation, [
    { ...scBase, landingViews: 100 },
    { ...scBase, landingViews: 100 },
  ]);
  assert.ok(
    anomalies.some((a) => a.metric === "fulfillment" && a.severity === "high"),
    "fulfillment failure must be a high-severity anomaly",
  );
  assert.ok(
    anomalies.some((a) => a.metric === "landing_views"),
    "a 70% traffic drop vs recent median must be flagged",
  );
});

test("a full cycle produces a sequenced, dependency-aware strategy", async () => {
  const { createExampleStaticAdapter, runCycle } = await import(
    "@tributeready/revenueos"
  );
  const dir = await mkdtemp(path.join(tmpdir(), "revenueos-strategy-"));
  const adapter = createExampleStaticAdapter(dir);
  const result = await runCycle(adapter);
  assert.ok(result.strategy.steps.length >= 1, "strategy should have steps");
  assert.ok(
    result.strategy.steps.every((s, i) => s.order === i + 1),
    "steps must be ordered",
  );
  // Profit-first: at pre-revenue with fulfillment healthy, the lead step must be
  // a money-making lever, never a $0 maintenance chore.
  const lead = result.strategy.steps[0];
  assert.ok(
    lead.expectedProfitUsd > 0,
    "the lead strategy step must have positive expected profit",
  );
  assert.notEqual(
    lead.category,
    "operations",
    "a $0 maintenance task must not lead the plan when there is nothing to protect",
  );
  assert.ok(
    typeof result.strategy.projectedProfitUsd === "number",
    "strategy should project horizon profit",
  );
  assert.match(result.reportText, /STRATEGY/);
});

test("ambition sets a $10k-day north star and treats sub-$10k as a lost day", async () => {
  const { buildAmbition, NORTH_STAR_DAILY_PROFIT_USD } = await import(
    "@tributeready/revenueos"
  );
  const scBase = {
    generatedAt: "",
    siteId: "s",
    revenueUsd: 0,
    contributionProfitUsd: 0,
    purchases: 0,
    landingViews: 0,
    visitorToPurchase: null,
    experimentsWon: 0,
    experimentsLost: 0,
    openExperiments: 0,
    failures: 0,
    confidence: 0.2,
    bottleneckLevel: 4 as const,
    nextAction: "",
    topOpportunities: [],
    expectedProfitPipelineUsd: 0,
    attributionsClosed: 0,
    learningDelta: "",
  };
  const obs = (profit: number, revenue: number) => ({
    observedAt: new Date().toISOString(),
    money: {
      revenueUsd: revenue,
      purchases: 0,
      awaitingPayment: 0,
      refunded: 0,
      estimatedVariableCostUsd: 0,
      estimatedProfitUsd: profit,
      mrr: 0,
      arr: 0,
    },
    funnel: {
      steps: [],
      largestDrop: null,
      landingViews: 0,
      checkouts: 0,
      fulfillmentFailed: 0,
    },
    bottleneck: { level: 4 as const, label: "", detail: "" },
    openExperimentIds: [],
    errors: [],
  });

  // Best-ever profit was $100; a mere $110 (beating it) must still be a lost day
  // because the north star is $10k, not a nudge past the record.
  const behind = buildAmbition({
    observation: obs(110, 300),
    history: [{ ...scBase, contributionProfitUsd: 100, revenueUsd: 250 }],
  });
  assert.equal(behind.northStarDailyProfitUsd, NORTH_STAR_DAILY_PROFIT_USD);
  assert.equal(behind.targetProfitUsd, NORTH_STAR_DAILY_PROFIT_USD);
  assert.equal(behind.dayVerdict, "lost_day");
  assert.ok(behind.shortfallUsd > 9000);
  assert.equal(behind.onPace, false, "beating the record is not good enough");
  assert.ok(behind.aggression >= 1, "being behind target must raise aggression");
  assert.ok(
    behind.concurrentBets >= 2,
    "when behind, the brain fires multiple parallel bets",
  );
  assert.equal(behind.alwaysLearning, true);

  // Pre-revenue: first sale is a milestone on the path to $10k, not the finish.
  const preRev = buildAmbition({
    observation: obs(0, 0),
    history: [],
    unitEconomics: {
      contributionMarginUsd: 33.59,
      ltvUsd: 33.59,
      cacCeilingUsd: 10,
      paybackOrders: 1,
      breakEvenVisitors: 100,
    },
  });
  assert.equal(preRev.targetProfitUsd, NORTH_STAR_DAILY_PROFIT_USD);
  assert.equal(preRev.aggression, 3, "zero revenue is maximum aggression");
  assert.equal(preRev.dayVerdict, "lost_day");
  assert.match(preRev.verdict, /first sale/i);
  assert.match(preRev.verdict, /10,000|10000|\$10/);
});

test("north-star shortfall lesson + meta/curriculum fire every lost day", async () => {
  const { createExampleStaticAdapter, runCycle, NORTH_STAR_DAILY_PROFIT_USD } =
    await import("@tributeready/revenueos");
  const dir = await mkdtemp(path.join(tmpdir(), "revenueos-10k-"));
  const adapter = createExampleStaticAdapter(dir);
  const result = await runCycle(adapter);

  assert.equal(result.shortfall.dayVerdict, "lost_day");
  assert.ok(result.shortfall.shortfallUsd > 0);
  assert.equal(
    result.shortfall.northStarDailyProfitUsd,
    NORTH_STAR_DAILY_PROFIT_USD,
  );
  assert.ok(
    result.lessons.some((l) => l.patternKey.startsWith("shortfall:")),
    "a lost day must record a shortfall lesson",
  );
  assert.equal(result.metaPolicy.alwaysLearning, true);
  assert.ok(result.metaPolicy.explorationLambda >= 0.4);
  assert.ok(result.curriculum.priority.length > 0);
  assert.ok(result.regime.regime.length > 0);
  assert.match(result.reportText, /NORTH STAR/);
  assert.match(result.reportText, /LOST DAY|Lost day/i);
  assert.ok(
    result.ambition.concurrentBets >= 1,
    "kelly/meta sizing must keep at least one bet",
  );
});

test("audience model builds personas + a non-empty channel plan; hard traffic raises difficulty", async () => {
  const { buildAudienceModel } = await import("@tributeready/revenueos");
  const baseWorld = {
    market: {
      demandProxy: "emerging" as const,
      discoveryCoverage: "thin" as const,
      competitivePressure: "high" as const,
      channelReadiness: [],
      notes: [],
    },
    shopper: {
      primaryFriction: "trust" as const,
      intentTemperature: "cold" as const,
      frictionHypotheses: [],
      notes: [],
    },
    business: {
      contributionMarginUsd: 30,
      contributionMarginRatio: 0.9,
      monetizationStage: "pre_revenue" as const,
      unitEconomicsHealthy: true,
      fulfillmentReliable: true,
      notes: [],
    },
  };
  const context = {
    siteId: "s",
    displayName: "S",
    industry: "funeral",
    products: [],
    funnelSteps: [],
    brandVoice: "",
    allowedChannels: [],
    autonomousDailyCapUsd: 0,
    timezone: "UTC",
    constraints: [],
  };
  const observation = {
    observedAt: new Date().toISOString(),
    money: {
      revenueUsd: 0,
      purchases: 0,
      awaitingPayment: 0,
      refunded: 0,
      estimatedVariableCostUsd: 0,
      estimatedProfitUsd: 0,
      mrr: 0,
      arr: 0,
    },
    funnel: {
      steps: [],
      largestDrop: null,
      landingViews: 80, // real traffic...
      checkouts: 0,
      fulfillmentFailed: 0,
    },
    bottleneck: { level: 3 as const, label: "", detail: "" },
    openExperimentIds: [],
    errors: [],
  };
  const audience = buildAudienceModel({ context, observation, world: baseWorld });
  assert.ok(audience.personas.length >= 1, "should infer personas");
  assert.ok(
    audience.channelPlan.length >= 3,
    "there must always be multiple channel plays — traffic is never the excuse",
  );
  assert.ok(
    audience.salesDifficulty >= 0.5,
    "traffic that will not convert + high competition = a hard sell",
  );
  assert.ok(
    audience.resolveMultiplier > 1,
    "a hard sell must raise resolve above baseline",
  );
  assert.ok(
    audience.channelPlan.every((p) => p.patternKey.startsWith("acq:")),
    "plays must carry channel/persona pattern keys for learning",
  );
});

test("acquisition engine always produces many money-connected plays", async () => {
  const { createExampleStaticAdapter, runCycle } = await import(
    "@tributeready/revenueos"
  );
  const dir = await mkdtemp(path.join(tmpdir(), "revenueos-acq-"));
  const adapter = createExampleStaticAdapter(dir);
  const result = await runCycle(adapter);
  const acq = result.opportunities.filter((o) => o.category === "acquisition");
  assert.ok(
    acq.length >= 3,
    "the brain should always have multiple acquisition levers to pull",
  );
  assert.ok(
    acq.some((o) => (o.patternKey ?? "").startsWith("acq:")),
    "persona×channel plays should be present as acquisition opportunities",
  );
  assert.match(result.reportText, /traffic is never the excuse/i);
});

test("a hard sell escalates ambition instead of lowering it", async () => {
  const { buildAmbition } = await import("@tributeready/revenueos");
  const obs = {
    observedAt: new Date().toISOString(),
    money: {
      revenueUsd: 300,
      purchases: 0,
      awaitingPayment: 0,
      refunded: 0,
      estimatedVariableCostUsd: 0,
      estimatedProfitUsd: 110,
      mrr: 0,
      arr: 0,
    },
    funnel: {
      steps: [],
      largestDrop: null,
      landingViews: 0,
      checkouts: 0,
      fulfillmentFailed: 0,
    },
    bottleneck: { level: 3 as const, label: "", detail: "" },
    openExperimentIds: [],
    errors: [],
  };
  const history = [
    {
      generatedAt: "",
      siteId: "s",
      revenueUsd: 250,
      contributionProfitUsd: 100,
      purchases: 3,
      landingViews: 0,
      visitorToPurchase: null,
      experimentsWon: 0,
      experimentsLost: 0,
      openExperiments: 0,
      failures: 0,
      confidence: 0.2,
      bottleneckLevel: 3 as const,
      nextAction: "",
      topOpportunities: [],
      expectedProfitPipelineUsd: 0,
      attributionsClosed: 0,
      learningDelta: "",
    },
  ];
  const easy = buildAmbition({ observation: obs, history, salesDifficulty: 0.1 });
  const hard = buildAmbition({ observation: obs, history, salesDifficulty: 0.8 });
  assert.ok(
    hard.aggression >= easy.aggression,
    "a hard sell must not reduce aggression",
  );
  assert.ok(
    hard.concurrentBets >= easy.concurrentBets,
    "a hard sell should fire at least as many bets",
  );
  assert.match(hard.verdict, /want it more/i);
});

test("money plan allocates effort by profit-per-effort and projects a monthly number", async () => {
  const { createExampleStaticAdapter, runCycle } = await import(
    "@tributeready/revenueos"
  );
  const dir = await mkdtemp(path.join(tmpdir(), "revenueos-money-"));
  const adapter = createExampleStaticAdapter(dir);
  const result = await runCycle(adapter);
  const plan = result.moneyPlan;
  assert.ok(plan.items.length >= 1, "money plan should fund at least one lever");
  assert.ok(
    plan.effortUsed <= plan.effortBudget || plan.items.length === 1,
    "effort used must respect the budget (unless funding the single best lever)",
  );
  assert.ok(
    plan.totalProjectedMonthlyProfitUsd > 0,
    "the plan should project a positive monthly profit",
  );
  // Allocation is by profit-per-effort — non-increasing across funded items.
  for (let i = 1; i < plan.items.length; i++) {
    assert.ok(
      plan.items[i - 1].profitPerEffort >= plan.items[i].profitPerEffort,
      "funded items must be ordered by profit-per-effort",
    );
  }
  assert.match(result.reportText, /MONEY MACHINE/);
  assert.ok(
    typeof plan.marginalDollar === "string" && plan.marginalDollar.length > 0,
    "the plan must route the cheapest next dollar",
  );
});

test("channel plan is learning-aware: a proven arm rises and the winning angle is chosen", async () => {
  const { buildAudienceModel } = await import("@tributeready/revenueos");
  const context = {
    siteId: "s",
    displayName: "S",
    industry: "generic",
    products: [],
    funnelSteps: [],
    brandVoice: "",
    allowedChannels: [],
    autonomousDailyCapUsd: 0,
    timezone: "UTC",
    constraints: [],
    audienceSegments: [
      {
        id: "buyer",
        label: "Buyer",
        channels: ["organic_search", "communities"],
        messagingAngles: ["Angle A", "Angle B"],
        intentTemperature: "warm" as const,
      },
    ],
  };
  const world = {
    market: {
      demandProxy: "emerging" as const,
      discoveryCoverage: "growing" as const,
      competitivePressure: "low" as const,
      channelReadiness: [],
      notes: [],
    },
    shopper: {
      primaryFriction: "none" as const,
      intentTemperature: "warm" as const,
      frictionHypotheses: [],
      notes: [],
    },
    business: {
      contributionMarginUsd: 30,
      contributionMarginRatio: 0.9,
      monetizationStage: "early_sales" as const,
      unitEconomicsHealthy: true,
      fulfillmentReliable: true,
      notes: [],
    },
  };
  const observation = {
    observedAt: new Date().toISOString(),
    money: {
      revenueUsd: 100,
      purchases: 3,
      awaitingPayment: 0,
      refunded: 0,
      estimatedVariableCostUsd: 0,
      estimatedProfitUsd: 90,
      mrr: 0,
      arr: 0,
    },
    funnel: {
      steps: [],
      largestDrop: null,
      landingViews: 200,
      checkouts: 3,
      fulfillmentFailed: 0,
    },
    bottleneck: { level: 2 as const, label: "", detail: "" },
    openExperimentIds: [],
    errors: [],
  };

  // "Angle B" on communities has a strong win record; it should be chosen and
  // that channel/persona pair should still rank at the top by learned fit even
  // though open channels are guaranteed slots in the plan.
  const stats = new Map([
    [
      "acq:communities:buyer:a1",
      {
        patternKey: "acq:communities:buyer:a1",
        trials: 6,
        wins: 6,
        losses: 0,
        posteriorWinRate: 0.9,
      },
    ],
  ]);
  const audience = buildAudienceModel({
    context,
    observation,
    world,
    banditStats: stats,
  });
  const winner = audience.channelPlan[0];
  assert.equal(winner.channel, "communities", "the proven channel should rank first");
  assert.equal(winner.angleIndex, 1, "the winning angle (index 1) should be chosen");
  assert.equal(winner.angle, "Angle B");
  assert.ok(
    audience.channelPlan.some((p) => !p.needsOwner),
    "plan must keep open (no-owner) channels in the hunt",
  );
});

test("hunting bets never wait only on owner-gated channels", async () => {
  const { selectHuntingBets } = await import("@tributeready/revenueos");
  const base = {
    predictedDelta: "",
    confidence: 0.5,
    effort: 1,
    expectedImpact: 6,
    action: "x",
    constraintsChecked: ["legal_only"],
  };
  const ranked = [
    {
      ...base,
      id: "hyp_everloved",
      title: "Marketplace",
      metric: "purchases",
      expectedImpact: 9,
      action: "owner signup",
    },
    {
      ...base,
      id: "hyp_index",
      title: "IndexNow",
      metric: "views",
      safeActionType: "indexnow_submit",
    },
    {
      ...base,
      id: "hyp_seo",
      title: "SEO",
      metric: "views",
      expectedImpact: 7,
      action: "write pages",
    },
    {
      ...base,
      id: "hyp_dir",
      title: "Directories",
      metric: "views",
      expectedImpact: 5,
      safeActionType: "indexnow_submit",
    },
  ];
  const bets = selectHuntingBets(ranked, 3);
  assert.ok(bets.length === 3);
  assert.ok(
    bets.some((b) => b.safeActionType),
    "at least one executable bet must run — never wait only on marketplace",
  );
  assert.ok(
    bets.filter((b) => b.safeActionType).length >=
      bets.filter((b) => !b.safeActionType).length,
    "executable bets should not be outnumbered by owner-waiting asks",
  );
});

test("money press always emits an executable discovery move under shortfall", async () => {
  const { buildMoneyPress, NORTH_STAR_DAILY_PROFIT_USD } = await import(
    "@tributeready/revenueos"
  );
  const moves = buildMoneyPress({
    observation: {
      observedAt: new Date().toISOString(),
      money: {
        revenueUsd: 0,
        purchases: 0,
        awaitingPayment: 0,
        refunded: 0,
        estimatedVariableCostUsd: 0,
        estimatedProfitUsd: 0,
        mrr: 0,
        arr: 0,
      },
      funnel: {
        steps: [],
        largestDrop: null,
        landingViews: 5,
        checkouts: 0,
        fulfillmentFailed: 0,
      },
      bottleneck: { level: 4 as const, label: "discovery", detail: "thin" },
      openExperimentIds: [],
      errors: [],
    },
    world: {
      business: {
        contributionMarginUsd: 33,
        contributionMarginRatio: 0.95,
        monetizationStage: "pre_revenue",
        unitEconomicsHealthy: true,
        fulfillmentReliable: true,
        notes: [],
      },
      market: {
        demandProxy: "emerging",
        discoveryCoverage: "thin",
        competitivePressure: "high",
        channelReadiness: [],
        notes: [],
      },
      shopper: {
        primaryFriction: "discovery",
        intentTemperature: "cold",
        frictionHypotheses: [],
        notes: [],
      },
      audience: {
        personas: [],
        channelPlan: [],
        salesDifficulty: 0.8,
        difficultyReasons: [],
        resolveMultiplier: 1.8,
        notes: [],
      },
    },
    shortfall: {
      northStarDailyProfitUsd: NORTH_STAR_DAILY_PROFIT_USD,
      currentProfitUsd: 0,
      shortfallUsd: NORTH_STAR_DAILY_PROFIT_USD,
      pctOfNorthStar: 0,
      dayVerdict: "lost_day",
      rootCause: "discovery",
      lessonPatternKey: "shortfall:l4:discovery",
      learningImperative: "hunt",
    },
  });
  assert.ok(moves.some((m) => m.safeActionType === "indexnow_submit"));
  assert.ok(moves[0].expectedImpact > 0);
});

test("a $0 hour triggers overdrive and a next-hour profit plan", async () => {
  const { buildAmbition, buildHourPlan } = await import("@tributeready/revenueos");
  const observation = {
    observedAt: new Date().toISOString(),
    money: {
      revenueUsd: 0,
      purchases: 0,
      awaitingPayment: 0,
      refunded: 0,
      estimatedVariableCostUsd: 0,
      estimatedProfitUsd: 0,
      mrr: 0,
      arr: 0,
    },
    funnel: {
      steps: [],
      largestDrop: null,
      landingViews: 4,
      checkouts: 0,
      fulfillmentFailed: 0,
    },
    bottleneck: { level: 4 as const, label: "discovery", detail: "thin" },
    hourPulse: {
      windowStart: new Date(Date.now() - 3_600_000).toISOString(),
      windowEnd: new Date().toISOString(),
      revenueUsd: 0,
      purchases: 0,
      landingViews: 4,
      checkouts: 0,
      zeroHour: true,
    },
    openExperimentIds: [],
    errors: [],
  };
  const ambition = buildAmbition({ observation, history: [] });
  assert.equal(ambition.overdrive, true);
  assert.equal(ambition.hourVerdict, "zero_hour");
  assert.equal(ambition.aggression, 3);
  assert.equal(ambition.concurrentBets, 6);
  assert.match(ambition.verdict, /ZERO HOUR/i);

  const hourPlan = buildHourPlan({
    observation,
    world: {
      business: {
        contributionMarginUsd: 33,
        contributionMarginRatio: 0.95,
        monetizationStage: "pre_revenue",
        unitEconomicsHealthy: true,
        fulfillmentReliable: true,
        notes: [],
      },
      market: {
        demandProxy: "emerging",
        discoveryCoverage: "thin",
        competitivePressure: "high",
        channelReadiness: [],
        notes: [],
      },
      shopper: {
        primaryFriction: "discovery",
        intentTemperature: "cold",
        frictionHypotheses: [],
        notes: [],
      },
      audience: {
        personas: [],
        channelPlan: [],
        salesDifficulty: 0.9,
        difficultyReasons: [],
        resolveMultiplier: 1.9,
        notes: [],
      },
    },
    opportunities: [
      {
        id: "press-discovery-indexnow",
        title: "Press: blast public URLs into discovery indexes",
        metric: "views",
        expectedImpact: 8,
        confidence: 0.5,
        effort: 1,
        action: "Submit IndexNow now",
        score: 50,
        safeActionType: "indexnow_submit",
        category: "acquisition",
      },
    ],
  });
  assert.equal(hourPlan.overdrive, true);
  assert.equal(hourPlan.hourVerdict, "zero_hour");
  assert.match(hourPlan.confession, /ZERO HOUR/i);
  assert.ok(hourPlan.nextHourMoves.length >= 1);
  assert.equal(hourPlan.neverGiveUp, true);
  assert.ok(hourPlan.nextHourBarUsd > 0);
  assert.match(hourPlan.learnedFromLastHour, /Learned|giving up|quit|discovery/i);
  assert.equal(ambition.neverGiveUp, true);
  assert.equal(ambition.alwaysLearning, true);
});

test("TributeReady growthos façade still exposes its snapshot shape", async () => {
  const growthos = await import("../src/lib/growthos");
  assert.equal(typeof growthos.buildGrowthSnapshot, "function");
  assert.equal(typeof growthos.formatExecutiveReport, "function");
  assert.equal(typeof growthos.runTributeReadyRevenueCycle, "function");
  assert.equal(growthos.PRICE_USD, 34.99);
});
