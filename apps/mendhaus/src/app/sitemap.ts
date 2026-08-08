import type { MetadataRoute } from "next";
import { CATEGORIES, PRODUCTS } from "@/catalog/products";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://mendhaus.shop").replace(/\/$/, "");
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now },
    { url: `${base}/shop`, lastModified: now },
    { url: `${base}/guides`, lastModified: now },
    { url: `${base}/guides/renter-friendly-upgrades`, lastModified: now },
    { url: `${base}/guides/under-sink-organizer`, lastModified: now },
    { url: `${base}/guides/pet-hair-hardwood`, lastModified: now },
    { url: `${base}/guides/small-desk-setup`, lastModified: now },
    { url: `${base}/shipping`, lastModified: now },
    { url: `${base}/returns`, lastModified: now },
    { url: `${base}/privacy`, lastModified: now },
    { url: `${base}/terms`, lastModified: now },
    { url: `${base}/contact`, lastModified: now },
    ...CATEGORIES.map((slug) => ({ url: `${base}/category/${slug}`, lastModified: now })),
    ...PRODUCTS.map((p) => ({ url: `${base}/product/${p.slug}`, lastModified: now })),
  ];
}
