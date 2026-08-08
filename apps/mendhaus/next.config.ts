import type { NextConfig } from "next";

const scriptSource =
  process.env.NODE_ENV === "development"
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";

const imgSrc = [
  "'self'",
  "data:",
  "blob:",
  "https://images.unsplash.com",
  "https://*.cjdropshipping.com",
  "https://*.aliyuncs.com",
  "https://cf.cjdropshipping.com",
  "https://oss.cjdropshipping.com",
].join(" ");

const nextConfig: NextConfig = {
  transpilePackages: ["@revenueos/core"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.cjdropshipping.com" },
      { protocol: "https", hostname: "cf.cjdropshipping.com" },
      { protocol: "https", hostname: "oss.cjdropshipping.com" },
      { protocol: "https", hostname: "**.aliyuncs.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; ${scriptSource}; style-src 'self' 'unsafe-inline'; img-src ${imgSrc}; font-src 'self'; connect-src 'self' https://api.stripe.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://checkout.stripe.com`,
          },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
