import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/backend/:path*",
        destination: "http://backend:8000/:path*",
      },
      {
        source: "/ai/:path*",
        destination: "http://ai-chatbot:8002/api/:path*",
      },
    ];
  },
};

export default nextConfig;
