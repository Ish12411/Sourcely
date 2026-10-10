import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    // Baked into the client bundle at build time. /api/version reports the
    // commit the server is running; when they differ, an open copy of the app
    // is out of date (see useStaleBuildReload).
    NEXT_PUBLIC_BUILD_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
  },
};

export default nextConfig;
