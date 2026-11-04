import type { NextConfig } from "next";

const apiUrl = new URL(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api");
const extraImageHosts = (process.env.NEXT_PUBLIC_IMAGE_HOSTS || "")
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: [
      { protocol: apiUrl.protocol.replace(":", "") as "http" | "https", hostname: apiUrl.hostname, port: apiUrl.port, pathname: "/storage/**" },
      // Future S3 / Cloudinary hosts, e.g. NEXT_PUBLIC_IMAGE_HOSTS=res.cloudinary.com,my-bucket.s3.ap-south-1.amazonaws.com
      ...extraImageHosts.map((hostname) => ({ protocol: "https" as const, hostname })),
    ],
    // Only when the API itself runs on this machine (local dev / local prod test).
    // A public API hostname keeps the default SSRF protection.
    dangerouslyAllowLocalIP: ["localhost", "127.0.0.1", "[::1]"].includes(apiUrl.hostname),
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
