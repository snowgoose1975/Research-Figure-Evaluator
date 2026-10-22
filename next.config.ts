import type { NextConfig } from "next";
const config: NextConfig = {
  agentRules: false,
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next-build",
  serverExternalPackages: ["@resvg/resvg-js"],
  poweredByHeader: false,
};
export default config;
