import { requireOwner } from "@/lib/auth";
import { fetchDrafts, type DraftItem } from "@/lib/data";
import { supabaseConfigured } from "@/lib/supabase";
import { approveDraft, rejectDraft } from "./actions";

export const dynamic = "force-dynamic";

function excerpt(payload: Record<string, unknown>): string {
  const body =
    (payload.body as string | undefined) ??
    (payload.title as string | undefined) ??
    (payload.subject as string | undefined) ??
    "";
  return body.slice(0, 220);
}

export default async function QueuePage() {
  await requireOwner();
  const drafts = await fetchDrafts();
  const pending = drafts.filter((d) => d.status === "pending");
  const recent = drafts.filter((d) => d.status !== "pending").slice(0, 10);

  return (
    <div>
      <h1 className="text-lg font-semibold mb-4">Queue</h1>
      {!supabaseConfigured() ? (
        <p className="text-sm text-[--color-warn] mb-4">
          Supabase not configured — no drafts to show.
        </p>
      ) : null}
      <h2 className="text-sm font-medium mb-2 text-[--color-muted]">
        Pending ({pending.length})
      </h2>
      <div className="grid gap-3 mb-8">
        {pending.length === 0 ? (
          <p className="text-sm text-[--color-muted]">
            No pending drafts — the operator publishes automatically when a
            draft passes the safety gates. Owner-review items land here.
          </p>
        ) : null}
        {pending.map((draft) => (
          <DraftCard key={draft.id} draft={draft} />
        ))}
      </div>
      <h2 className="text-sm font-medium mb-2 text-[--color-muted]">
        Recent decisions
      </h2>
      <div className="grid gap-2">
        {recent.map((d) => (
          <div
            key={d.id}
            className="text-xs p-3 rounded border border-[--color-panel-border] bg-[--color-panel]/60"
          >
            <span className="text-[--color-muted]">{d.createdAt}</span>{" "}
            <span
              className={
                d.status === "approved"
                  ? "text-[--color-success]"
                  : "text-[--color-danger]"
              }
            >
              {d.status}
            </span>{" "}
            — {d.siteId} · {d.platform} · {d.kind}
          </div>
        ))}
      </div>
    </div>
  );
}

function DraftCard({ draft }: { draft: DraftItem }) {
  return (
    <div className="rounded-lg border border-[--color-panel-border] bg-[--color-panel] p-4">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-sm font-semibold">
            {draft.siteId} · {draft.platform} · {draft.kind}
          </div>
          <div className="text-xs text-[--color-muted]">{draft.createdAt}</div>
        </div>
      </div>
      <pre className="mt-3 whitespace-pre-wrap text-xs text-[--color-text] bg-[--color-bg] rounded p-3 border border-[--color-panel-border]">
        {excerpt(draft.payload) || JSON.stringify(draft.payload, null, 2)}
      </pre>
      <div className="mt-3 flex gap-2 flex-wrap">
        <form action={approveDraft}>
          <input type="hidden" name="id" value={draft.id} />
          <button
            className="px-3 py-1.5 text-xs rounded bg-[--color-success] text-black"
            type="submit"
          >
            Approve → publish
          </button>
        </form>
        <form action={rejectDraft} className="flex gap-2 items-center">
          <input type="hidden" name="id" value={draft.id} />
          <input
            name="note"
            placeholder="reason (optional)"
            className="text-xs bg-[--color-bg] border border-[--color-panel-border] rounded px-2 py-1.5 w-64"
          />
          <button
            className="px-3 py-1.5 text-xs rounded bg-[--color-danger] text-white"
            type="submit"
          >
            Reject → draft
          </button>
        </form>
      </div>
    </div>
  );
}
