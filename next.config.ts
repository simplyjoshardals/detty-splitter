import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: `next build` writes the site to `out/` (ARCHITECTURE §3.1).
  output: "export",
  // No image optimization server exists in a static export.
  images: { unoptimized: true },
  experimental: {
    // Keeps the icon package tree-shaken (DESIGN §2). Re-check the bundle after changes.
    optimizePackageImports: ["@phosphor-icons/react"],
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
