import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The monthly report became /reports (monthly and yearly); old links keep working
  // and their ?month= / ?side= carry over.
  async redirects() {
    return [{ source: "/reports/monthly", destination: "/reports", permanent: false }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
