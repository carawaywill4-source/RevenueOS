import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL || "https://tributeready.org";
  return {
    rules: {
      userAgent: "*",
      // The Word and printable routes serve free public downloads, so they
      // stay crawlable while the rest of the API does not.
      allow: ["/", "/memorial/", "/api/word/", "/api/printable/"],
      disallow: ["/api/", "/success", "/owner"],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
