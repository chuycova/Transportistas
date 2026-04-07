import type { NextConfig } from 'next';

// ─── Security Headers ────────────────────────────────────────────────────────
// Hardened against CVE-2025-55182 (Next.js RSC RCE — mitigado con next≥15.3.0)
// and depth-in-defense via CSP restricting script/connect sources.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self)',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    // CSP — defence-in-depth against CVE-2025-55182 and XSS
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Next.js inline scripts for hydration require 'unsafe-inline' in dev
      // In production this should be replaced with a nonce-based CSP
      "script-src 'self' 'unsafe-inline' https://maps.googleapis.com https://maps.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      'img-src \'self\' data: blob: https://maps.gstatic.com https://*.googleapis.com',
      [
        "connect-src 'self'",
        'https://*.supabase.co',
        'wss://*.supabase.co',
        'https://routes.googleapis.com',
        'https://maps.googleapis.com',
        'http://localhost:3001',
        'ws://localhost:3001',
      ].join(' '),
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  // ─── Output ──────────────────────────────────────────────────────────────
  // 'standalone' for Docker / Railway; remove for Vercel (auto-detected)
  // output: 'standalone',

  // ─── Security ────────────────────────────────────────────────────────────
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },

  // ─── Transpile monorepo workspace packages ────────────────────────────────
  transpilePackages: ['@zona-zero/domain', '@zona-zero/infrastructure'],

  // ─── Logging ─────────────────────────────────────────────────────────────
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === 'development',
    },
  },
};

export default nextConfig;
