"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ATTRIBUTION_COOKIE,
  attributionFromSearch,
  parseAttribution,
} from "@/lib/attribution";
import { flushTrackQueue, trackPage } from "@/lib/track";

export function AttributionCapture() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname?.startsWith("/owner") || pathname?.startsWith("/api")) return;

    const existing = parseAttribution(readCookie(ATTRIBUTION_COOKIE));
    const referrerHost = document.referrer
      ? (() => {
          try {
            return new URL(document.referrer).host;
          } catch {
            return undefined;
          }
        })()
      : undefined;
    const hasUtm =
      searchParams.has("utm_source") ||
      searchParams.has("utm_medium") ||
      searchParams.has("channel") ||
      searchParams.has("persona") ||
      searchParams.has("a");
    const attr =
      hasUtm || !existing
        ? attributionFromSearch(searchParams, pathname || "/", referrerHost)
        : existing;

    document.cookie = `${ATTRIBUTION_COOKIE}=${encodeURIComponent(JSON.stringify(attr))}; path=/; max-age=${60 * 60 * 24 * 90}; samesite=lax`;

    const firstTouch = !sessionStorage.getItem("mh_landed");
    if (firstTouch) sessionStorage.setItem("mh_landed", "1");
    trackPage(pathname || "/", firstTouch || hasUtm);
    void flushTrackQueue();
  }, [pathname, searchParams]);

  return null;
}

function readCookie(name: string) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
