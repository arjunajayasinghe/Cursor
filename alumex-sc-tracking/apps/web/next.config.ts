import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Do not set outputFileTracingRoot to the monorepo root — Cursor/Vercel publish
  // then resolves a doubled path and cannot find .next/routes-manifest.json.
  transpilePackages: ["@alumex/db"],
  // cursor/identity.ts imports ./identity.dev.js — resolve to .ts in this workspace
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias || {}),
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
