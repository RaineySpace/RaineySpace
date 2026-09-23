import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  // exifr dynamically loads Node built-ins; bundling breaks its filesystem reader.
  serverExternalPackages: ["exifr"],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
