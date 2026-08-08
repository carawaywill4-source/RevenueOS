import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (
    !secret ||
    request.headers.get("authorization") !== `Bearer ${secret}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const sourceCutoff = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { data: expiredSources, error } = await supabase
      .from("orders")
      .select("id, pdf_path")
      .eq("status", "fulfilled")
      .is("source_deleted_at", null)
      .lt("created_at", sourceCutoff)
      .limit(500);
    if (error) throw new Error(error.message);

    const paths = (expiredSources || [])
      .map((order) => order.pdf_path)
      .filter((path): path is string => Boolean(path));
    if (paths.length) {
      const { error: storageError } = await supabase.storage
        .from("memorial-files")
        .remove(paths);
      if (storageError) throw new Error(storageError.message);
    }

    const sourceIds = (expiredSources || []).map((order) => order.id);
    if (sourceIds.length) {
      const { error: updateError } = await supabase
        .from("orders")
        .update({
          pdf_path: null,
          source_deleted_at: new Date().toISOString(),
        })
        .in("id", sourceIds);
      if (updateError) throw new Error(updateError.message);
    }

    const abandonedCutoff = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { error: abandonedDeleteError } = await supabase
      .from("orders")
      .delete()
      .eq("status", "abandoned")
      .lt("created_at", abandonedCutoff);
    if (abandonedDeleteError) throw new Error(abandonedDeleteError.message);

    const awaitingCutoff = new Date(
      Date.now() - 24 * 60 * 60 * 1000,
    ).toISOString();
    const { data: staleAwaiting } = await supabase
      .from("orders")
      .select("id, photo_path")
      .eq("status", "awaiting_payment")
      .lt("created_at", awaitingCutoff)
      .limit(500);
    const stalePhotoPaths = (staleAwaiting || [])
      .map((order) => order.photo_path)
      .filter((path): path is string => Boolean(path));
    if (stalePhotoPaths.length) {
      await supabase.storage.from("memorial-photos").remove(stalePhotoPaths);
    }
    const staleIds = (staleAwaiting || []).map((order) => order.id);
    if (staleIds.length) {
      await supabase.from("orders").delete().in("id", staleIds);
    }

    await supabase
      .from("generation_limits")
      .delete()
      .lt(
        "window_started_at",
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      );
    await supabase.rpc("purge_expired_growth_events");

    return NextResponse.json({
      sourceFilesDeleted: sourceIds.length,
      staleOrdersDeleted: staleIds.length,
    });
  } catch (error) {
    console.error("Scheduled cleanup failed", error);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
