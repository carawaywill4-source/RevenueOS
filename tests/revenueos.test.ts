import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("policy keeps the brain inside hard boundaries", async () => {
  const { policyAllows, classifyActionType } = await import(
    "@revenueos/core"
  );
  assert.equal(classifyActionType("indexnow_submit"), "safe");
  assert.equal(classifyActionType("publish_free_resource"), "safe");
  assert.equal(classifyActionType("distribute_owned_urls"), "safe");
  assert.equal(classifyActionType("spend_ads"), "owner_gate");
  assert.equal(classifyActionType("create_account"), "owner_gate");
  assert.equal(classifyActionType("login_account"), "owner_gate");
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
    "@revenueos/core"
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
    "@revenueos/core"
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
    actions: [
      {
        type: "indexnow_submit",
        result: { ok: true, detail: "submitted" },
        at: past,
      },
    ],
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

test("a proposed or failed action is never attributed as an experiment", async () => {
  const { dueForAttribution } = await import("@revenueos/core");
  const past = new Date(Date.now() - 86_400_000).toISOString();
  const base = {
    id: "exp_unexecuted",
    siteId: "s",
    hypothesis: {
      id: "hyp",
      title: "t",
      metric: "m",
      predictedDelta: "",
      confidence: 0.5,
      effort: 1,
      expectedImpact: 5,
      action: "a",
      constraintsChecked: [],
    },
    predictedOutcome: "",
    measurement: {
      metric: "purchases" as const,
      baselineValue: 0,
      targetDelta: 1,
      timeToSignalDays: 1,
      scheduledCheckAt: past,
    },
    createdAt: past,
    updatedAt: past,
  };
  assert.equal(
    dueForAttribution({ ...base, status: "proposed" as const, actions: [] }),
    false,
  );
  assert.equal(
    dueForAttribution({
      ...base,
      status: "running" as const,
      actions: [{ type: "x", result: { ok: false, detail: "failed" }, at: past }],
    }),
    false,
  );
});

test("Bayesian confidence shrinks on thin data and updates with evidence", async () => {
  const { evidenceConfidence, shrinkForSample, wilsonInterval } = await import(
    "@revenueos/core"
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
    "@revenueos/core"
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
    "@revenueos/core"
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
  const { buildForecast } = await import("@revenueos/core");
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
  const { attributeExperiment } = await import("@revenueos/core");
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
  const { valueOfInformation } = await import("@revenueos/core");
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
  const { detectAnomalies } = await import("@revenueos/core");
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
    "@revenueos/core"
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
    "@revenueos/core"
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
    await import("@revenueos/core");
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
  const { buildAudienceModel } = await import("@revenueos/core");
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
    "@revenueos/core"
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
  const { buildAmbition } = await import("@revenueos/core");
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
    "@revenueos/core"
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
  const { buildAudienceModel } = await import("@revenueos/core");
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
  const { selectHuntingBets } = await import("@revenueos/core");
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
    "@revenueos/core"
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
  const { buildAmbition, buildHourPlan } = await import("@revenueos/core");
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

test("planner validation rejects unknown and non-executable opportunities", async () => {
  const { validatePlannerSelection } = await import("@revenueos/core");
  const opportunities = [
    {
      id: "known-exec",
      title: "IndexNow",
      metric: "views",
      expectedImpact: 5,
      confidence: 0.5,
      effort: 1,
      action: "Submit",
      score: 40,
      safeActionType: "indexnow_submit",
    },
    {
      id: "known-blocked",
      title: "Owner gate",
      metric: "views",
      expectedImpact: 5,
      confidence: 0.5,
      effort: 1,
      action: "Ask owner",
      score: 30,
    },
  ];
  const safeActions = [
    { type: "indexnow_submit", risk: "safe" as const, description: "IndexNow" },
  ];
  const rejected = validatePlannerSelection(
    {
      source: "ai",
      rationale: "test",
      evidence: [],
      selectedOpportunityIds: ["known-exec", "unknown-id", "known-blocked"],
      rejectedOpportunityIds: [],
      falsifier: "none",
    },
    opportunities,
    safeActions,
  );
  assert.equal(rejected.policyRejected, true);
  assert.deepEqual(rejected.decision.selectedOpportunityIds, ["known-exec"]);
  assert.ok(rejected.decision.rejectedOpportunityIds.includes("unknown-id"));
});

test("planner quota blocks excessive daily calls", async () => {
  const { PLANNER_DAILY_CALL_LIMIT, checkPlannerQuota } = await import(
    "@revenueos/core"
  );
  type PlannerRunRecord = import("@revenueos/core").PlannerRunRecord;
  const runs: PlannerRunRecord[] = Array.from({ length: PLANNER_DAILY_CALL_LIMIT }, (_, i) => ({
    id: `planner_${i}`,
    siteId: "example-static",
    createdAt: new Date().toISOString(),
    source: "ai",
    decision: {
      source: "ai",
      rationale: "test",
      evidence: [],
      selectedOpportunityIds: [],
      rejectedOpportunityIds: [],
      falsifier: "none",
    },
    inputFingerprint: "abc",
    policyRejected: false,
  }));
  const quota = checkPlannerQuota(runs);
  assert.equal(quota.allowed, false);
  assert.match(quota.reason ?? "", /Daily planner call limit/i);
});

test("cycle persists planner runs and exposures when store supports them", async () => {
  const { createExampleStaticAdapter, runCycle } = await import(
    "@revenueos/core"
  );
  const dir = await mkdtemp(path.join(tmpdir(), "revenueos-planner-"));
  const adapter = createExampleStaticAdapter(dir);
  const store = adapter.getExperimentStore();
  const baseSafeActions = adapter.listSafeActions();
  adapter.listSafeActions = async () => [
    ...(await Promise.resolve(baseSafeActions)),
    { type: "indexnow_submit", risk: "safe", description: "IndexNow" },
    { type: "market_research", risk: "safe", description: "Research" },
    { type: "discovery_attack", risk: "safe", description: "Discovery attack" },
    { type: "publish_intent_page", risk: "safe", description: "Publish" },
    { type: "sitemap_ping", risk: "safe", description: "Sitemap" },
  ];
  adapter.planDecision = async ({ opportunities, safeActions }) => {
    const allowed = new Set(safeActions.map((action) => action.type));
    const executable = opportunities.find(
      (item) => item.safeActionType && allowed.has(item.safeActionType),
    );
    assert.ok(executable, "expected an executable opportunity in the fixture");
    return {
      source: "ai",
      rationale: "Prefer discovery while pre-revenue.",
      evidence: ["0 purchases"],
      selectedOpportunityIds: [executable.id],
      rejectedOpportunityIds: [],
      falsifier: "No view lift",
    };
  };

  const result = await runCycle(adapter);
  assert.ok(result.plannerDecision);
  assert.match(result.reportText, /PLANNER DECISION/);

  const plannerRuns = await store.listPlannerRuns!("example-static");
  assert.equal(plannerRuns.length, 1);
  assert.equal(plannerRuns[0].source, "ai");

  const reports = await store.listCycleReports!("example-static");
  assert.equal(reports.length, 1);
  assert.match(reports[0].reportText, /RevenueOS cycle/);
});

test("discovery governor classifies stages and kill vs expand verdicts", async () => {
  const {
    classifyDiscoveryStage,
    scoreDiscoveryDoor,
    applyDoorScore,
    governorPublishGate,
  } = await import("@revenueos/core");

  assert.equal(
    classifyDiscoveryStage({
      submitted: true,
      topicViews: 0,
      productViews: 0,
      addToCarts: 0,
      checkouts: 0,
      purchases: 0,
      revenueUsd: 0,
    }),
    "submitted",
  );
  assert.equal(
    classifyDiscoveryStage({
      submitted: false,
      topicViews: 0,
      productViews: 0,
      addToCarts: 0,
      checkouts: 0,
      purchases: 0,
      revenueUsd: 0,
    }),
    "dead_on_arrival",
  );
  assert.equal(
    classifyDiscoveryStage({
      submitted: true,
      topicViews: 12,
      productViews: 0,
      addToCarts: 0,
      checkouts: 0,
      purchases: 0,
      revenueUsd: 0,
    }),
    "visited",
  );
  assert.equal(
    classifyDiscoveryStage({
      submitted: true,
      topicViews: 20,
      productViews: 4,
      addToCarts: 1,
      checkouts: 0,
      purchases: 0,
      revenueUsd: 0,
    }),
    "cart",
  );

  const door = {
    id: "door-1",
    siteId: "mendhaus",
    slug: "linen-bedding",
    url: "/topics/linen-bedding",
    query: "best linen bedding",
    clusterKey: "best-linen-bedding",
    publishedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    status: "active" as const,
  };

  const killScore = scoreDiscoveryDoor({
    door,
    metrics: {
      submitted: true,
      topicViews: 0,
      productViews: 0,
      addToCarts: 0,
      checkouts: 0,
      purchases: 0,
      revenueUsd: 0,
    },
    windowDays: 7,
  });
  assert.equal(killScore.stage, "submitted");
  assert.equal(killScore.verdict, "kill");
  assert.equal(applyDoorScore(door, killScore).status, "killed");

  const expandScore = scoreDiscoveryDoor({
    door,
    metrics: {
      submitted: true,
      topicViews: 40,
      productViews: 8,
      addToCarts: 2,
      checkouts: 1,
      purchases: 1,
      revenueUsd: 89,
    },
    windowDays: 7,
  });
  assert.equal(expandScore.verdict, "expand");
  assert.equal(applyDoorScore(door, expandScore).status, "expanding");

  const holdEarly = scoreDiscoveryDoor({
    door: {
      ...door,
      publishedAt: new Date(Date.now() - 3.5 * 24 * 60 * 60 * 1000).toISOString(),
    },
    metrics: {
      submitted: true,
      topicViews: 0,
      productViews: 0,
      addToCarts: 0,
      checkouts: 0,
      purchases: 0,
      revenueUsd: 0,
    },
    windowDays: 3,
  });
  assert.equal(holdEarly.verdict, "hold");

  const overdueDoors = Array.from({ length: 3 }, (_, i) => ({
    ...door,
    id: `door-overdue-${i}`,
    publishedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    lastScore: undefined,
  }));
  const gate = governorPublishGate({ doors: overdueDoors, publishesToday: 0 });
  assert.equal(gate.allowPublish, false);
  assert.match(gate.reason, /overdue for scoring/);
});

test("profit maximizer focuses conversion when traffic exists without sales", async () => {
  const {
    buildProfitMandate,
    applyProfitPressure,
    shouldHeartbeatAction,
    createExampleStaticAdapter,
    runCycle,
  } = await import("@revenueos/core");

  const mandate = buildProfitMandate({
    observation: {
      observedAt: new Date().toISOString(),
      windowDays: 7,
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
        landingViews: 120,
        checkouts: 8,
        fulfillmentFailed: 0,
        largestDrop: { from: "product", to: "checkout", dropRate: 0.7 },
        steps: [],
      },
      bottleneck: { level: 2, label: "conversion", detail: "views without buys" },
      hourPulse: {
        landingViews: 20,
        checkouts: 2,
        purchases: 0,
        revenueUsd: 0,
        windowMinutes: 60,
      },
    } as never,
    world: {
      business: {
        monetizationStage: "pre_revenue",
        contributionMarginUsd: 40,
        contributionMarginRatio: 0.5,
        fulfillmentReliable: true,
      },
      market: { demandProxy: "unknown", discoveryCoverage: "thin", competitivePressure: "medium" },
      shopper: {
        primaryFriction: "clarity",
        intentTemperature: "warm",
        frictionHypotheses: [],
        notes: [],
      },
      audience: {
        personas: [],
        salesDifficulty: 0.5,
        resolveMultiplier: 1.2,
        difficultyReasons: [],
        channelPlan: [],
      },
    } as never,
    shortfall: {
      northStarDailyProfitUsd: 10_000,
      currentProfitUsd: 0,
      shortfallUsd: 10_000,
      pctOfNorthStar: 0,
      dayVerdict: "lost_day",
      rootCause: "no purchases",
      learningImperative: "close traffic",
      ordersNeeded: 250,
      visitorsNeeded: 5000,
    } as never,
  });
  assert.equal(mandate.focus, "conversion");
  assert.ok(mandate.heartbeatActionTypes.includes("merch_optimize"));
  assert.equal(shouldHeartbeatAction("discovery_attack", mandate), false);
  assert.equal(shouldHeartbeatAction("merch_optimize", mandate), true);

  const pressed = applyProfitPressure({
    opportunities: [
      {
        id: "acq",
        title: "Publish more topics",
        metric: "views",
        category: "acquisition",
        precursorMetric: "landing_views",
        expectedImpact: 9,
        confidence: 0.5,
        effort: 2,
        score: 100,
        action: "publish",
        safeActionType: "discovery_attack",
        predicted: {
          precursorMetric: "landing_views",
          expectedProfitUsd: 50,
          confidence: 0.4,
          effort: 2,
          costUsd: 0,
          timeToSignalDays: 14,
        },
      },
      {
        id: "conv",
        title: "Close existing visitors",
        metric: "purchases",
        category: "conversion",
        precursorMetric: "purchases",
        expectedImpact: 8,
        confidence: 0.5,
        effort: 2,
        score: 90,
        action: "merch",
        safeActionType: "merch_optimize",
        predicted: {
          precursorMetric: "purchases",
          expectedProfitUsd: 80,
          confidence: 0.5,
          effort: 2,
          costUsd: 0,
          timeToSignalDays: 7,
        },
      },
    ],
    mandate,
    observation: {
      funnel: { landingViews: 120, checkouts: 8, fulfillmentFailed: 0, largestDrop: { from: "a", to: "b", dropRate: 0.5 }, steps: [] },
      money: { purchases: 0, estimatedProfitUsd: 0 },
    } as never,
  });
  assert.equal(pressed[0].id, "conv");

  const dir = await mkdtemp(path.join(tmpdir(), "revenueos-profit-"));
  const adapter = createExampleStaticAdapter(dir);
  const result = await runCycle(adapter);
  assert.ok(result.profitMandate);
  assert.match(result.reportText, /SUCCESS CRITERION/);
  assert.match(result.reportText, /PROFIT MANDATE/);
  assert.match(
    result.profitMandate!.successDeclaration,
    /FAILING|SUCCESS|money made/i,
  );
  assert.ok(result.profitMandate!.failurePressure >= 1);
});

test("organic mastery locks ads and drills organic leads→sales", async () => {
  const { scoreOrganicMastery, applyOrganicMasteryPressure, createExampleStaticAdapter, runCycle } =
    await import("@revenueos/core");

  const mastery = scoreOrganicMastery({
    observation: {
      observedAt: new Date().toISOString(),
      windowDays: 7,
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
        landingViews: 80,
        checkouts: 2,
        fulfillmentFailed: 0,
        largestDrop: { from: "a", to: "b", dropRate: 0.5 },
        steps: [],
      },
      bottleneck: { level: 3, label: "conversion", detail: "views without buys" },
    } as never,
    world: {
      business: {
        monetizationStage: "pre_revenue",
        contributionMarginUsd: 40,
        contributionMarginRatio: 0.5,
        fulfillmentReliable: true,
      },
      market: { demandProxy: "unknown", discoveryCoverage: "thin", competitivePressure: "medium" },
      shopper: {
        primaryFriction: "clarity",
        intentTemperature: "warm",
        frictionHypotheses: [],
        notes: [],
      },
      audience: {
        personas: [],
        salesDifficulty: 0.5,
        resolveMultiplier: 1,
        difficultyReasons: [],
        channelPlan: [],
      },
    } as never,
    doors: [],
  });
  assert.ok(["novice", "apprentice"].includes(mastery.level));
  assert.equal(mastery.adsReadiness, "locked");
  assert.match(mastery.mission, /ORGANIC MASTERY/i);

  const ranked = applyOrganicMasteryPressure({
    mastery,
    opportunities: [
      {
        id: "paid",
        title: "Run paid ads",
        metric: "purchases",
        category: "acquisition",
        expectedImpact: 9,
        confidence: 0.5,
        effort: 2,
        score: 200,
        action: "spend",
        safeActionType: "spend_ads",
        patternKey: "paid-ads",
      },
      {
        id: "close",
        title: "Close organic visitors",
        metric: "purchases",
        category: "conversion",
        expectedImpact: 8,
        confidence: 0.5,
        effort: 2,
        score: 100,
        action: "merch",
        safeActionType: "merch_optimize",
        patternKey: "conversion-press",
      },
    ],
  });
  assert.equal(ranked[0].id, "close");
  assert.ok(ranked.find((o) => o.id === "paid")!.score < 100);

  const dir = await mkdtemp(path.join(tmpdir(), "revenueos-organic-"));
  const result = await runCycle(createExampleStaticAdapter(dir));
  assert.ok(result.organicMastery);
  assert.match(result.reportText, /ORGANIC MASTERY ERA/);
  assert.ok(result.organicMastery!.adsReadiness === "locked" || result.organicMastery!.adsReadiness === "almost" || result.organicMastery!.adsReadiness === "ready");
});

test("portable memory transfers learning to a newly attached siteId", async () => {
  const {
    createFileExperimentStore,
    persistPortableLesson,
    ensurePortableMemory,
    exportPortableKnowledge,
    importPortableKnowledge,
  } = await import("@revenueos/core");

  const dir = await mkdtemp(path.join(tmpdir(), "revenueos-portable-"));
  const store = createFileExperimentStore(dir);

  const learned = await persistPortableLesson(store, {
    siteId: "business-a",
    industry: "home_goods",
    lesson: {
      patternKey: "conversion-press",
      summary: "FAILING: traffic without sales. Close visitors before publishing.",
      evidenceCount: 1,
      transferable: true,
      sentiment: "negative",
      rankingWeight: 1.4,
    },
  });
  assert.equal(learned.scope, "industry");
  assert.ok(learned.originSiteIds?.includes("business-a"));

  // Simulate attaching RevenueOS to business-b on the same ledger.
  await ensurePortableMemory({
    store,
    siteId: "business-b",
    industry: "home_goods",
  });
  const forB = await store.listLessons({
    siteId: "business-b",
    industry: "home_goods",
  });
  assert.ok(
    forB.some((l) => l.patternKey === "conversion-press" && l.scope === "industry"),
    "new business must inherit industry lessons without starting over",
  );

  // Cross-ledger attach: export pack → import into empty store.
  const pack = await exportPortableKnowledge(store);
  assert.ok(pack.lessons.length >= 1);
  const dir2 = await mkdtemp(path.join(tmpdir(), "revenueos-portable2-"));
  const store2 = createFileExperimentStore(dir2);
  const imported = await importPortableKnowledge(store2, pack);
  assert.ok(imported.lessons >= 1);
  const forC = await store2.listLessons({
    siteId: "business-c",
    industry: "home_goods",
  });
  assert.ok(forC.some((l) => l.patternKey === "conversion-press"));
});

test("capability gaps upsert across siteIds and count blocked EV", async () => {
  const {
    upsertCapabilityGap,
    recordGapsFromOpportunities,
    summarizeCapabilityGaps,
    createFileExperimentStore,
  } = await import("@revenueos/core");

  const now = new Date("2026-08-08T12:00:00.000Z");
  let gap = upsertCapabilityGap({
    existing: undefined,
    siteId: "tributeready",
    missingCapability: "search_console_analytics",
    desiredAction: "Read GSC clicks",
    reason: "No OAuth limb",
    expectedValueUsd: 400,
    now,
  });
  assert.equal(gap.timesBlocked, 1);
  assert.deepEqual(gap.businessesAffected, ["tributeready"]);

  gap = upsertCapabilityGap({
    existing: gap,
    siteId: "mendhaus",
    missingCapability: "search_console_analytics",
    desiredAction: "Read GSC clicks",
    reason: "Still no OAuth limb",
    expectedValueUsd: 500,
    now,
  });
  assert.equal(gap.timesBlocked, 2);
  assert.ok(gap.businessesAffected.includes("tributeready"));
  assert.ok(gap.businessesAffected.includes("mendhaus"));
  assert.equal(gap.expectedValueUsd, 500);

  const dir = await mkdtemp(path.join(tmpdir(), "revenueos-gaps-"));
  const store = createFileExperimentStore(dir);
  await store.saveCapabilityGap!(gap);

  const fromMh = recordGapsFromOpportunities({
    siteId: "mendhaus",
    safeActions: [{ type: "indexnow_submit", risk: "safe", description: "IndexNow" }],
    existingGaps: [],
    declaredUnavailable: [
      {
        capability: "search_console_analytics",
        reason: "No GSC",
      },
    ],
    opportunities: [
      {
        id: "acq-outreach",
        title: "Directory outreach",
        metric: "landing_views",
        category: "acquisition",
        action: "Place in directories",
        expectedImpact: 20,
        confidence: 0.5,
        effort: 3,
        score: 80,
        patternKey: "outreach-directories",
        predicted: {
          precursorMetric: "landing_views",
          expectedProfitUsd: 600,
          confidence: 0.4,
          effort: 3,
          costUsd: 0,
          timeToSignalDays: 14,
        },
      },
    ],
    now,
  });
  for (const g of fromMh) {
    await store.saveCapabilityGap!(g);
  }

  const all = await store.listCapabilityGaps!();
  assert.ok(all.length >= 2);
  const sites = new Set(all.flatMap((g) => g.businessesAffected));
  assert.ok(sites.has("tributeready") || all.some((g) => g.siteId === "tributeready"));
  assert.ok(all.some((g) => g.siteId === "mendhaus"));

  const summary = summarizeCapabilityGaps(all);
  const gsc = summary.find((s) => s.missingCapability === "search_console_analytics");
  assert.ok(gsc);
  assert.ok(gsc!.timesBlocked >= 1);
  assert.ok(gsc!.expectedValueUsd > 0);
});

test("demoteUnavailableSafeActions strips limbs the adapter cannot run", async () => {
  const { demoteUnavailableSafeActions } = await import("@revenueos/core");
  const demoted = demoteUnavailableSafeActions(
    [
      {
        id: "a",
        title: "Publish",
        metric: "views",
        category: "acquisition",
        action: "publish",
        expectedImpact: 8,
        confidence: 0.5,
        effort: 1,
        score: 10,
        safeActionType: "publish_intent_page",
        predicted: {
          precursorMetric: "landing_views",
          expectedProfitUsd: 100,
          confidence: 0.4,
          effort: 1,
          costUsd: 0,
          timeToSignalDays: 7,
        },
      },
      {
        id: "b",
        title: "IndexNow",
        metric: "views",
        category: "acquisition",
        action: "index",
        expectedImpact: 5,
        confidence: 0.5,
        effort: 1,
        score: 8,
        safeActionType: "indexnow_submit",
        predicted: {
          precursorMetric: "landing_views",
          expectedProfitUsd: 40,
          confidence: 0.4,
          effort: 1,
          costUsd: 0,
          timeToSignalDays: 3,
        },
      },
    ],
    new Set(["indexnow_submit"]),
  );
  assert.equal(demoted[0]!.safeActionType, undefined);
  assert.equal(demoted[1]!.safeActionType, "indexnow_submit");
});

test("enqueue skips opportunities demoted to no safeActionType", async () => {
  const {
    demoteUnavailableSafeActions,
    enqueuePursuitsFromOpportunities,
    opportunitiesToHypotheses,
  } = await import("@revenueos/core");

  const opportunities = demoteUnavailableSafeActions(
    [
      {
        id: "missing-limb",
        title: "Needs GSC",
        metric: "views",
        category: "acquisition",
        action: "read gsc",
        expectedImpact: 9,
        confidence: 0.5,
        effort: 1,
        score: 90,
        safeActionType: "publish_intent_page",
        patternKey: "door:a",
        predicted: {
          precursorMetric: "landing_views",
          expectedProfitUsd: 200,
          confidence: 0.4,
          effort: 1,
          costUsd: 0,
          timeToSignalDays: 7,
        },
      },
      {
        id: "ok-limb",
        title: "IndexNow",
        metric: "views",
        category: "acquisition",
        action: "index",
        expectedImpact: 5,
        confidence: 0.5,
        effort: 1,
        score: 50,
        safeActionType: "indexnow_submit",
        patternKey: "index:a",
        predicted: {
          precursorMetric: "landing_views",
          expectedProfitUsd: 40,
          confidence: 0.4,
          effort: 1,
          costUsd: 0,
          timeToSignalDays: 3,
        },
      },
    ],
    new Set(["indexnow_submit"]),
  );
  const jobs = enqueuePursuitsFromOpportunities({
    siteId: "example-static",
    opportunities,
    hypotheses: opportunitiesToHypotheses(opportunities),
    existing: [],
  });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0]!.actionType, "indexnow_submit");
});

test("WAITING_FOR_EVIDENCE does not block claiming an independent EXECUTE job", async () => {
  const {
    createFileExperimentStore,
    createExampleStaticAdapter,
    advancePursuit,
    drainPursuits,
  } = await import("@revenueos/core");

  const dir = await mkdtemp(path.join(tmpdir(), "revenueos-wait-"));
  const adapter = createExampleStaticAdapter(dir);
  const store = createFileExperimentStore(dir);
  const now = new Date("2026-08-08T12:00:00.000Z");
  const waiting = {
    id: "pursuit_wait",
    siteId: "example-static",
    state: "WAITING_FOR_EVIDENCE" as const,
    kind: "organic_revenue" as const,
    actionType: "publish_intent_page",
    priority: 100,
    effort: 1,
    idempotencyKey: "wait:publish",
    attempts: 1,
    maxAttempts: 3,
    title: "Waiting publish",
    action: "measure",
    notBefore: new Date(now.getTime() + 7 * 86_400_000).toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  const ready = {
    id: "pursuit_ready",
    siteId: "example-static",
    state: "EXECUTE" as const,
    kind: "ops" as const,
    actionType: "scorecard_snapshot",
    priority: 50,
    effort: 1,
    idempotencyKey: "exec:scorecard",
    attempts: 0,
    maxAttempts: 3,
    title: "Scorecard",
    action: "snapshot",
    hypothesis: {
      id: "h1",
      title: "Scorecard",
      metric: "ops",
      predictedDelta: "+1",
      expectedImpact: 1,
      confidence: 0.9,
      effort: 1,
      action: "snapshot",
      constraintsChecked: ["policy"],
      category: "operations" as const,
      safeActionType: "scorecard_snapshot",
    },
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  await store.savePursuit!(waiting);
  await store.savePursuit!(ready);

  const observation = await adapter.observe();
  const drain = await drainPursuits({
    adapter: { ...adapter, getExperimentStore: () => store },
    store,
    observation,
    budgetMs: 10_000,
    maxJobs: 4,
    now,
  });
  assert.ok(drain.advanced >= 1);
  const after = await store.listPursuits!("example-static");
  const waitJob = after.find((j) => j.id === "pursuit_wait");
  const readyJob = after.find((j) => j.id === "pursuit_ready");
  assert.equal(waitJob?.state, "WAITING_FOR_EVIDENCE");
  assert.ok(
    readyJob?.state === "WAITING_FOR_EVIDENCE" || readyJob?.state === "DONE",
  );
  // Independent execute progressed despite a waiting experiment occupying a slot.
  assert.notEqual(readyJob?.attempts, 0);

  // Attribute only after notBefore
  const early = await advancePursuit({
    job: waitJob!,
    adapter: { ...adapter, getExperimentStore: () => store },
    store,
    observation,
    now,
  });
  assert.equal(early.state, "WAITING_FOR_EVIDENCE");
  const later = await advancePursuit({
    job: waitJob!,
    adapter: { ...adapter, getExperimentStore: () => store },
    store,
    observation,
    now: new Date(now.getTime() + 8 * 86_400_000),
  });
  assert.notEqual(later.state, "WAITING_FOR_EVIDENCE");
});

test("drainPursuits respects maxJobs budget", async () => {
  const { createFileExperimentStore, createExampleStaticAdapter, drainPursuits } =
    await import("@revenueos/core");
  const dir = await mkdtemp(path.join(tmpdir(), "revenueos-budget-"));
  const adapter = createExampleStaticAdapter(dir);
  const store = createFileExperimentStore(dir);
  const now = new Date("2026-08-08T12:00:00.000Z");
  for (let i = 0; i < 5; i += 1) {
    await store.savePursuit!({
      id: `pursuit_${i}`,
      siteId: "example-static",
      state: "EXECUTE",
      kind: "ops",
      actionType: "scorecard_snapshot",
      priority: 10 - i,
      effort: 1,
      idempotencyKey: `exec:${i}`,
      attempts: 0,
      maxAttempts: 3,
      title: `Job ${i}`,
      action: "snapshot",
      hypothesis: {
        id: `h${i}`,
        title: `Job ${i}`,
        metric: "ops",
        predictedDelta: "+1",
        expectedImpact: 1,
        confidence: 0.9,
        effort: 1,
        action: "snapshot",
        constraintsChecked: ["policy"],
        category: "operations",
        safeActionType: "scorecard_snapshot",
      },
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
  }
  const drain = await drainPursuits({
    adapter: { ...adapter, getExperimentStore: () => store },
    store,
    observation: await adapter.observe(),
    budgetMs: 30_000,
    maxJobs: 2,
    now,
  });
  assert.ok(drain.claimed <= 2);
  assert.ok(drain.advanced <= 2);
});

test("owner report summary shape answers what/learn/next", async () => {
  const { buildOwnerReportSummary, formatOwnerReport } = await import(
    "@revenueos/core"
  );
  const summary = buildOwnerReportSummary({
    siteId: "tributeready",
    windowStart: "2026-08-08T11:00:00.000Z",
    windowEnd: "2026-08-08T12:00:00.000Z",
    events: [
      {
        id: "e1",
        pursuitId: "p1",
        siteId: "tributeready",
        eventType: "claimed",
        detail: {},
        createdAt: "2026-08-08T11:10:00.000Z",
      },
      {
        id: "e2",
        pursuitId: "p1",
        siteId: "tributeready",
        eventType: "executed",
        detail: { ok: true, actionType: "indexnow_submit" },
        createdAt: "2026-08-08T11:11:00.000Z",
      },
      {
        id: "e3",
        pursuitId: "p1",
        siteId: "tributeready",
        eventType: "wait",
        detail: { until: "2026-08-15T11:11:00.000Z" },
        createdAt: "2026-08-08T11:11:01.000Z",
      },
    ],
    pursuits: [
      {
        id: "p1",
        siteId: "tributeready",
        state: "WAITING_FOR_EVIDENCE",
        kind: "discovery_door",
        priority: 10,
        effort: 1,
        idempotencyKey: "k1",
        attempts: 1,
        maxAttempts: 3,
        title: "Index door",
        action: "index",
        createdAt: "2026-08-08T11:00:00.000Z",
        updatedAt: "2026-08-08T11:11:00.000Z",
      },
      {
        id: "p2",
        siteId: "tributeready",
        state: "EXECUTE",
        kind: "ops",
        priority: 8,
        effort: 1,
        idempotencyKey: "k2",
        attempts: 0,
        maxAttempts: 3,
        title: "Next merch",
        action: "merch",
        createdAt: "2026-08-08T11:00:00.000Z",
        updatedAt: "2026-08-08T11:00:00.000Z",
      },
    ],
    hourRevenueUsd: 0,
    hourPurchases: 0,
    hourLandingViews: 4,
    hadExecutableCapacity: true,
  });
  assert.equal(summary.actionsCompleted, 1);
  assert.equal(summary.experimentsLaunched, 1);
  assert.equal(summary.waitingForEvidence, 1);
  assert.ok(summary.nextQueue.length >= 1);
  assert.ok(summary.workLines.some((line) => line.includes("executed")));
  const text = formatOwnerReport(summary);
  assert.match(text, /WHAT REVENUEOS DID/);
  assert.match(text, /NEXT PURSUIT QUEUE/);
  assert.match(text, /FUNNEL THIS HOUR/);
  // Progress happened → not operational failure even with $0 sales.
  assert.equal(summary.operationalFailure, false);
});

test("FIRST_CUSTOMER_MODE boosts buyer-exposure actions when purchases are zero", async () => {
  const {
    evaluateFirstCustomerMode,
    applyFirstCustomerPressure,
  } = await import("@revenueos/core");

  const mode = evaluateFirstCustomerMode({
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
      landingViews: 10,
      checkouts: 0,
      fulfillmentFailed: 0,
    },
    bottleneck: { level: 2, label: "traffic", detail: "need buyers" },
    openExperimentIds: [],
    errors: [],
  });
  assert.equal(mode.active, true);

  const ranked = applyFirstCustomerPressure({
    mode,
    opportunities: [
      {
        id: "polish",
        title: "Polish footer",
        metric: "views",
        category: "operations",
        action: "polish",
        expectedImpact: 1,
        confidence: 0.5,
        effort: 1,
        score: 50,
        safeActionType: "scorecard_snapshot",
      },
      {
        id: "door",
        title: "Publish intent door",
        metric: "views",
        category: "acquisition",
        action: "publish",
        expectedImpact: 8,
        confidence: 0.5,
        effort: 1,
        score: 50,
        safeActionType: "publish_intent_page",
      },
    ],
  });
  assert.equal(ranked[0]!.safeActionType, "publish_intent_page");
  assert.ok(ranked[0]!.score > ranked[1]!.score);
});

test("negative transfer blocks death-care lessons on freelancer tools", async () => {
  const { isNegativeTransfer, filterTransferableLessons } = await import(
    "@revenueos/core"
  );
  assert.equal(isNegativeTransfer("death-care", "freelancer-finance"), true);
  assert.equal(isNegativeTransfer("freelancer-finance", "freelancer-finance"), false);

  const filtered = filterTransferableLessons({
    target: { industry: "freelancer-finance", businessModel: "digital_download" },
    lessons: [
      {
        id: "l1",
        scope: "industry",
        industry: "death-care",
        patternKey: "ever-loved",
        summary: "Funeral partner door",
        evidenceCount: 3,
        transferable: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "l2",
        scope: "industry",
        industry: "freelancer-finance",
        patternKey: "invoice-template-seo",
        summary: "Invoice SEO works",
        evidenceCount: 2,
        transferable: true,
        commercial: {
          businessModel: "digital_download",
          industry: "freelancer-finance",
        },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]!.id, "l2");
});

test("portfolio allocator ranks FIRST_CUSTOMER businesses for effort", async () => {
  const { rankPortfolioEffort, snapshotFromMetrics } = await import(
    "@revenueos/core"
  );
  const allocation = rankPortfolioEffort([
    snapshotFromMetrics({
      siteId: "raiseready",
      displayName: "RaiseReady",
      sequenceIndex: 1,
      revenueUsd: 0,
      contributionProfitUsd: 0,
      purchases: 0,
      landingViews: 5,
      activePursuits: 0,
      waitingForEvidence: 0,
      claimableBacklog: 0,
    }),
    snapshotFromMetrics({
      siteId: "ledgerleaf",
      displayName: "Ledgerleaf",
      sequenceIndex: 2,
      revenueUsd: 290,
      contributionProfitUsd: 260,
      purchases: 10,
      landingViews: 400,
      activePursuits: 2,
      waitingForEvidence: 1,
      claimableBacklog: 3,
    }),
  ]);
  assert.ok(allocation.effortOrder.includes("raiseready"));
  assert.ok(allocation.notes.some((n) => n.includes("FIRST_CUSTOMER")));
});

test("three identical zero-result cycles force strategy mutation", async () => {
  const {
    buildCycleFingerprint,
    detectExecutionStagnation,
    mutateOpportunitiesAfterStagnation,
  } = await import("@revenueos/core");

  const fp = () =>
    buildCycleFingerprint({
      actionTypes: ["indexnow_submit", "distribute_owned_urls"],
      purchases: 0,
      revenueUsd: 0,
      landingViews: 0,
      checkouts: 0,
      stage: "buyer_exposure",
    });

  const hour1 = fp();
  const hour2 = fp();
  const hour3 = fp();
  const verdict = detectExecutionStagnation({
    prior: [hour1, hour2],
    current: hour3,
  });
  assert.equal(verdict.systemFailure, true);
  assert.ok(verdict.consecutiveIdentical >= 3);
  assert.ok(verdict.killActionTypes.includes("indexnow_submit"));

  const mutated = mutateOpportunitiesAfterStagnation({
    opportunities: [
      {
        id: "a",
        title: "IndexAgain",
        metric: "views",
        category: "acquisition",
        action: "index",
        expectedImpact: 8,
        confidence: 0.6,
        effort: 1,
        score: 90,
        safeActionType: "indexnow_submit",
      },
      {
        id: "b",
        title: "Comparison page",
        metric: "views",
        category: "acquisition",
        action: "publish",
        expectedImpact: 7,
        confidence: 0.55,
        effort: 1,
        score: 40,
        safeActionType: "publish_comparison_page",
      },
    ],
    killActionTypes: verdict.killActionTypes,
  });
  assert.equal(mutated[0]?.safeActionType, "publish_comparison_page");
  assert.ok((mutated[0]?.score ?? 0) > (mutated[1]?.score ?? 0));
});

test("infrastructure-only zero-result cycle is stagnant without waiting for hour 3", async () => {
  const { buildCycleFingerprint, detectExecutionStagnation } = await import(
    "@revenueos/core"
  );
  const current = buildCycleFingerprint({
    actionTypes: ["indexnow_submit", "sitemap_ping"],
    purchases: 0,
    revenueUsd: 0,
    landingViews: 0,
    stage: "buyer_exposure",
  });
  const verdict = detectExecutionStagnation({ prior: [], current });
  assert.equal(verdict.stagnant, true);
  assert.match(verdict.reason, /Infrastructure-only|mutate/i);
});

test("pattern posteriors ban a mechanism after N attempts with zero signal", async () => {
  const {
    buildPatternPosteriors,
    computePatternGate,
    PATTERN_ATTEMPT_BUDGET,
  } = await import("@revenueos/core");

  const events = Array.from({ length: PATTERN_ATTEMPT_BUDGET }, (_, i) => ({
    id: `e${i}`,
    pursuitId: `p${i}`,
    siteId: "raiseready",
    eventType: "executed" as const,
    detail: {
      ok: true,
      actionType: "publish_free_resource",
      patternKey: "permissionless-free-resource",
      actionClass: "production",
    },
    createdAt: new Date(Date.now() - (i + 1) * 60_000).toISOString(),
  }));

  const posteriors = buildPatternPosteriors({
    events,
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
        landingViews: 0,
        checkouts: 0,
        fulfillmentFailed: 0,
      },
      bottleneck: { level: 2, label: "no buyers", detail: "invisible" },
      openExperimentIds: [],
      errors: [],
    },
  });
  const p = posteriors["permissionless-free-resource"];
  assert.ok(p, "posterior recorded");
  assert.equal(p.banned, true);
  const gate = computePatternGate(posteriors);
  assert.ok(gate.bannedPatterns.has("permissionless-free-resource"));
  assert.ok(gate.bannedMechanisms.has("owned_content"));
});

test("banned patterns are dropped and banned mechanisms are demoted", async () => {
  const { applyPatternGate } = await import("@revenueos/core");
  const gate = {
    bannedPatterns: new Set(["permissionless-free-resource"]),
    bannedMechanisms: new Set(["owned_content" as const]),
    reasons: { "permissionless-free-resource": "no signal" },
  };
  const kept = applyPatternGate({
    gate,
    opportunities: [
      {
        id: "a",
        title: "another content page",
        metric: "views",
        category: "acquisition",
        action: "publish",
        expectedImpact: 8,
        confidence: 0.6,
        effort: 1,
        score: 90,
        safeActionType: "publish_comparison_page",
        patternKey: "permissionless-comparison",
      },
      {
        id: "b",
        title: "same banned pattern",
        metric: "views",
        category: "acquisition",
        action: "publish",
        expectedImpact: 8,
        confidence: 0.6,
        effort: 1,
        score: 95,
        safeActionType: "publish_free_resource",
        patternKey: "permissionless-free-resource",
      },
      {
        id: "c",
        title: "distribution",
        metric: "urls",
        category: "acquisition",
        action: "ping",
        expectedImpact: 6,
        confidence: 0.55,
        effort: 1,
        score: 40,
        safeActionType: "indexnow_submit",
        patternKey: "indexnow-discovery",
      },
    ],
  });
  const keys = kept.map((o) => o.patternKey);
  assert.ok(!keys.includes("permissionless-free-resource"));
  const distribution = kept.find((o) => o.patternKey === "indexnow-discovery");
  const bannedFamily = kept.find(
    (o) => o.patternKey === "permissionless-comparison",
  );
  assert.ok(distribution);
  assert.ok(bannedFamily);
  assert.ok((distribution!.score ?? 0) > (bannedFamily!.score ?? 0));
});

test("mechanism diversity caps same-family enqueue and prefers unbanned", async () => {
  const { enforceMechanismDiversity } = await import("@revenueos/core");
  const opps = [
    { id: "1", title: "content1", metric: "v", category: "acquisition", action: "x", expectedImpact: 8, confidence: 0.6, effort: 1, score: 90, safeActionType: "publish_free_resource", patternKey: "p1" },
    { id: "2", title: "content2", metric: "v", category: "acquisition", action: "x", expectedImpact: 8, confidence: 0.6, effort: 1, score: 85, safeActionType: "publish_howto_cluster", patternKey: "p2" },
    { id: "3", title: "content3", metric: "v", category: "acquisition", action: "x", expectedImpact: 8, confidence: 0.6, effort: 1, score: 80, safeActionType: "publish_intent_page", patternKey: "p3" },
    { id: "4", title: "content4", metric: "v", category: "acquisition", action: "x", expectedImpact: 8, confidence: 0.6, effort: 1, score: 75, safeActionType: "publish_comparison_page", patternKey: "p4" },
    { id: "5", title: "distribute", metric: "v", category: "acquisition", action: "x", expectedImpact: 6, confidence: 0.6, effort: 1, score: 50, safeActionType: "distribute_owned_urls", patternKey: "d1" },
  ] as const;
  const capped = enforceMechanismDiversity({
    opportunities: opps.map((o) => ({ ...o })),
    bannedMechanisms: new Set(["owned_content"]),
    maxPerMechanism: 3,
  });
  const first = capped[0]!;
  assert.equal(first.patternKey, "d1");
  const contentCount = capped.filter(
    (o) => (o.safeActionType ?? "").startsWith("publish_"),
  ).length;
  assert.ok(contentCount <= 3);
});

test("revenue priority boosts patterns with own commercial signal", async () => {
  const {
    applyRevenuePriority,
    EMPTY_PORTFOLIO_SIGNAL,
  } = await import("@revenueos/core");
  const ownPosteriors: Record<string, any> = {
    "proven-checkout": {
      patternKey: "proven-checkout",
      mechanism: "conversion_optimization",
      attempts: 3,
      distributionAttempts: 0,
      productionAttempts: 0,
      verifiedExposures: 12,
      intents: 4,
      commercialOutcomes: 2,
      commercialScore: 60,
      banned: false,
      lastAttemptAt: new Date().toISOString(),
      firstAttemptAt: new Date().toISOString(),
    },
  };
  const scored = applyRevenuePriority({
    opportunities: [
      { id: "a", title: "proven", metric: "purchases", category: "conversion", action: "x", expectedImpact: 8, confidence: 0.6, effort: 1, score: 10, safeActionType: "rewrite_page_copy", patternKey: "proven-checkout" } as any,
      { id: "b", title: "unknown", metric: "views", category: "acquisition", action: "x", expectedImpact: 8, confidence: 0.6, effort: 1, score: 90, safeActionType: "publish_free_resource", patternKey: "unknown-pattern" } as any,
    ],
    ownPosteriors,
    portfolioSignal: EMPTY_PORTFOLIO_SIGNAL,
    bannedMechanisms: new Set(),
  });
  assert.equal(scored[0]!.patternKey, "proven-checkout");
});

test("revenue priority transfers portfolio commercial signal across sites", async () => {
  const {
    applyRevenuePriority,
    buildPortfolioSignal,
  } = await import("@revenueos/core");
  const portfolioSignal = buildPortfolioSignal({
    perSitePosteriors: [
      {
        siteId: "raiseready",
        posteriors: {
          "outreach-A": {
            patternKey: "outreach-A",
            mechanism: "direct_outreach",
            attempts: 3,
            distributionAttempts: 0,
            productionAttempts: 0,
            verifiedExposures: 5,
            intents: 2,
            commercialOutcomes: 1,
            commercialScore: 25,
            banned: false,
            lastAttemptAt: new Date().toISOString(),
            firstAttemptAt: new Date().toISOString(),
          } as any,
        },
      },
    ],
    excludeSiteId: "ledgerleaf",
  });
  const scored = applyRevenuePriority({
    opportunities: [
      { id: "a", title: "transferable", metric: "purchases", category: "acquisition", action: "x", expectedImpact: 8, confidence: 0.6, effort: 1, score: 10, safeActionType: "cold_outreach", patternKey: "outreach-A" } as any,
      { id: "b", title: "cold content", metric: "views", category: "acquisition", action: "x", expectedImpact: 8, confidence: 0.6, effort: 1, score: 30, safeActionType: "publish_free_resource", patternKey: "cold-content" } as any,
    ],
    ownPosteriors: {},
    portfolioSignal,
    bannedMechanisms: new Set(),
  });
  assert.equal(scored[0]!.patternKey, "outreach-A");
});

test("portfolio allocator drops suspended sites and demotes exhausted ones", async () => {
  const { rankPortfolioEffort, snapshotFromMetrics } = await import(
    "@revenueos/core"
  );
  const alloc = rankPortfolioEffort([
    snapshotFromMetrics({
      siteId: "raiseready",
      displayName: "raiseready",
      sequenceIndex: 1,
      revenueUsd: 0,
      contributionProfitUsd: 0,
      purchases: 0,
      landingViews: 0,
      activePursuits: 0,
      waitingForEvidence: 0,
      claimableBacklog: 2,
    }),
    snapshotFromMetrics({
      siteId: "mendhaus",
      displayName: "mendhaus",
      sequenceIndex: 2,
      revenueUsd: 0,
      contributionProfitUsd: 0,
      purchases: 0,
      landingViews: 0,
      activePursuits: 0,
      waitingForEvidence: 0,
      claimableBacklog: 2,
      suspended: true,
    }),
    snapshotFromMetrics({
      siteId: "closeshift",
      displayName: "closeshift",
      sequenceIndex: 3,
      revenueUsd: 0,
      contributionProfitUsd: 0,
      purchases: 0,
      landingViews: 0,
      activePursuits: 0,
      waitingForEvidence: 0,
      claimableBacklog: 2,
      bannedPatternCount: 6,
    }),
  ]);
  assert.equal(alloc.effortOrder[0], "raiseready");
  assert.equal(alloc.effortOrder[alloc.effortOrder.length - 1], "mendhaus");
});

test("beacon ingests page_view as verified_exposure and dedupes within window", async () => {
  const { ingestBeaconEvent } = await import("@revenueos/core");
  const events: any[] = [];
  const store = {
    listPursuitEvents: async () => events.slice(),
    appendPursuitEvent: async (e: any) => {
      events.push(e);
    },
  } as any;
  const first = await ingestBeaconEvent({
    event: {
      kind: "page_view",
      siteId: "raiseready",
      url: "https://x.dev/topics/foo",
      path: "/topics/foo",
      ua: "Mozilla/5.0 real browser",
      ip: "203.0.113.10",
    },
    store,
  });
  assert.equal(first.ok, true);
  assert.equal((first as any).actionClass, "verified_exposure");
  const dupe = await ingestBeaconEvent({
    event: {
      kind: "page_view",
      siteId: "raiseready",
      url: "https://x.dev/topics/foo",
      path: "/topics/foo",
      ua: "Mozilla/5.0 real browser",
      ip: "203.0.113.10",
    },
    store,
  });
  assert.equal(dupe.ok, false);
});

test("beacon rejects bot user agents", async () => {
  const { ingestBeaconEvent } = await import("@revenueos/core");
  const store = { appendPursuitEvent: async () => {} } as any;
  const r = await ingestBeaconEvent({
    event: {
      kind: "page_view",
      siteId: "raiseready",
      url: "x",
      ua: "Googlebot/2.1 (+http://google.com/bot.html)",
    },
    store,
  });
  assert.equal(r.ok, false);
});

test("mechanism bandit picks proven mechanism with high probability", async () => {
  const {
    buildMechanismArms,
    sampleMechanismRanking,
  } = await import("@revenueos/core");
  const ownPosteriors: Record<string, any> = {
    "outreach-A": {
      patternKey: "outreach-A",
      mechanism: "direct_outreach",
      attempts: 3,
      distributionAttempts: 0,
      productionAttempts: 0,
      verifiedExposures: 8,
      intents: 4,
      commercialOutcomes: 2,
      commercialScore: 60,
      banned: false,
      lastAttemptAt: null,
      firstAttemptAt: null,
    },
    "content-B": {
      patternKey: "content-B",
      mechanism: "owned_content",
      attempts: 10,
      distributionAttempts: 0,
      productionAttempts: 10,
      verifiedExposures: 0,
      intents: 0,
      commercialOutcomes: 0,
      commercialScore: 0,
      banned: true,
      lastAttemptAt: null,
      firstAttemptAt: null,
    },
  };
  const arms = buildMechanismArms({
    ownPosteriors,
    bannedMechanisms: new Set(["owned_content"]),
  });
  // Deterministic sampler for test — pull the same values so proven arm wins.
  const rand = mulberry32(42);
  let wins = 0;
  for (let i = 0; i < 50; i++) {
    const s = sampleMechanismRanking({ arms, rand });
    if (s.best === "direct_outreach") wins += 1;
  }
  assert.ok(wins > 30, `direct_outreach should dominate; won ${wins}/50`);
});

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("conversion lab injects offer/CTA/urgency when landing_views > 0", async () => {
  const { proposeConversionExperiments } = await import("@revenueos/core");
  const items = proposeConversionExperiments({
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
        landingViews: 25,
        checkouts: 3,
        fulfillmentFailed: 0,
      },
      bottleneck: { level: 3, label: "funnel", detail: "no purchases" },
      openExperimentIds: [],
      errors: [],
    } as any,
  });
  assert.ok(items.length >= 4);
  const kinds = items.map((i) => i.patternKey!).join("|");
  assert.ok(kinds.includes("conv:cta_directness"));
  assert.ok(kinds.includes("conv:guarantee"));
  assert.ok(kinds.includes("conv:urgency"));
});

test("conversion lab is silent when no verified traffic yet", async () => {
  const { proposeConversionExperiments } = await import("@revenueos/core");
  const items = proposeConversionExperiments({
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
        landingViews: 0,
        checkouts: 0,
        fulfillmentFailed: 0,
      },
      bottleneck: { level: 2, label: "no buyers", detail: "invisible" },
      openExperimentIds: [],
      errors: [],
    } as any,
  });
  assert.equal(items.length, 0);
});

test("concrete escalations propose specific providers with cost", async () => {
  const { proposeUnlocksForBannedMechanisms } = await import("@revenueos/core");
  const proposals = proposeUnlocksForBannedMechanisms({
    bannedMechanisms: new Set(["owned_content", "owned_distribution"]),
    siteId: "raiseready",
  });
  assert.ok(proposals.length >= 1);
  assert.ok(proposals[0]!.providers.length >= 1);
  assert.ok(typeof proposals[0]!.providers[0]!.costPerMonthUsd === "number");
  // Owned content is banned → should NOT be top proposal
  assert.notEqual(proposals[0]!.mechanism, "owned_content");
});

test("owner-blocked business is suspended and enqueue is skipped", async () => {
  const { evaluateBusinessSuspension } = await import("@revenueos/core");
  const v = evaluateBusinessSuspension({
    context: {
      siteId: "mendhaus",
      displayName: "Mendhaus",
      industry: "retail",
      products: [],
      funnelSteps: [],
      brandVoice: "",
      allowedChannels: [],
      autonomousDailyCapUsd: 0,
      timezone: "UTC",
      constraints: ["OWNER_BLOCKED_FULFILLMENT"],
    } as any,
  });
  assert.equal(v.suspended, true);
  assert.ok(v.blockingConstraints.includes("OWNER_BLOCKED_FULFILLMENT"));
});

test("portfolio digest marks zero-action FCM cycle as FAILED", async () => {
  const {
    buildPortfolioDigest,
    formatPortfolioOwnerEmail,
    portfolioDigestSubject,
  } = await import("@revenueos/core");
  const digest = buildPortfolioDigest({
    windowStart: "2026-08-09T06:00:00.000Z",
    windowEnd: "2026-08-09T07:00:00.000Z",
    sites: [
      {
        siteId: "raiseready",
        displayName: "RaiseReady",
        url: "https://raiseready.example",
        commerciallyLive: true,
        checkoutOpen: true,
        purchases: 0,
        revenueUsd: 0,
        firstCustomerMode: true,
        firstCustomerStage: "buyer_exposure",
        actionsCompleted: 0,
        exposureNotes: ["https://raiseready.example/topics/x"],
        blockers: [],
        durableLedger: "ephemeral",
      },
    ],
  });
  assert.equal(digest.cycleStatus, "failed");
  assert.equal(digest.totalActionsCompleted, 0);
  const text = formatPortfolioOwnerEmail(digest);
  assert.match(text, /CYCLE FAILED|FAILED/);
  assert.match(text, /THIS HOUR/);
  assert.match(portfolioDigestSubject(digest), /CYCLE FAILED/);
});

// ─────────────────────────────────────────────────────────────────────────────
// Learning & self-improvement layer
// ─────────────────────────────────────────────────────────────────────────────

test("knowledge-graph records and queries outcome edges", async () => {
  const { recordOutcomeEdge, queryKnowledgeGraph, createFileExperimentStore } =
    await import("@revenueos/core");
  const dir = await mkdtemp(path.join(tmpdir(), "revenueos-kg-"));
  const store = createFileExperimentStore(dir);
  await recordOutcomeEdge({
    store,
    edge: {
      siteId: "raiseready",
      segment: "small_biz_owner",
      mechanism: "direct_outreach",
      surface: "email",
      outcome: "commercial",
      revenueUsd: 199,
      business: "raiseready",
    },
  });
  await recordOutcomeEdge({
    store,
    edge: {
      siteId: "raiseready",
      segment: "small_biz_owner",
      mechanism: "owned_content",
      surface: "blog",
      outcome: "verified_exposure",
      revenueUsd: 0,
      business: "raiseready",
    },
  });
  const q = await queryKnowledgeGraph({
    store,
    siteId: "raiseready",
    query: { segment: "small_biz_owner" },
  });
  assert.equal(q.edges.length, 2);
  assert.equal(q.aggregate.commercialWins, 1);
  assert.ok(q.aggregate.revenueUsd >= 199);
  assert.equal(q.aggregate.topMechanisms[0]!.mechanism, "direct_outreach");
});

test("attribution-ml gives higher weight to more recent pursuits", async () => {
  const { attributeSignalToPatterns } = await import("@revenueos/core");
  const now = new Date("2026-06-01T12:00:00.000Z");
  const events: any[] = [
    // Old pursuit — 24h before signal.
    {
      id: "e1",
      pursuitId: "p1",
      siteId: "s",
      eventType: "executed",
      createdAt: "2026-05-31T11:00:00.000Z",
      detail: { ok: true, patternKey: "old-pattern", actionType: "publish_intent_page" },
    },
    // Recent pursuit — 1h before signal.
    {
      id: "e2",
      pursuitId: "p2",
      siteId: "s",
      eventType: "executed",
      createdAt: "2026-06-01T10:30:00.000Z",
      detail: { ok: true, patternKey: "recent-pattern", actionType: "publish_intent_page" },
    },
    // Beacon event that could be attributed to either.
    {
      id: "s1",
      pursuitId: "beacon",
      siteId: "s",
      eventType: "beacon",
      createdAt: "2026-06-01T11:30:00.000Z",
      detail: { kind: "page_view", url: "https://x.example/t" },
    },
  ];
  const records = attributeSignalToPatterns({ events, now, decayHalfLifeMs: 6 * 3_600_000 });
  const byKey = new Map<string, number>();
  for (const r of records) byKey.set(r.patternKey, (byKey.get(r.patternKey) ?? 0) + r.weight);
  assert.ok(
    (byKey.get("recent-pattern") ?? 0) > (byKey.get("old-pattern") ?? 0),
    "recent pursuit must dominate weight",
  );
});

test("anomaly-detector fires on traffic spike vs baseline", async () => {
  const { detectStreamAnomalies } = await import("@revenueos/core");
  const now = new Date("2026-06-08T12:00:00.000Z");
  // 7 days of low baseline: 1 view/day.
  const events: any[] = [];
  for (let i = 1; i <= 7; i++) {
    events.push({
      id: `b${i}`,
      pursuitId: "beacon",
      siteId: "raiseready",
      eventType: "beacon",
      createdAt: new Date(now.getTime() - (i + 1) * 24 * 3_600_000).toISOString(),
      detail: { kind: "page_view", url: "https://r.example/t" },
    });
  }
  // Current 24h: 100 views — a huge spike.
  for (let i = 0; i < 100; i++) {
    events.push({
      id: `c${i}`,
      pursuitId: "beacon",
      siteId: "raiseready",
      eventType: "beacon",
      createdAt: new Date(now.getTime() - (i + 1) * 60_000).toISOString(),
      detail: { kind: "page_view", url: "https://r.example/t" },
    });
  }
  const found = detectStreamAnomalies({ events, now });
  const spike = found.find((a) => a.kind === "traffic_spike");
  assert.ok(spike, "should detect traffic spike");
  assert.ok((spike!.current ?? 0) > (spike!.baseline ?? 0));
});

test("self-improving-strategist samples different prompts under different priors", async () => {
  const { selectStrategistPromptVersion } = await import("@revenueos/core");
  // Deterministic PRNG so we can compare arms head-to-head.
  const rand = mulberry32(7);
  // Give v1_direct many wins, v2_socratic many losses — v1 should dominate.
  const outcomes = [
    ...Array.from({ length: 30 }, () => ({ versionId: "v1_direct", siteId: "s", ok: true, ts: "" })),
    ...Array.from({ length: 30 }, () => ({ versionId: "v2_socratic", siteId: "s", ok: false, ts: "" })),
  ] as any[];
  let v1 = 0;
  let v2 = 0;
  for (let i = 0; i < 60; i++) {
    const s = selectStrategistPromptVersion({ outcomes, rand });
    if (s.version.id === "v1_direct") v1 += 1;
    else if (s.version.id === "v2_socratic") v2 += 1;
  }
  assert.ok(v1 > v2, `v1_direct should dominate; v1=${v1} v2=${v2}`);
  // With NO outcomes and a different seed, sampling must still choose from >=2 versions.
  const seen = new Set<string>();
  const rand2 = mulberry32(11);
  for (let i = 0; i < 40; i++) {
    const s = selectStrategistPromptVersion({ outcomes: [], rand: rand2 });
    seen.add(s.version.id);
  }
  assert.ok(seen.size >= 2, "with no outcomes the sampler should explore multiple prompts");
});

test("ltv-cac-model ranks direct_outreach above owned_content when direct_outreach has commercial signal", async () => {
  const { mechanismProfitabilityRanking } = await import("@revenueos/core");
  const posteriors: any = {
    "outreach-a": {
      patternKey: "outreach-a",
      mechanism: "direct_outreach",
      attempts: 5,
      distributionAttempts: 0,
      productionAttempts: 0,
      verifiedExposures: 4,
      intents: 3,
      commercialOutcomes: 2,
      commercialScore: 60,
      banned: false,
      lastAttemptAt: null,
      firstAttemptAt: null,
    },
    "content-a": {
      patternKey: "content-a",
      mechanism: "owned_content",
      attempts: 20,
      distributionAttempts: 0,
      productionAttempts: 20,
      verifiedExposures: 0,
      intents: 0,
      commercialOutcomes: 0,
      commercialScore: 0,
      banned: false,
      lastAttemptAt: null,
      firstAttemptAt: null,
    },
  };
  const ranking = mechanismProfitabilityRanking({
    posteriors,
    context: {
      siteId: "s",
      displayName: "S",
      industry: "saas",
      products: [{ id: "p1", name: "core", priceUsd: 199, marginEstimate: 0.7 }],
      funnelSteps: [],
      brandVoice: "",
      allowedChannels: [],
      autonomousDailyCapUsd: 0,
      timezone: "UTC",
      constraints: [],
    } as any,
  });
  assert.equal(ranking[0]!.mechanism, "direct_outreach");
  const outreachIdx = ranking.findIndex((r) => r.mechanism === "direct_outreach");
  const contentIdx = ranking.findIndex((r) => r.mechanism === "owned_content");
  assert.ok(
    outreachIdx < contentIdx,
    `direct_outreach (idx ${outreachIdx}) must rank above owned_content (idx ${contentIdx})`,
  );
});

test("compliance-guard rejects URL whose robots.txt disallows POST-like paths", async () => {
  const { shouldAllowExternalContact } = await import("@revenueos/core");
  const fetchImpl = (async (url: string) => {
    if (url.endsWith("/robots.txt")) {
      return {
        ok: true,
        status: 200,
        text: async () => "User-agent: *\nDisallow: /submit\n",
      } as any;
    }
    return { ok: false, status: 404, text: async () => "" } as any;
  }) as unknown as typeof fetch;
  const verdict = await shouldAllowExternalContact({
    targetUrl: "https://example.com/submit/form",
    action: "http_post",
    fetchImpl,
    timeoutMs: 200,
  });
  assert.equal(verdict.allowed, false);
  assert.ok(verdict.reasons.some((r) => r.startsWith("robots_disallow")));

  const okVerdict = await shouldAllowExternalContact({
    targetUrl: "https://example.com/open/path",
    action: "http_post",
    fetchImpl,
    timeoutMs: 200,
  });
  assert.equal(okVerdict.allowed, true);
});

test("target-tracking sets aggressiveness=high when 24h in with <5% progress", async () => {
  const {
    progressTowardTarget,
    aggressivenessDial,
    TARGET_DAILY_PROFIT_USD_PER_BUSINESS,
  } = await import("@revenueos/core");
  const p = progressTowardTarget({
    observation: { estimatedProfitUsd: 200, revenueUsd: 500 } as any,
    hoursSinceStart: 24,
    siteId: "raiseready",
  });
  assert.equal(p.targetProfitUsd, TARGET_DAILY_PROFIT_USD_PER_BUSINESS);
  assert.ok(p.progressPercent < 5);
  assert.equal(p.status, "behind");
  const dial = aggressivenessDial({
    progressPercent: p.progressPercent,
    hoursSinceStart: p.hoursSinceStart,
  });
  assert.equal(dial.level, "high");
  assert.ok(dial.concurrencyMultiplier >= 2);
  assert.ok(dial.mechanismExplorationMultiplier >= 2);
  assert.ok(dial.mutationFrequencyMultiplier >= 2);
  // On-pace baseline case: no scaling.
  const baseline = aggressivenessDial({ progressPercent: 60, hoursSinceStart: 12 });
  assert.equal(baseline.level, "low");
  assert.equal(baseline.concurrencyMultiplier, 1);
});

test("owner-dialog falls back deterministically without an OpenAI key", async () => {
  const { handleOwnerMessage } = await import("@revenueos/core");
  const prev = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const r = await handleOwnerMessage({
      message: "pause turnoverkit and prioritize raiseready",
      state: {
        activeBusinesses: [
          { siteId: "turnoverkit", displayName: "TurnoverKit", revenueUsd: 0 },
          { siteId: "raiseready", displayName: "RaiseReady", revenueUsd: 12 },
        ],
      },
    });
    assert.equal(r.source, "deterministic");
    const ops = r.proposedChanges.map((c) => c.op);
    assert.ok(ops.includes("pause_business"));
    assert.ok(ops.includes("prioritize_business"));
  } finally {
    if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
  }
});

test("knowledge-graph transferrableInsights carries lessons across sites", async () => {
  const { recordOutcomeEdge, transferrableInsights, createFileExperimentStore } =
    await import("@revenueos/core");
  const dir = await mkdtemp(path.join(tmpdir(), "revenueos-kg-transfer-"));
  const store = createFileExperimentStore(dir);
  await recordOutcomeEdge({
    store,
    edge: {
      siteId: "listinglift",
      business: "listinglift",
      segment: "airbnb_hosts",
      mechanism: "community_participation",
      surface: "hostforum",
      outcome: "commercial",
      revenueUsd: 89,
    },
  });
  await recordOutcomeEdge({
    store,
    edge: {
      siteId: "listinglift",
      business: "listinglift",
      segment: "airbnb_hosts",
      mechanism: "community_participation",
      surface: "hostforum",
      outcome: "intent",
    },
  });
  const insights = await transferrableInsights({
    store,
    sourceSiteId: "listinglift",
    targetSiteId: "turnoverkit",
    minScore: 4,
  });
  assert.ok(insights.length >= 1);
  assert.equal(insights[0]!.mechanism, "community_participation");
});

// ─────────────────────────────────────────────────────────────────────────────
// Executor layer: web-search / buyer-discovery / public-outreach / schema /
// revenue-hunter / LLM strategist wiring
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Install a stub for global fetch that returns a canned OpenAI Responses API
 * body for the given payload. Restores the original fetch on `restore()`.
 */
function stubOpenAIFetch(
  responseFor: (body: {
    model: string;
    input: unknown;
    text?: unknown;
    tools?: unknown;
  }) => unknown,
) {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    if (typeof url === "string" && url.includes("api.openai.com")) {
      calls += 1;
      const body = init?.body ? JSON.parse(init.body as string) : {};
      const data = responseFor(body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          output_text: typeof data === "string" ? data : JSON.stringify(data),
          usage: { input_tokens: 10, output_tokens: 40 },
        }),
        text: async () => (typeof data === "string" ? data : JSON.stringify(data)),
      } as any;
    }
    return originalFetch(url as any, init as any);
  }) as any;
  return {
    get calls() {
      return calls;
    },
    restore() {
      globalThis.fetch = originalFetch;
    },
  };
}

test("llm-strategist returns empty list when OPENAI_API_KEY absent", async () => {
  const { proposeLlmStrategies } = await import("@revenueos/core");
  const prev = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const res = await proposeLlmStrategies({
      context: {
        siteId: "raiseready",
        displayName: "RaiseReady",
        industry: "saas",
        products: [
          { id: "p1", name: "Kit", priceUsd: 29, marginEstimate: 0.9 },
        ],
        funnelSteps: [],
        brandVoice: "",
        allowedChannels: [],
        autonomousDailyCapUsd: 0,
        timezone: "UTC",
        constraints: [],
      } as any,
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
          landingViews: 0,
          checkouts: 0,
          fulfillmentFailed: 0,
        },
        bottleneck: { level: 1, label: "n/a", detail: "" },
        openExperimentIds: [],
        errors: [],
      } as any,
      bannedMechanisms: new Set(),
      bannedPatterns: new Set(),
      patternPosteriors: {},
    });
    assert.equal(res.opportunities.length, 0);
    assert.equal(res.hypotheses.length, 0);
    assert.match(res.reason ?? "", /OPENAI_API_KEY/);
  } finally {
    if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
  }
});

test("web-search parses OpenAI response correctly given mocked fetch", async () => {
  const { queryWebForBuyingIntent } = await import("@revenueos/core");
  const prev = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "sk-test-1234567890123456789012345";
  const stub = stubOpenAIFetch(() => ({
    results: [
      {
        url: "https://forum.example.com/thread/1",
        snippet: "how do I raise starting salary",
        buyerSignal: "high",
        angle: "point them to the negotiation kit",
      },
      {
        url: "not-a-url",
        snippet: "ignore me",
        buyerSignal: "low",
        angle: "n/a",
      },
    ],
  }));
  try {
    const res = await queryWebForBuyingIntent({
      topic: "salary negotiation",
      industry: "career",
      personas: ["knowledge worker"],
      maxResults: 4,
    });
    assert.equal(res.ok, true);
    assert.equal(res.results.length, 1);
    assert.equal(res.results[0]!.buyerSignal, "high");
    assert.match(res.results[0]!.url, /^https:\/\//);
    assert.ok(stub.calls >= 1, "should call OpenAI at least once");
  } finally {
    stub.restore();
    if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
    else delete process.env.OPENAI_API_KEY;
  }
});

test("buyer-discovery filters low-score leads", async () => {
  const { discoverBuyers, filterLowScoreLeads } = await import("@revenueos/core");
  const prev = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "sk-test-1234567890123456789012345";
  const stub = stubOpenAIFetch((body) => {
    const msgs = ((body.input as any[]) ?? []).map((m) =>
      (m.content ?? []).map((c: any) => c.text ?? "").join(" "),
    );
    const asStr = msgs.join(" ");
    if (body.tools) {
      // web_search call — return raw results.
      return {
        results: [
          {
            url: "https://forum.example.com/a",
            snippet: "buyer surface",
            buyerSignal: "high",
            angle: "kit",
          },
        ],
      };
    }
    // second (non-tools) call: return leads with mixed scores.
    return {
      leads: [
        {
          url: "https://forum.example.com/a",
          surface: "forum thread",
          segment: "seg1",
          whyMatch: "buyer asking specifically about the product",
          reachMethod: "public_form",
          score: 82,
        },
        {
          url: "https://blog.example.com/b",
          surface: "blog comment",
          segment: "seg2",
          whyMatch: "tangential",
          reachMethod: "blog_comment",
          score: 12,
        },
      ],
    };
    void asStr;
  });
  try {
    const res = await discoverBuyers({
      topic: "salary",
      productName: "RaiseReady",
      productDescription: "salary negotiation kit",
      minScore: 40,
      maxLeads: 5,
    });
    assert.equal(res.ok, true);
    assert.equal(res.leads.length, 1);
    assert.equal(res.leads[0]!.url, "https://forum.example.com/a");
    // Direct filter helper should agree.
    const filtered = filterLowScoreLeads(
      [
        {
          url: "https://a.example",
          surface: "s",
          segment: "seg",
          whyMatch: "w",
          reachMethod: "public_form",
          score: 30,
        },
        {
          url: "https://b.example",
          surface: "s",
          segment: "seg",
          whyMatch: "w",
          reachMethod: "public_form",
          score: 70,
        },
      ],
      40,
    );
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]!.url, "https://b.example");
  } finally {
    stub.restore();
    if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
    else delete process.env.OPENAI_API_KEY;
  }
});

test("public-outreach rejects when LLM says the message is templated", async () => {
  const { draftOutreachMessage } = await import("@revenueos/core");
  const prev = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "sk-test-1234567890123456789012345";
  const stub = stubOpenAIFetch(() => ({
    subject: "Hello",
    message:
      "Hi there — we saw your site and thought you'd love our kit. Learn more today.",
    templated: true,
    refusalReason: "no personalization signal from surface",
  }));
  try {
    const res = await draftOutreachMessage({
      lead: {
        url: "https://forum.example.com/a",
        surface: "forum",
        segment: "s",
        whyMatch: "",
        reachMethod: "public_form",
        score: 55,
      },
      brand: {
        displayName: "RaiseReady",
        supportEmail: "hi@raiseready.example",
        productName: "Kit",
        productPriceUsd: 29,
      },
      appUrl: "https://raiseready.example",
    });
    assert.equal(res.ok, false);
    assert.equal(res.templated, true);
    assert.match(res.reason ?? "", /personalization|templated/i);
  } finally {
    stub.restore();
    if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
    else delete process.env.OPENAI_API_KEY;
  }
});

test("schema-enrichment produces valid JSON-LD with Product + Offer types", async () => {
  const { enrichPageSchema } = await import("@revenueos/core");
  const prev = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "sk-test-1234567890123456789012345";
  const stub = stubOpenAIFetch(() => ({
    metaTitle: "Best salary negotiation kit — RaiseReady",
    metaDescription: "Concrete scripts and templates to raise your salary.",
    faq: [
      { q: "Does this work remote?", a: "Yes, all templates work over email." },
      { q: "How long?", a: "Instant download after purchase." },
      { q: "Refund?", a: "Full refund within 14 days." },
    ],
    howto: {
      name: "Negotiate a raise in 3 steps",
      steps: [
        { name: "Prep", text: "Gather comp data" },
        { name: "Ask", text: "Send the email template" },
        { name: "Close", text: "Follow the response ladder" },
      ],
    },
  }));
  try {
    const res = await enrichPageSchema({
      brand: {
        siteId: "raiseready",
        displayName: "RaiseReady",
        domain: "raiseready.example",
        product: {
          name: "Salary Negotiation Kit",
          priceUsd: 29,
          description: "scripts + templates",
        },
      },
      slug: "how-to-negotiate-salary",
      door: {
        slug: "how-to-negotiate-salary",
        title: "How to negotiate a higher salary",
        intentQuery: "how to negotiate salary",
        body: "Long body...",
      },
      appUrl: "https://raiseready.example",
    });
    assert.equal(res.ok, true);
    // The output is a <script> tag wrapping a JSON array of schema.org nodes.
    const inner = res.jsonLd.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, "");
    const nodes = JSON.parse(inner) as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(nodes));
    const product = nodes.find((n) => n["@type"] === "Product");
    assert.ok(product, "must include a Product node");
    const offer = (product as any).offers;
    assert.equal(offer["@type"], "Offer");
    assert.equal(offer.priceCurrency, "USD");
    assert.equal(String(offer.price), "29.00");
    const faq = nodes.find((n) => n["@type"] === "FAQPage");
    assert.ok(faq, "must include a FAQPage node");
    assert.ok(res.meta.title.length > 0);
  } finally {
    stub.restore();
    if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
    else delete process.env.OPENAI_API_KEY;
  }
});

test("revenue-hunter returns a focus site given portfolio snapshots", async () => {
  const { huntPortfolioRevenue } = await import("@revenueos/core");
  const prev = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "sk-test-1234567890123456789012345";
  const stub = stubOpenAIFetch(() => ({
    focusSiteId: "raiseready",
    mechanismToScale: "direct_outreach",
    businessesToSuspendThisCycle: ["waitroom"],
    portfolioInsight:
      "RaiseReady has real intent signal; scale outreach to close the first sale.",
  }));
  try {
    const snapshots = [
      {
        siteId: "raiseready",
        displayName: "RaiseReady",
        sequenceIndex: 1,
        revenueUsd: 0,
        contributionProfitUsd: 0,
        purchases: 0,
        landingViews: 42,
        activePursuits: 3,
        waitingForEvidence: 1,
        claimableBacklog: 5,
        firstCustomerMode: true,
        profitPerVisitor: 0,
        marginalEvProxy: 12,
        learningValue: 10,
        suspended: false,
        bannedPatternCount: 0,
      },
      {
        siteId: "waitroom",
        displayName: "Waitroom",
        sequenceIndex: 2,
        revenueUsd: 0,
        contributionProfitUsd: 0,
        purchases: 0,
        landingViews: 0,
        activePursuits: 0,
        waitingForEvidence: 0,
        claimableBacklog: 0,
        firstCustomerMode: true,
        profitPerVisitor: 0,
        marginalEvProxy: 4,
        learningValue: 10,
        suspended: false,
        bannedPatternCount: 7,
      },
    ];
    const verdict = await huntPortfolioRevenue({ snapshots });
    assert.equal(verdict.focusSiteId, "raiseready");
    assert.equal(verdict.mechanismToScale, "direct_outreach");
    assert.deepEqual(verdict.businessesToSuspendThisCycle, ["waitroom"]);
    assert.match(verdict.portfolioInsight, /RaiseReady/);
    assert.ok(stub.calls >= 1);
  } finally {
    stub.restore();
    if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
    else delete process.env.OPENAI_API_KEY;
  }
});

test("revenue-hunter falls back deterministically without an OpenAI key", async () => {
  const { huntPortfolioRevenue } = await import("@revenueos/core");
  const prev = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const verdict = await huntPortfolioRevenue({
      snapshots: [
        {
          siteId: "shopbeacon",
          displayName: "ShopBeacon",
          sequenceIndex: 1,
          revenueUsd: 0,
          contributionProfitUsd: 0,
          purchases: 0,
          landingViews: 60,
          activePursuits: 2,
          waitingForEvidence: 0,
          claimableBacklog: 0,
          firstCustomerMode: true,
          profitPerVisitor: 0.05,
          marginalEvProxy: 10,
          learningValue: 10,
          suspended: false,
          bannedPatternCount: 0,
        },
        {
          siteId: "bidbinder",
          displayName: "BidBinder",
          sequenceIndex: 2,
          revenueUsd: 0,
          contributionProfitUsd: 0,
          purchases: 0,
          landingViews: 0,
          activePursuits: 0,
          waitingForEvidence: 0,
          claimableBacklog: 0,
          firstCustomerMode: true,
          profitPerVisitor: 0,
          marginalEvProxy: 2,
          learningValue: 10,
          suspended: false,
          bannedPatternCount: 0,
        },
      ],
    });
    assert.equal(verdict.focusSiteId, "shopbeacon");
    assert.match(verdict.reason ?? "", /OPENAI_API_KEY|fallback/);
  } finally {
    if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
  }
});

test("producthunt gate returns false when developer token is absent", async () => {
  const { hasProductHuntToken, executeProductHuntHelpfulReply } = await import(
    "@revenueos/core"
  );
  const prev = process.env.PRODUCTHUNT_DEVELOPER_TOKEN;
  delete process.env.PRODUCTHUNT_DEVELOPER_TOKEN;
  try {
    assert.equal(hasProductHuntToken(), false);
    // Executor must fail soft (not throw) when the token is missing.
    const res = await executeProductHuntHelpfulReply({
      rootDir: "/tmp/revenueos-ph-test-no-token",
      productName: "Test Product",
      productPriceUsd: 0,
      productUrl: "https://example.test",
      productKeywords: ["test"],
      brandVoice: "friendly",
    });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.match(res.detail, /PRODUCTHUNT_DEVELOPER_TOKEN|token missing/);
    }
  } finally {
    if (prev !== undefined) process.env.PRODUCTHUNT_DEVELOPER_TOKEN = prev;
  }
});

test("indiehackers product listing skipped when OPENAI_API_KEY missing", async () => {
  const { executeIndieHackersProductListing } = await import("@revenueos/core");
  const prev = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const dir = await mkdtemp(path.join(tmpdir(), "revenueos-ih-listing-"));
    const res = await executeIndieHackersProductListing({
      rootDir: dir,
      productName: "Test",
      productPriceUsd: 12,
      productUrl: "https://example.test",
      productDescription: "does a thing",
      audience: "builders",
      brandVoice: "friendly",
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.match(res.detail, /OPENAI_API_KEY|skipped/);
  } finally {
    if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
  }
});

test("indiehackers community post gate returns cleanly with no cookie + no openai key", async () => {
  const { executeIndieHackersCommunityPost, hasIndieHackersCookie } =
    await import("@revenueos/core");
  const prevKey = process.env.OPENAI_API_KEY;
  const prevCookie = process.env.INDIEHACKERS_SESSION_COOKIE;
  delete process.env.OPENAI_API_KEY;
  delete process.env.INDIEHACKERS_SESSION_COOKIE;
  try {
    assert.equal(hasIndieHackersCookie(), false);
    const dir = await mkdtemp(path.join(tmpdir(), "revenueos-ih-post-"));
    const res = await executeIndieHackersCommunityPost({
      rootDir: dir,
      productName: "Test",
      productPriceUsd: 12,
      productUrl: "https://example.test",
      productKeywords: ["test"],
      brandVoice: "friendly",
    });
    // Must not throw. May either fail to fetch firehose or short-circuit
    // on missing OpenAI key — both acceptable, neither should throw.
    assert.equal(typeof res.ok, "boolean");
  } finally {
    if (prevKey !== undefined) process.env.OPENAI_API_KEY = prevKey;
    if (prevCookie !== undefined)
      process.env.INDIEHACKERS_SESSION_COOKIE = prevCookie;
  }
});

test("hackernews show hn draft skipped when OPENAI_API_KEY missing", async () => {
  const { executeHackerNewsShowHnDraft, hasHackerNewsWriteCreds } =
    await import("@revenueos/core");
  const prev = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    assert.equal(hasHackerNewsWriteCreds(), false);
    const dir = await mkdtemp(path.join(tmpdir(), "revenueos-hn-show-"));
    const res = await executeHackerNewsShowHnDraft({
      rootDir: dir,
      productName: "Test",
      productUrl: "https://example.test",
      productDescription: "does a thing",
      audience: "builders",
      brandVoice: "friendly",
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.match(res.detail, /OPENAI_API_KEY|skipped/);
  } finally {
    if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
  }
});

test("hackernews intent discovery never throws even when firebase is unreachable", async () => {
  const { executeHackerNewsIntentDiscovery } = await import("@revenueos/core");
  const dir = await mkdtemp(path.join(tmpdir(), "revenueos-hn-intent-"));
  const res = await executeHackerNewsIntentDiscovery({
    rootDir: dir,
    productName: "Test",
    productDescription: "does a thing",
    productKeywords: ["revenueos-nonexistent-keyword-x9y8"],
    productUrl: "https://example.test",
  });
  // Whatever the outcome, the executor must not throw.
  assert.equal(typeof res.ok, "boolean");
});

test("gsc actions gate cleanly when GOOGLE_SERVICE_ACCOUNT_JSON is missing", async () => {
  const {
    hasGscCredentials,
    executeGscQueryImport,
    executeGscIndexationCheck,
  } = await import("@revenueos/core");
  const prev = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  try {
    assert.equal(hasGscCredentials(), false);
    const dir = await mkdtemp(path.join(tmpdir(), "revenueos-gsc-"));
    const q = await executeGscQueryImport({
      rootDir: dir,
      siteUrl: "sc-domain:example.test",
      productName: "Test",
      productDescription: "does a thing",
    });
    assert.equal(q.ok, false);
    if (!q.ok) assert.match(q.detail, /no_gsc_credentials|skipped/);
    const idx = await executeGscIndexationCheck({
      rootDir: dir,
      siteUrl: "sc-domain:example.test",
      urls: ["https://example.test/"],
    });
    assert.equal(idx.ok, false);
    if (!idx.ok) assert.match(idx.detail, /no_gsc_credentials|skipped/);
  } finally {
    if (prev !== undefined) process.env.GOOGLE_SERVICE_ACCOUNT_JSON = prev;
  }
});

test("youtube actions gate cleanly when YOUTUBE_API_KEY is missing", async () => {
  const {
    hasYouTubeApiKey,
    hasYouTubeOauthToken,
    executeYouTubeIntentDiscovery,
    executeYouTubeCommunityReplyDraft,
  } = await import("@revenueos/core");
  const prev = process.env.YOUTUBE_API_KEY;
  const prevOauth = process.env.YOUTUBE_OAUTH_TOKEN;
  delete process.env.YOUTUBE_API_KEY;
  delete process.env.YOUTUBE_OAUTH_TOKEN;
  try {
    assert.equal(hasYouTubeApiKey(), false);
    assert.equal(hasYouTubeOauthToken(), false);
    const dir = await mkdtemp(path.join(tmpdir(), "revenueos-yt-"));
    const dsc = await executeYouTubeIntentDiscovery({
      rootDir: dir,
      productName: "Test",
      productDescription: "does a thing",
      productKeywords: ["test"],
      productUrl: "https://example.test",
    });
    assert.equal(dsc.ok, false);
    if (!dsc.ok) assert.match(dsc.detail, /YOUTUBE_API_KEY|skipped/);
    const drf = await executeYouTubeCommunityReplyDraft({
      rootDir: dir,
      productName: "Test",
      productUrl: "https://example.test",
      brandVoice: "friendly",
    });
    assert.equal(drf.ok, false);
    if (!drf.ok) assert.match(drf.detail, /YOUTUBE_API_KEY|target comment|skipped/);
  } finally {
    if (prev !== undefined) process.env.YOUTUBE_API_KEY = prev;
    if (prevOauth !== undefined) process.env.YOUTUBE_OAUTH_TOKEN = prevOauth;
  }
});

test("exit-intent deploy is idempotent and returns a working snippet", async () => {
  const { executeExitIntentDeploy, buildExitIntentSnippet } = await import(
    "@revenueos/core"
  );
  const dir = await mkdtemp(path.join(tmpdir(), "revenueos-exit-"));
  const first = await executeExitIntentDeploy({
    rootDir: dir,
    siteId: "test-site",
    appUrl: "https://example.test",
  });
  assert.equal(first.ok, true);
  assert.match(first.snippet.scriptBody, /revos-exit-modal/);
  assert.match(first.snippet.beaconEndpoint, /api\/exit-intent-capture$/);
  // Idempotent: rerunning should not change the version.
  const second = await executeExitIntentDeploy({
    rootDir: dir,
    siteId: "test-site",
    appUrl: "https://example.test",
  });
  assert.equal(second.deployment.version, first.deployment.version);
  const raw = buildExitIntentSnippet({
    siteId: "x",
    appUrl: "https://example.test",
  });
  assert.match(raw.scriptTag, /<script/);
});

test("order-bump deploy writes idempotent config and augments line items", async () => {
  const {
    executeStripeOrderBumpDeploy,
    withStripeOrderBump,
    loadStripeOrderBumpConfig,
  } = await import("@revenueos/core");
  const dir = await mkdtemp(path.join(tmpdir(), "revenueos-bump-"));
  const first = await executeStripeOrderBumpDeploy({
    rootDir: dir,
    siteId: "test-bump-site",
    bumpPriceUsd: 9,
    bumpLabel: "Add coaching",
  });
  assert.equal(first.ok, true);
  if (first.ok) assert.equal(first.changed, true);
  const second = await executeStripeOrderBumpDeploy({
    rootDir: dir,
    siteId: "test-bump-site",
    bumpPriceUsd: 9,
    bumpLabel: "Add coaching",
  });
  if (second.ok) assert.equal(second.changed, false);
  const cfg = await loadStripeOrderBumpConfig({
    rootDir: dir,
    siteId: "test-bump-site",
  });
  assert.ok(cfg);
  const items = withStripeOrderBump({
    lineItems: [{ price: "price_primary", quantity: 1 }],
    config: cfg,
  });
  assert.equal(items.length, 2);
});

test("signed UTM: sign then verify round-trips, mismatched sig rejected", async () => {
  const { signUtm, verifyUtm, attachSignedUtm, classifyIncomingAttribution } =
    await import("@revenueos/core");
  const prev = process.env.REVENUEOS_ATTRIBUTION_SECRET;
  process.env.REVENUEOS_ATTRIBUTION_SECRET = "test-attrib-secret-01234567890abcdef";
  try {
    const ts = Date.now();
    const sig = await signUtm({
      business_id: "biz-x",
      ts,
      utm_source: "reddit",
      utm_medium: "revenueos",
      utm_campaign: "autonomous",
    });
    assert.ok(sig, "signUtm should produce a signature when secret set");
    const v = await verifyUtm({
      sig: sig!,
      businessId: "biz-x",
      utm: {
        utm_source: "reddit",
        utm_medium: "revenueos",
        utm_campaign: "autonomous",
      },
    });
    assert.equal(v.valid, true);
    // Tampered sig
    const bad = await verifyUtm({
      sig: sig! + "AA",
      businessId: "biz-x",
      utm: {
        utm_source: "reddit",
        utm_medium: "revenueos",
        utm_campaign: "autonomous",
      },
    });
    assert.equal(bad.valid, false);
    // attachSignedUtm + classifyIncomingAttribution
    const url = await attachSignedUtm({
      url: "https://example.test/",
      businessId: "biz-x",
      source: "reddit",
    });
    const decoded = new URL(url);
    assert.equal(decoded.searchParams.get("utm_source"), "reddit");
    assert.ok(decoded.searchParams.get("utm_sig"), "signed sig should be attached");
    const cls = await classifyIncomingAttribution({
      requestUrl: url,
      businessId: "biz-x",
    });
    assert.equal(cls.source, "signed");
  } finally {
    if (prev !== undefined)
      process.env.REVENUEOS_ATTRIBUTION_SECRET = prev;
    else delete process.env.REVENUEOS_ATTRIBUTION_SECRET;
  }
});

test("signed UTM without secret: signUtm returns null, classifier says self-reported", async () => {
  const { signUtm, classifyIncomingAttribution } = await import(
    "@revenueos/core"
  );
  const prev = process.env.REVENUEOS_ATTRIBUTION_SECRET;
  delete process.env.REVENUEOS_ATTRIBUTION_SECRET;
  try {
    const s = await signUtm({
      business_id: "b",
      ts: Date.now(),
      utm_source: "x",
    });
    assert.equal(s, null);
    const cls = await classifyIncomingAttribution({
      requestUrl: "https://example.test/?utm_source=reddit",
      businessId: "b",
    });
    assert.equal(cls.source, "self_reported");
  } finally {
    if (prev !== undefined) process.env.REVENUEOS_ATTRIBUTION_SECRET = prev;
  }
});

test("action-class: new actions get correct class + mechanism", async () => {
  const { classifyExecutionActionClass, classifyMechanism } = await import(
    "@revenueos/core"
  );
  assert.equal(
    classifyExecutionActionClass("hackernews_intent_discovery"),
    "intent",
  );
  assert.equal(
    classifyExecutionActionClass("youtube_intent_discovery"),
    "intent",
  );
  assert.equal(
    classifyExecutionActionClass("gsc_query_import"),
    "intent",
  );
  assert.equal(
    classifyExecutionActionClass("gsc_indexation_check"),
    "distribution",
  );
  assert.equal(
    classifyExecutionActionClass("indiehackers_product_listing_draft"),
    "production",
  );
  assert.equal(
    classifyExecutionActionClass("hackernews_show_hn_draft"),
    "production",
  );
  assert.equal(
    classifyMechanism({ actionType: "hackernews_show_hn_draft" }),
    "external_placement",
  );
  assert.equal(
    classifyMechanism({ actionType: "indiehackers_community_post_draft" }),
    "community_participation",
  );
  assert.equal(
    classifyMechanism({ actionType: "youtube_community_reply_draft" }),
    "community_participation",
  );
  assert.equal(
    classifyMechanism({ actionType: "gsc_query_import" }),
    "owned_content",
  );
  assert.equal(
    classifyMechanism({ actionType: "exit_intent_deploy" }),
    "conversion_optimization",
  );
  assert.equal(
    classifyMechanism({ actionType: "order_bump_deploy" }),
    "conversion_optimization",
  );
});

test("action registry: new actions registered with proper cooldowns", async () => {
  const { ACTION_REGISTRY } = await import("@revenueos/core");
  const required = {
    indiehackers_product_listing_draft: 43_200,
    indiehackers_community_post_draft: 240,
    hackernews_show_hn_draft: 43_200,
    hackernews_intent_discovery: 60,
    gsc_query_import: 360,
    gsc_indexation_check: 720,
    youtube_intent_discovery: 90,
    youtube_community_reply_draft: 180,
    exit_intent_deploy: 43_200,
    order_bump_deploy: 10_080,
    gumroad_product_sync: 10_080,
    gumroad_sales_import: 360,
  };
  for (const [t, cd] of Object.entries(required)) {
    const entry = ACTION_REGISTRY[t];
    assert.ok(entry, `expected registry entry for ${t}`);
    assert.equal(entry.cooldownMinutes, cd, `cooldown mismatch for ${t}`);
  }
});

test("llm-strategist: new actions in LLM_PROPOSABLE_ACTIONS enum", async () => {
  const { LLM_PROPOSABLE_ACTIONS } = await import("@revenueos/core");
  const list = LLM_PROPOSABLE_ACTIONS as readonly string[];
  for (const t of [
    "indiehackers_product_listing_draft",
    "indiehackers_community_post_draft",
    "hackernews_show_hn_draft",
    "hackernews_intent_discovery",
    "gsc_query_import",
    "gsc_indexation_check",
    "youtube_intent_discovery",
    "youtube_community_reply_draft",
    "exit_intent_deploy",
    "order_bump_deploy",
    "gumroad_product_sync",
    "gumroad_sales_import",
  ]) {
    assert.ok(list.includes(t), `LLM_PROPOSABLE_ACTIONS missing ${t}`);
  }
});

test("gumroad actions gate cleanly when GUMROAD_ACCESS_TOKEN is missing", async () => {
  const {
    hasGumroadCreds,
    executeGumroadProductSync,
    executeGumroadSalesImport,
  } = await import("@revenueos/core");
  const prev = process.env.GUMROAD_ACCESS_TOKEN;
  delete process.env.GUMROAD_ACCESS_TOKEN;
  try {
    assert.equal(hasGumroadCreds(), false);
    const dir = await mkdtemp(path.join(tmpdir(), "revenueos-gumroad-"));
    const sync = await executeGumroadProductSync({
      rootDir: dir,
      siteId: "test",
      productName: "Test Kit",
      productDescription: "A test product",
      productUrl: "https://example.test",
      priceUsd: 19,
    });
    assert.equal(sync.ok, false);
    assert.match(sync.detail, /skipped|GUMROAD_ACCESS_TOKEN/);
    const sales = await executeGumroadSalesImport({
      rootDir: dir,
      siteId: "test",
    });
    assert.equal(sales.ok, false);
    assert.match(sales.detail, /skipped|GUMROAD_ACCESS_TOKEN/);
  } finally {
    if (prev !== undefined) process.env.GUMROAD_ACCESS_TOKEN = prev;
  }
});

test("channel discovery produces business-specific candidates (mock LLM)", async () => {
  const { discoverChannels } = await import("@revenueos/core");
  const resume = await discoverChannels({
    context: {
      siteId: "resumeforge",
      displayName: "ResumeForge",
      industry: "career_tools",
      products: [{ name: "ResumeForge Kit", priceUsd: 29, marginEstimate: 0.9 }],
      funnelSteps: ["landing", "checkout", "purchase"],
      brandVoice: "direct",
      allowedChannels: ["organic"],
      autonomousDailyCapUsd: 0,
      timezone: "UTC",
      constraints: ["zero_ad_spend"],
      audienceSegments: [{ label: "job seekers" }],
    },
    maxCandidates: 6,
    llmOverride: async ({ productName }) => [
      {
        platform: "reddit",
        capabilityId: "reddit",
        audience: "job seekers rewriting resumes",
        buyerIntent: "high",
        intentScore: 88,
        allowedActionGuess: "helpful_reply",
        suggestedAction: "reddit_helpful_reply",
        effortEstimate: 2,
        evidenceUrls: ["https://reddit.com/r/resumes/example"],
        angle: "critique-for-ATS",
        businessSpecificReason: `${productName} helps job seekers on r/resumes with ATS-ready rewrites`,
        ownedAssetIdea: {
          kind: "calculator",
          title: "ATS score calculator",
          intentQuery: "ats resume score calculator",
        },
      },
    ],
  });
  const turnover = await discoverChannels({
    context: {
      siteId: "turnoverkit",
      displayName: "TurnoverKit",
      industry: "property_management",
      products: [{ name: "TurnoverKit", priceUsd: 49, marginEstimate: 0.85 }],
      funnelSteps: ["landing", "checkout", "purchase"],
      brandVoice: "ops",
      allowedChannels: ["organic"],
      autonomousDailyCapUsd: 0,
      timezone: "UTC",
      constraints: ["zero_ad_spend"],
      audienceSegments: [{ label: "Airbnb hosts" }],
    },
    maxCandidates: 6,
    llmOverride: async ({ productName }) => [
      {
        platform: "facebook",
        capabilityId: "major_social_organic",
        audience: "short-term rental hosts",
        buyerIntent: "high",
        intentScore: 80,
        allowedActionGuess: "draft_post",
        effortEstimate: 3,
        evidenceUrls: ["https://example.com/str-host-group"],
        angle: "turnover checklist",
        businessSpecificReason: `${productName} is for Airbnb hosts running cleaner turnovers`,
      },
    ],
  });
  assert.equal(resume.ok, true);
  assert.equal(turnover.ok, true);
  const resumeBlob = resume.candidates
    .map((c) => `${c.businessSpecificReason} ${c.audience} ${c.angle}`)
    .join(" ")
    .toLowerCase();
  const turnoverBlob = turnover.candidates
    .map((c) => `${c.businessSpecificReason} ${c.audience} ${c.angle}`)
    .join(" ")
    .toLowerCase();
  assert.ok(resumeBlob.includes("resumeforge") || resumeBlob.includes("job seeker"));
  assert.ok(turnoverBlob.includes("turnoverkit") || turnoverBlob.includes("airbnb"));
  assert.notEqual(
    resume.candidates[0]?.platform,
    turnover.candidates[0]?.platform,
    "different businesses should surface different top platforms from mocked discovery",
  );
  assert.ok(
    resume.candidates.some((c) => c.capabilityId === "owned_intent_tools" || c.ownedAssetIdea),
    "owned asset path should appear for ResumeForge calculator idea",
  );
});

test("channel registry updates posteriors from commercial signal", async () => {
  const {
    channelFromCapability,
    capabilityById,
    updateChannelPosterior,
    computeRevenuePerAction,
  } = await import("@revenueos/core");
  const cap = capabilityById("reddit");
  assert.ok(cap);
  let ch = channelFromCapability({
    siteId: "resumeforge",
    business: "ResumeForge",
    audience: "job seekers",
    capability: cap!,
  });
  assert.equal(ch.untested, true);
  assert.equal(ch.experimentsRun, 0);
  ch = updateChannelPosterior(ch, {
    actionType: "reddit_helpful_reply",
    purchases: 1,
    revenueUsd: 29,
    qualifiedVisitors: 4,
    traffic: 12,
    angle: "ats-critique",
  });
  assert.equal(ch.untested, false);
  assert.equal(ch.purchases, 1);
  assert.equal(ch.revenue, 29);
  assert.ok(ch.alpha > 1);
  assert.ok(ch.revenuePerAction > 0);
  assert.equal(ch.revenuePerAction, computeRevenuePerAction(ch));
  assert.ok(ch.winningAngles.includes("ats-critique"));
});

test("channel allocation prefers high revenue_per_action", async () => {
  const {
    channelFromCapability,
    capabilityById,
    updateChannelPosterior,
    allocateChannelEffort,
  } = await import("@revenueos/core");
  const reddit = capabilityById("reddit")!;
  const social = capabilityById("major_social_organic")!;
  let winner = channelFromCapability({
    siteId: "site-a",
    business: "A",
    capability: reddit,
  });
  let loser = channelFromCapability({
    siteId: "site-a",
    business: "A",
    capability: social,
  });
  for (let i = 0; i < 6; i++) {
    winner = updateChannelPosterior(winner, {
      purchases: 1,
      revenueUsd: 40,
      qualifiedVisitors: 3,
      actionType: "reddit_helpful_reply",
    });
  }
  for (let i = 0; i < 6; i++) {
    loser = updateChannelPosterior(loser, {
      purchases: 0,
      revenueUsd: 0,
      traffic: 0,
      actionType: "buyer_discovery",
      success: false,
    });
  }
  // Deterministic RNG biased high then low — still should rank winner first
  // across many samples because posterior mass dominates.
  let winnerFirst = 0;
  for (let seed = 0; seed < 40; seed++) {
    let s = seed + 1;
    const rand = () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
    const arms = allocateChannelEffort({
      channels: [loser, winner],
      rand,
      limit: 2,
    });
    if (arms[0]?.channel.id === winner.id) winnerFirst += 1;
  }
  assert.ok(
    winnerFirst >= 28,
    `expected high-RPA channel to win most allocations, got ${winnerFirst}/40`,
  );
});

test("channel registry persists via file store and transfers portfolio winners", async () => {
  const {
    createFileExperimentStore,
    runChannelRegistryTick,
    channelFromCapability,
    capabilityById,
    updateChannelPosterior,
    transferChannelHypotheses,
  } = await import("@revenueos/core");
  const dir = await mkdtemp(path.join(tmpdir(), "revenueos-channels-"));
  const store = createFileExperimentStore(dir);
  const context = {
    siteId: "resumeforge",
    displayName: "ResumeForge",
    industry: "career_tools",
    products: [{ name: "ResumeForge Kit", priceUsd: 29, marginEstimate: 0.9 }],
    funnelSteps: ["landing", "checkout", "purchase"],
    brandVoice: "direct",
    allowedChannels: ["organic"],
    autonomousDailyCapUsd: 0,
    timezone: "UTC",
    constraints: ["zero_ad_spend"],
    audienceSegments: [{ label: "job seekers" }],
  };
  const tick = await runChannelRegistryTick({
    store,
    context,
    candidates: [
      {
        platform: "reddit",
        capabilityId: "reddit",
        category: "communities",
        audience: "job seekers",
        buyerIntent: "high",
        intentScore: 90,
        allowedActionGuess: "helpful_reply",
        suggestedAction: "reddit_helpful_reply",
        actionTypes: ["reddit_helpful_reply", "reddit_discover_intent"],
        mechanism: "community_participation",
        effortEstimate: 2,
        evidenceUrls: ["https://reddit.com/r/resumes"],
        angle: "ats",
        postingRules: [],
        contentFormats: ["helpful_reply"],
        businessSpecificReason: "ResumeForge buyers ask ATS questions on Reddit",
      },
    ],
    rand: () => 0.5,
  });
  assert.ok(tick.channels.length >= 1);
  assert.ok(tick.opportunities.some((o) => o.safeActionType));
  const reloaded = await store.listChannels!("resumeforge");
  assert.ok(reloaded.length >= 1);

  let peer = channelFromCapability({
    siteId: "raiseready",
    business: "RaiseReady",
    capability: capabilityById("reddit")!,
  });
  peer = updateChannelPosterior(peer, {
    purchases: 2,
    revenueUsd: 78,
    angle: "salary-thread",
  });
  const transferred = transferChannelHypotheses({
    local: tick.channels,
    peerChannels: [peer],
    context,
  });
  const redditLocal = transferred.find((c) => c.capabilityId === "reddit");
  assert.ok(redditLocal);
  assert.ok(
    (redditLocal!.winningAngles ?? []).some((a) => a.includes("transfer:")),
    "winning peer angle should transfer as hypothesis",
  );
});

test("channel actions registered with cooldowns and mechanisms", async () => {
  const {
    ACTION_REGISTRY,
    LLM_PROPOSABLE_ACTIONS,
    classifyMechanism,
    PERMISSIONLESS_ORGANIC_TYPES,
  } = await import("@revenueos/core");
  for (const t of ["publish_intent_tool", "publish_calculator", "channel_discover"]) {
    assert.ok(ACTION_REGISTRY[t], `missing ACTION_REGISTRY ${t}`);
    assert.ok(
      (LLM_PROPOSABLE_ACTIONS as readonly string[]).includes(t),
      `missing LLM proposable ${t}`,
    );
    assert.ok(PERMISSIONLESS_ORGANIC_TYPES.has(t), `missing permissionless ${t}`);
  }
  assert.equal(
    classifyMechanism({ actionType: "publish_calculator" }),
    "owned_content",
  );
  assert.equal(
    classifyMechanism({ actionType: "channel_discover" }),
    "owned_distribution",
  );
});
