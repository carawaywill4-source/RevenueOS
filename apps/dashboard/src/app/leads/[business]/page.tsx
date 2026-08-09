import { requireOwner } from "@/lib/auth";
import { fetchLeads } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  params,
}: {
  params: Promise<{ business: string }>;
}) {
  await requireOwner();
  const { business } = await params;
  const leads = await fetchLeads(business);

  return (
    <div>
      <h1 className="text-lg font-semibold mb-1">Leads · {business}</h1>
      <p className="text-sm text-[--color-muted] mb-4">
        Buyer signals surfaced by the operator. `reach` describes how to make
        contact — public form, cold email, subreddit reply, etc.
      </p>
      <div className="grid gap-3">
        {leads.length === 0 ? (
          <p className="text-sm text-[--color-muted]">
            No leads yet for this business.
          </p>
        ) : null}
        {leads.map((lead) => (
          <div
            key={`${lead.createdAt}-${lead.eventType}`}
            className="rounded border border-[--color-panel-border] bg-[--color-panel] p-3"
          >
            <div className="text-xs text-[--color-muted]">
              {lead.createdAt} · {lead.eventType} · reach={lead.reach}
            </div>
            <pre className="whitespace-pre-wrap text-xs mt-1">
              {JSON.stringify(lead.detail, null, 2).slice(0, 900)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
