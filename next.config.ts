import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Families trust us with sensitive information, so the browser is told to load
// nothing from third parties: no external scripts, fonts, images or frames.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "frame-ancestors 'none'",
  // The join and login forms hand over to Google or Facebook when a family picks them.
  "form-action 'self' https://accounts.google.com https://www.facebook.com https://m.facebook.com",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Never leak member URLs (which contain post and group ids) to other sites.
  { key: "Referrer-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Browsers only ever use HTTPS for the site once they have seen it over HTTPS.
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]),
];

// Only the public introduction pages may be indexed by search engines.
const indexablePages = "/:lang(en|ta)/:page(about|privacy|guidelines)?";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // PGlite ships WebAssembly and data files that must be loaded from
  // node_modules at runtime rather than bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  experimental: {
    globalNotFound: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: indexablePages,
        headers: [{ key: "X-Robots-Tag", value: "index, follow" }],
      },
    ];
  },
};

export default nextConfig;
