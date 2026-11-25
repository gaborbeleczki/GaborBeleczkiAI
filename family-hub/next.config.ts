import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  // Everything in this app is private, per-request data, so we use classic dynamic rendering.
  cacheComponents: false,
  partialPrefetching: false,
  poweredByHeader: false,
  serverExternalPackages: ["@electric-sql/pglite"],
  // Drizzle migrations are read from disk at runtime.
  outputFileTracingIncludes: {
    "/**": ["./drizzle/**/*"],
  },
  // never bundle the local dev database or private seed files
  outputFileTracingExcludes: {
    "/**": ["./.data/**/*", "./.local/**/*", "./.env*"],
  },
  turbopack: {
    // The repo root holds another project's lockfile; pin the root so Turbopack doesn't watch
    // the parent folder (its own .next/dev log writes caused an endless dev refresh loop).
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
