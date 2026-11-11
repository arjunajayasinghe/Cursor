import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Do not set outputFileTracingRoot to the monorepo root — Cursor/Vercel publish
  // then resolves a doubled path and cannot find .next/routes-manifest.json.
  transpilePackages: ["@alumex/db"],
  // Port-forward / Safari often hit 127.0.0.1 while Next serves as localhost.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
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
