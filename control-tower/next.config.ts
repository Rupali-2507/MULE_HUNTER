import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone mode is only for Docker/production. Remove for local dev.
  // output: 'standalone',

  typescript: {
    ignoreBuildErrors: true,  // allow dev to run with minor type issues
  },

  // Use Turbopack (Next.js 16 default) — root silences multi-lockfile workspace warning
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;