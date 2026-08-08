"use client";

import { useEffect } from "react";
import { track } from "@/lib/track";

export function TopicTracker({ slug }: { slug: string }) {
  useEffect(() => {
    track("landing_view", {
      metadata: { topic_slug: slug, path: `/topics/${slug}`, page_kind: "intent_topic" },
    });
    track("page_view", {
      metadata: { topic_slug: slug, path: `/topics/${slug}`, page_kind: "intent_topic" },
    });
  }, [slug]);
  return null;
}
