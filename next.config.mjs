import { SECURITY_HEADERS } from './src/lib/securityHeaders.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Don't advertise the framework/version in every response.
  poweredByHeader: false,

  // The full browser security header set (CSP, frame-ancestors, HSTS…) on
  // every response, including files src/proxy.js doesn't run on (JS/CSS
  // bundles, images, 3D models). The proxy sets the same values on pages,
  // API responses and its own redirects, so they hold even if one is skipped.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: Object.entries(SECURITY_HEADERS).map(([key, value]) => ({ key, value })),
      },
    ];
  },
};

export default nextConfig;
