/** @type {import('next').NextConfig} */
const nextConfig = {
  // Don't advertise the framework/version in every response.
  poweredByHeader: false,

  // Baseline headers for files the middleware doesn't run on (JS/CSS bundles,
  // images, 3D models). Pages and API responses get the full set, including
  // the Content-Security-Policy, from src/middleware.js.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
