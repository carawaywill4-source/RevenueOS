/**
 * Supabase adapter still implements RevenueOS.Data (health + claims read).
 * Uses env credentials; does NOT write production-critical rows.
 * Skips if credentials missing.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createSupabaseData } from "@revenueos/data";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && key);

describe("stage1 supabase adapter", { skip: !canRun }, () => {
  it("reports health without crashing Core semantics", async () => {
    const data = createSupabaseData({ url: url!, serviceRoleKey: key! });
    const h = await data.health();
    assert.equal(h.provider, "supabase");
    assert.ok(
      ["DB_HEALTHY", "DB_DEGRADED", "DB_UNAVAILABLE", "DB_RECOVERING"].includes(
        h.state,
      ),
    );
    await data.close();
  });

  it("implements RevenueOS.Data provider surface (read-safe)", async () => {
    const data = createSupabaseData({ url: url!, serviceRoleKey: key! });
    assert.equal(data.provider, "supabase");
    // Native claims table may be absent; adapter must not throw on 404.
    const claim = await data.claims.get("__revenueos_stage1_nonexistent__");
    assert.equal(claim, null);
    await data.close();
  });
});
