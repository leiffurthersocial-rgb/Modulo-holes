import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // three.js ecosystem ships modern ESM; transpile to keep older Safari happy.
  transpilePackages: ["three"],
};

export default nextConfig;
