import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: no server. Public profiles live at /p?u=<handle> and are fetched client-side.
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
