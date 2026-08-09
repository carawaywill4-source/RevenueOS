import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";
import { expandPermissionlessDoors } from "@revenueos/storefront-kit";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://depositproof.vercel.app").replace(
    /\/$/,
    "",
  );
  const now = new Date();
  return [
    { url: base, lastModified: now, changeFrequency: "daily", priority: 1 },
    ...expandPermissionlessDoors(BRAND).map((d) => ({
      url: `${base}/topics/${d.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
  ];
}
