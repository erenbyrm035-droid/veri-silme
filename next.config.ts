import type { NextConfig } from "next";

// Güvenlik başlıkları — production sertleştirme.
// CSP, Next.js + Supabase + TF.js(wasm/eval) + Three.js(blob worker) ile uyumlu
// olacak şekilde ayarlandı; işlevselliği bozmadan koruma sağlar.
const isDev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  // Next inline bootstrap + framer-motion; TF.js wasm 'unsafe-eval' ister.
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  // Supabase (REST/Realtime/Storage) + AI sağlayıcı çağrıları.
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com https://api.anthropic.com${isDev ? " ws: http://localhost:*" : ""}`,
  "media-src 'self' https: blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // iyzipay SDK'sı çalışırken lib/resources'tan dosya okur; bundle edilirse
  // serverless'ta bulunamaz (ENOENT scandir). External bırak + kaynakları
  // deploy izine dahil et.
  serverExternalPackages: ["iyzipay"],
  outputFileTracingIncludes: {
    "/premium": ["./node_modules/iyzipay/**/*"],
    "/api/billing/iyzico/callback": ["./node_modules/iyzipay/**/*"],
    "/api/billing/**": ["./node_modules/iyzipay/**/*"],
  },
  // Server Action gövde limiti — GIF/MP4 medya yüklemeleri için (varsayılan 1MB).
  experimental: {
    serverActions: { bodySizeLimit: "50mb" },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }],
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/_next/static/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
    ];
  },
};

export default nextConfig;
