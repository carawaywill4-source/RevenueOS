import { growthStorageIsConfigured } from "@/lib/growth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * Exactly one owner digest per UTC hour per site.
 * Lock rows are filtered out of experiment lists by id prefix.
 */
export async function claimHourlyEmailSlot(siteId: string): Promise<boolean> {
  if (!growthStorageIsConfigured()) return false;
  const hourKey = new Date().toISOString().slice(0, 13);
  const id = `hourly-email:${siteId}:${hourKey}`;

  const existing = await getSupabaseAdmin()
    .from("revenueos_experiments")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (existing.data?.id) return false;

  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin().from("revenueos_experiments").insert({
    id,
    site_id: siteId,
    status: "completed",
    pattern_key: "hourly_email_lock",
    category: "operations",
    document: {
      id,
      siteId,
      status: "completed",
      category: "operations",
      hypothesis: {
        title: "Hourly owner email lock",
        patternKey: "hourly_email_lock",
      },
      hourKey,
      createdAt: now,
      updatedAt: now,
    },
    updated_at: now,
  });
  if (!error) return true;
  if (
    error.code === "23505" ||
    /duplicate|unique|already exists/i.test(error.message ?? "")
  ) {
    return false;
  }
  console.warn("hourly email claim skipped", error.code, error.message);
  return false;
}
