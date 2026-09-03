/**
 * Evergreen online-selling heuristics. Deliberately NOT a live news/scraping
 * feed in this slice — these are durable patterns that survive across cycles and
 * sites. Time-sensitive trend ingestion is a future, policy-reviewed capability.
 */

export type SellingHeuristic = {
  key: string;
  summary: string;
};

export const SELLING_HEURISTICS: SellingHeuristic[] = [
  {
    key: "intent-match",
    summary:
      "Buyers convert when the landing surface matches their exact intent; generic pages leak.",
  },
  {
    key: "speed-to-value",
    summary:
      "The faster a shopper reaches a tangible result, the higher the purchase rate.",
  },
  {
    key: "trust-compounds",
    summary:
      "Visible reliability (delivery proof, guarantees, real support) lifts conversion more than urgency tricks.",
  },
  {
    key: "margin-first-growth",
    summary:
      "Durable growth is funded by contribution margin, not by discounting into volume.",
  },
  {
    key: "retain-then-acquire",
    summary:
      "A repeat buyer is cheaper than a new one; retention levers often out-ROI acquisition once sales exist.",
  },
];

export function heuristic(key: string): string | undefined {
  return SELLING_HEURISTICS.find((h) => h.key === key)?.summary;
}
