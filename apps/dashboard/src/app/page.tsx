import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { fetchBusinessOverviews } from "@/lib/data";
import { PORTFOLIO } from "@/lib/portfolio";
import { supabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function fmtUsd(n: number): string {
  return `$${n.toFixed(0)}`;
}

export default async function Overview() {
  await requireOwner();
  const configured = supabaseConfigured();
  const rows = await fetchBusinessOverviews(PORTFOLIO);

  return (
    <div>
      <h1 className="text-lg font-semibold mb-4">Portfolio</h1>
      {!configured ? (
        <p className="mb-4 text-sm text-[--color-warn]">
          Supabase not configured — dashboard is running in preview mode with
          empty data.
        </p>
      ) : null}
      <div className="grid gap-3">
        {rows.map((row) => (
          <div
            key={row.siteId}
            className="rounded-lg border border-[--color-panel-border] bg-[--color-panel] p-4"
          >
            <div className="flex items-baseline justify-between">
              <div>
                <div className="font-semibold">{row.displayName}</div>
                <div className="text-xs text-[--color-muted]">{row.appUrl}</div>
              </div>
              <div className="text-right">
                <div className="text-sm">
                  <span className="text-[--color-muted] mr-1">revenue</span>
                  <span className="font-semibold">
                    {fmtUsd(row.revenueUsd)}
                  </span>
                </div>
                <div className="text-xs text-[--color-muted]">
                  {row.purchases} purchases • {row.landingViews} views/hr
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-[--color-muted]">
              <span>
                <span className="text-[--color-text] font-medium">
                  {row.actionsPastHour}
                </span>{" "}
                actions/hr
              </span>
              <span>
                claim:{" "}
                {row.claim
                  ? row.claim.active
                    ? `operator ${row.claim.owner ?? ""}`
                    : "stale (cron)"
                  : "cron"}
              </span>
              {row.alerts.map((a) => (
                <span
                  key={a}
                  className="px-1.5 py-0.5 rounded bg-[--color-warn]/20 text-[--color-warn]"
                >
                  {a}
                </span>
              ))}
            </div>
            {row.topChannels.length ? (
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {row.topChannels.map((c) => (
                  <span
                    key={`${row.siteId}-${c.platform}`}
                    className="px-2 py-1 rounded bg-[--color-bg] border border-[--color-panel-border]"
                  >
                    {c.platform}: {fmtUsd(c.revenuePerAction)}/action ·{" "}
                    {c.status}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="mt-3 flex gap-3 text-xs">
              <Link className="underline" href={`/channels/${row.siteId}`}>
                channels
              </Link>
              <Link className="underline" href={`/leads/${row.siteId}`}>
                leads
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
