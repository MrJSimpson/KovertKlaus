import type { NextConfig } from "next";
import fs from "fs";
import path from "path";

const isStaticExport =
  process.env.STATIC_EXPORT === "true" ||
  process.env.CF_PAGES === "1" ||
  process.env.CLOUDFLARE_PAGES === "1";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pg', 'pg-cloudflare', '@prisma/client', '@prisma/adapter-pg', 'bcryptjs'],
  ...(isStaticExport
    ? {
        output: "export",
        images: {
          unoptimized: true,
        },
      }
    : {
        output: "standalone",
        async headers() {
          return [
            {
              source: "/(.*)",
              headers: [
                {
                  key: "X-Frame-Options",
                  value: "DENY",
                },
                {
                  key: "X-Content-Type-Options",
                  value: "nosniff",
                },
                {
                  key: "Referrer-Policy",
                  value: "strict-origin-when-cross-origin",
                },
                {
                  key: "Permissions-Policy",
                  value: "camera=(), microphone=(), geolocation=()",
                },
                {
                  key: "Content-Security-Policy",
                  value:
                    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';",
                },
              ],
            },
          ];
        },
      }),
};

export default nextConfig;
