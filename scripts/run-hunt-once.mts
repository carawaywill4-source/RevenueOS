import { runTributeReadyRevenueCycle } from "../src/lib/growthos";

async function main() {
  const r = await runTributeReadyRevenueCycle();
  console.log(
    JSON.stringify(
      {
        ok: true,
        customer: "tributeready",
        day: r.shortfall.dayVerdict,
        shortfallUsd: r.shortfall.shortfallUsd,
        next: r.scorecard.nextAction,
        executed: r.executed.map((e) => ({
          type: e.action.type,
          ok: e.result.ok,
          detail: e.result.detail,
        })),
        bets: r.experimentsTouched.slice(0, 6).map((e) => ({
          title: e.hypothesis.title,
          status: e.status,
          executable: Boolean(e.hypothesis.safeActionType),
        })),
        moneyPlan: r.moneyPlan.note,
        curriculum: r.curriculum.priority,
        top: r.opportunities.slice(0, 5).map((o) => o.title),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
