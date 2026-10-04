import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: no server. Public profiles live at /p?u=<handle> and are fetched client-side.
  output: "export",
  // GitHub Pages project site lives at /player-one; empty locally.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "",
  images: { unoptimized: true },
};

export default nextConfig;
