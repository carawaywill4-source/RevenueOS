import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://mendhaus.shop").replace(/\/$/, "");
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/owner", "/cart", "/order", "/api/"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
