"use client";

import { useEffect } from "react";
import {
  captureFirstTouchAttribution,
  trackGrowthEvent,
  type GrowthEvent,
} from "@/lib/growth-client";

type PageName = Extract<GrowthEvent, { name: "landing_view" }>["metadata"]["page"];

export function GrowthPageView({ page }: { page: PageName }) {
  useEffect(() => {
    const attribution = captureFirstTouchAttribution();
    void trackGrowthEvent({
      name: "landing_view",
      metadata: {
        page,
        source: attribution?.source,
        medium: attribution?.medium,
        campaign: attribution?.campaign,
        referrerHost: attribution?.referrerHost,
      },
    });
  }, [page]);

  return null;
}
