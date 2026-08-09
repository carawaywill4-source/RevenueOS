import { requireOwner } from "@/lib/auth";
import { fetchChannels } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ChannelsPage({
  params,
}: {
  params: Promise<{ business: string }>;
}) {
  await requireOwner();
  const { business } = await params;
  const { channels } = await fetchChannels(business);

  return (
    <div>
      <h1 className="text-lg font-semibold mb-1">Channels · {business}</h1>
      <p className="text-sm text-[--color-muted] mb-4">
        Durable channel registry — ranked by revenue per action. α/β posteriors
        come from the mechanism bandit inside the RevenueOS core.
      </p>
      <div className="grid gap-3">
        {channels.length === 0 ? (
          <p className="text-sm text-[--color-muted]">
            No channel records for this business yet.
          </p>
        ) : null}
        {channels.map((c) => {
          const alpha = Number((c.document.alpha as number | undefined) ?? 1);
          const beta = Number((c.document.beta as number | undefined) ?? 1);
          const winning = (c.document.winningAngles as string[] | undefined) ?? [];
          const losing = (c.document.losingAngles as string[] | undefined) ?? [];
          return (
            <div
              key={c.id}
              className="rounded border border-[--color-panel-border] bg-[--color-panel] p-4"
            >
              <div className="flex items-baseline justify-between">
                <div className="font-medium">
                  {c.platform}
                  <span className="text-[--color-muted] text-xs ml-2">
                    {c.account}
                  </span>
                </div>
                <div className="text-xs">
                  <span
                    className={
                      c.status === "paused"
                        ? "text-[--color-warn]"
                        : "text-[--color-success]"
                    }
                  >
                    {c.status}
                  </span>
                </div>
              </div>
              <div className="text-sm mt-2 grid grid-cols-2 gap-2 text-[--color-muted]">
                <div>
                  <span className="text-[--color-text] font-medium">
                    ${c.revenuePerAction.toFixed(2)}
                  </span>{" "}
                  / action
                </div>
                <div>confidence {(c.confidence * 100).toFixed(0)}%</div>
                <div>
                  α {alpha.toFixed(2)} / β {beta.toFixed(2)}
                </div>
              </div>
              {winning.length ? (
                <div className="mt-2 text-xs">
                  <span className="text-[--color-muted]">winning:</span>{" "}
                  {winning.join(" · ")}
                </div>
              ) : null}
              {losing.length ? (
                <div className="text-xs">
                  <span className="text-[--color-muted]">losing:</span>{" "}
                  {losing.join(" · ")}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
