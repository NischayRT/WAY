// Browser security headers, shared by src/proxy.js (pages, API responses and
// the redirects it makes) and next.config.mjs (every other response, so the
// policy still applies if the proxy is ever skipped).
//
// Content-Security-Policy: only this site's own scripts may run, the page
// may only talk to this site and our Supabase project, it can't be framed
// (clickjacking), plugins/<object> are off, and <base>/<form> can't be
// pointed elsewhere. 'unsafe-inline' for scripts is still needed by Next.js'
// inline bootstrap on static pages; everything else is locked down.
const SUPABASE_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin;
  } catch {
    return '';
  }
})();
const SUPABASE_WS = SUPABASE_ORIGIN.replace(/^http/, 'ws');
const isDev = process.env.NODE_ENV !== 'production';

const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // blob:/data: — the 3D body models decode their textures from blob URLs
  `connect-src 'self' blob: data: ${SUPABASE_ORIGIN} ${SUPABASE_WS}`.trim(),
  "worker-src 'self' blob:",
  "media-src 'self' blob: data:",
  "manifest-src 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  `form-action 'self' https://accounts.google.com ${SUPABASE_ORIGIN}`.trim(),
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ');

export const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP,
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-DNS-Prefetch-Control': 'off',
};

