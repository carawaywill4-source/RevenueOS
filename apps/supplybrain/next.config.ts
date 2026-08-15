import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  transpilePackages: ["@revenueos/core", "@revenueos/storefront-kit"],
};
export default nextConfig;
