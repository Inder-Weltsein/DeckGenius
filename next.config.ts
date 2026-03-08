import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.clashroyale.com",
      },
      {
        protocol: "https",
        hostname: "cdn.royaleapi.com",
      },
    ],
  },
};

export default nextConfig;
