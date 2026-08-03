import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  typescript: {
    ignoreBuildErrors: true,
  },

  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;