import type { NextConfig } from "next";

// Allow any origin in production (Vercel), restrict to localhost in dev
const getAllowedOrigins = () => {
  if (process.env.ALLOWED_ORIGINS) {
    return process.env.ALLOWED_ORIGINS.split(",");
  }
  if (process.env.NODE_ENV === "production") {
    // Production: require explicit ALLOWED_ORIGINS, fallback to Vercel URL
    return [process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://alljob367-cyber-chatcommerce-crm-af.vercel.app"];
  }
  return ["http://localhost:3000", "http://localhost:81"];
};

const allowedOrigins = getAllowedOrigins();

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.telegram.org" },
      { protocol: "https", hostname: "**" },
    ],
  },
  // L2 FIX: Do NOT ignore build errors
  typescript: {
    ignoreBuildErrors: false,
    tsconfigPath: "tsconfig.json",
  },
  reactStrictMode: true,
  // M1 FIX: Security headers
  async headers() {
    const corsHeaders: { key: string; value: string }[] = [
      {
        key: "Access-Control-Allow-Methods",
        value: "GET, POST, PATCH, DELETE, OPTIONS",
      },
      {
        key: "Access-Control-Allow-Headers",
        value: "Content-Type, Authorization",
      },
      {
        key: "Access-Control-Max-Age",
        value: "86400",
      },
    ];

    // Set Allow-Origin separately to handle wildcard
    const corsOrigin = allowedOrigins.includes("*")
      ? { key: "Access-Control-Allow-Origin", value: "*" }
      : { key: "Access-Control-Allow-Origin", value: allowedOrigins.join(", ") };

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
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https: blob:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://api.telegram.org https://api.mistral.ai wss:; frame-ancestors 'none';",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "same-origin",
          },
        ],
      },
      {
        source: "/api/:path*",
        headers: [corsOrigin, ...corsHeaders],
      },
    ];
  },
  // L4 FIX: Limit body size
  experimental: {
    serverActions: {
      bodySizeLimit: "1mb",
    },
  },
};

export default nextConfig;
