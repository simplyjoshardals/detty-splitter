import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: `next build` writes the site to `out/` (ARCHITECTURE §3.1).
  output: "export",
  // No image optimization server exists in a static export.
  images: { unoptimized: true },
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