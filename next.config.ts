import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // node:sqlite, ffmpeg child processes and local file storage are server-only.
  serverExternalPackages: [],
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
