import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  devIndicators: false,
  allowedDevOrigins: ["10.56.15.209"],
  output: process.env.STEPFLOW_STANDALONE === "1" ? "standalone" : undefined,
  outputFileTracingRoot: path.resolve(__dirname, ".."),
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    root: path.resolve(__dirname, ".."),
    rules: {
      "globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
