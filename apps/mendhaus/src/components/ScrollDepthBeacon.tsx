"use client";

import { useEffect } from "react";
import { track } from "@/lib/track";

const MARKS = [25, 50, 75, 100] as const;

export function ScrollDepthBeacon({ productId }: { productId?: string }) {
  useEffect(() => {
    const seen = new Set<number>();
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      const pct = Math.round((window.scrollY / max) * 100);
      for (const mark of MARKS) {
        if (pct >= mark && !seen.has(mark)) {
          seen.add(mark);
          track("scroll_depth", {
            productId,
            metadata: { depth: mark },
          });
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [productId]);
  return null;
}
