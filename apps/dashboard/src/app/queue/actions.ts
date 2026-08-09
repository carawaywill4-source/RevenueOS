"use server";
import { revalidatePath } from "next/cache";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";

async function updateStatus(
  id: string,
  status: "approved" | "rejected",
  ownerNote: string | null,
) {
  if (!supabaseConfigured()) return;
  const sb = getSupabase();
  await sb
    .from("revenueos_owner_drafts")
    .update({ status, owner_note: ownerNote, decided_at: new Date().toISOString() })
    .eq("id", id);
}

export async function approveDraft(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await updateStatus(id, "approved", null);
  await triggerSidecarIfConfigured(id).catch(() => {});
  revalidatePath("/queue");
}

export async function rejectDraft(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("note") ?? "");
  await updateStatus(id, "rejected", note.slice(0, 500) || null);
  revalidatePath("/queue");
}

/**
 * After an approve, poke the operator so it re-dispatches the draft on
 * its next tick. We use the operator's status endpoint as a signal
 * that it's alive — no direct pipe. This keeps the dashboard loosely
 * coupled and avoids a bespoke webhook.
 */
async function triggerSidecarIfConfigured(_draftId: string) {
  const url = process.env.OPERATOR_URL;
  if (!url) return;
  try {
    await fetch(`${url}/status`, {
      method: "GET",
      signal: AbortSignal.timeout(3_000),
    });
  } catch {
    // best-effort
  }
}
