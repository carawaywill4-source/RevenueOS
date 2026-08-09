import { requireOwner } from "@/lib/auth";
import LogStream from "./LogStream";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  await requireOwner();
  return (
    <div>
      <h1 className="text-lg font-semibold mb-1">Live log</h1>
      <p className="text-sm text-[--color-muted] mb-4">
        Streaming operator pursuit events via SSE. Each row is a
        planner/executor step on one business.
      </p>
      <LogStream />
    </div>
  );
}
