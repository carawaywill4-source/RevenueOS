import { NextResponse } from "next/server";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";

/**
 * SSE endpoint that tails the operator's most recent pursuit_events
 * across the entire portfolio. Not a real Fly log tail — proxying
 * fly logs through Supabase is easier than authenticating an
 * outbound Fly logs socket, and pursuit_events are the actual
 * business-level signal the owner cares about.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  if (!supabaseConfigured()) {
    return NextResponse.json(
      { error: "supabase_not_configured" },
      { status: 400 },
    );
  }
  const sb = getSupabase();
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      emit({ hello: "operator log stream", at: new Date().toISOString() });
      let last = new Date(Date.now() - 60_000).toISOString();
      let alive = true;

      const tick = async () => {
        if (!alive) return;
        try {
          const { data } = await sb
            .from("revenueos_pursuit_events")
            .select("id,site_id,event_type,detail,created_at")
            .gt("created_at", last)
            .order("created_at", { ascending: true })
            .limit(80);
          for (const row of data ?? []) {
            emit({
              at: row.created_at,
              siteId: row.site_id,
              eventType: row.event_type,
              detail: row.detail,
            });
            last = row.created_at;
          }
        } catch (error) {
          emit({
            error: error instanceof Error ? error.message : String(error),
          });
        }
        if (alive) setTimeout(tick, 4_000);
      };
      tick();

      controller.enqueue(encoder.encode(": keep-alive\n\n"));
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keep-alive\n\n"));
        } catch {
          alive = false;
          clearInterval(keepAlive);
        }
      }, 15_000);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
