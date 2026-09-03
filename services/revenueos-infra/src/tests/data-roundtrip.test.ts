/**
 * Stage 1 proof: native Postgres adapter R/W + reconnect after restart.
 * Skips cleanly if PostgreSQL is not prepared/running.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createPostgresData } from "@revenueos/data";
import { dbHealth, dbRestart, dbStart } from "../lifecycle.js";
import { dbMigrate } from "../migrate.js";
import { resolvePaths } from "../paths.js";
import { resolvePgBinaries } from "../pg-binaries.js";
import { existsSync } from "node:fs";

const paths = resolvePaths();
const bins = resolvePgBinaries(paths);
const canRun = existsSync(bins.pgCtl);

describe("stage1 native postgres data", { skip: !canRun }, () => {
  before(async () => {
    await dbStart();
    await dbMigrate();
  });

  after(async () => {
    // leave cluster running for subsequent CLI proofs
  });

  it("health accepts connections", async () => {
    const h = await dbHealth();
    assert.equal(h.running, true);
    assert.equal(h.acceptingConnections, true);
  });

  it("writes and reads inside a transaction", async () => {
    const data = createPostgresData(paths.connectionUrl);
    const siteId = `stage1-proof-${Date.now()}`;
    try {
      await data.withTransaction(async (tx) => {
        await tx.businesses.upsert({
          siteId,
          displayName: "Stage1 Proof",
          status: "active",
          appUrl: null,
          metadata: { proof: true },
          updatedAt: new Date().toISOString(),
        });
        await tx.events.append({
          id: `${siteId}-evt`,
          siteId,
          eventType: "stage1.proof",
          detail: { ok: true },
          createdAt: new Date().toISOString(),
        });
      });
      const biz = await data.businesses.get(siteId);
      assert.ok(biz);
      assert.equal(biz.displayName, "Stage1 Proof");
      const events = await data.events.listBySite(siteId);
      assert.equal(events.length, 1);

      // restart postgres — adapter must reconnect; state must remain
      await dbRestart();
      const h = await data.health();
      assert.ok(
        h.state === "DB_HEALTHY" || h.state === "DB_DEGRADED" || h.state === "DB_RECOVERING",
      );
      // force a reconnect path
      let recovered = false;
      for (let i = 0; i < 10; i++) {
        const report = await data.health();
        if (report.state === "DB_HEALTHY" || report.state === "DB_DEGRADED") {
          recovered = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      assert.equal(recovered, true);
      const biz2 = await data.businesses.get(siteId);
      assert.ok(biz2);
      assert.equal(biz2.siteId, siteId);
    } finally {
      await data.close();
    }
  });
});
