import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // node-pty is server-only
      config.resolve.fallback = {
        ...config.resolve.fallback,
        child_process: false,
        fs: false,
        net: false,
        tls: false,
      };
    }
    config.externals = config.externals || [];
    if (isServer) {
      config.externals.push("node-pty");
    }
    return config;
  },
};

export default nextConfig;
