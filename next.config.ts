import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.maps4heroes.com",
      },
      {
        protocol: "https",
        hostname: "cdn.discordapp.com",
      },
      {
        // Cloudflare R2 public buckets — covers any pub-XXX.r2.dev URL.
        protocol: "https",
        hostname: "*.r2.dev",
      },
    ],
  },
};

export default nextConfig;
