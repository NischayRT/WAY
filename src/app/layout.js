import localFont from "next/font/local";
import "./globals.css";
import { LEGAL } from "@/lib/legal";

// Same families as before (Fraunces, IBM Plex Sans/Mono, Instrument Serif,
// PT Sans Narrow) and the same CSS variable names, but self-hosted from
// ./fonts instead of fetched from Google at build/dev time. When that fetch
// fails (offline, firewall, locked .next cache on Windows) Next silently
// swaps in generic fallback fonts, which is what made everything look like
// plain Arial.
const fraunces = localFont({
  variable: "--font-fraunces",
  src: [{ path: "./fonts/fraunces-latin-wght-normal.woff2", weight: "100 900", style: "normal" }],
  display: "swap",
});

const plexSans = localFont({
  variable: "--font-plex-sans",
  src: [
    { path: "./fonts/ibm-plex-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-sans-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ibm-plex-sans-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  display: "swap",
});

const plexMono = localFont({
  variable: "--font-plex-mono",
  src: [
    { path: "./fonts/ibm-plex-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ibm-plex-mono-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  display: "swap",
});

const instrumentSerif = localFont({
  variable: "--font-instrument-serif",
  src: [{ path: "./fonts/instrument-serif-latin-400-normal.woff2", weight: "400", style: "normal" }],
  display: "swap",
});

// Heading font for everything EXCEPT the logo/wordmark (that stays on
// font-brand / Instrument Serif, used in BottomNav.js and the login page).
const ptSansNarrow = localFont({
  variable: "--font-pt-narrow",
  src: [
    { path: "./fonts/pt-sans-narrow-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/pt-sans-narrow-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
});

export const metadata = {
  metadataBase: new URL(LEGAL.SITE_URL),
  title: {
    default: "WAY Studio — Indian food diet & physique tracker",
    template: "%s | WAY Studio",
  },
  description:
    "WAY Studio is a diet and nutrition tracking app for Indian food. Log meals, track calories and macros, record your weight, and optionally sync with Google Health.",
  applicationName: "WAY Studio",
  openGraph: {
    title: "WAY Studio",
    description: "Indian-food-focused calorie and macro tracking, weight logging and physique projection.",
    siteName: "WAY Studio",
    type: "website",
  },
  icons: {
    icon: '/favicon.ico',
  },
};

// Google Search Console HTML-tag verification. Set NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
// (only the content="..." value) for the Production environment in Vercel.
// Rendered by hand inside <head> so it is always in the first HTML the verifier
// downloads (streamed metadata can otherwise land in <body>).
const SITE_VERIFICATION = (process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || LEGAL.GOOGLE_SITE_VERIFICATION || '')
  .trim()
  .replace(/^["']|["']$/g, '');

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable} ${instrumentSerif.variable} ${ptSansNarrow.variable} h-full antialiased`}
    >
      {SITE_VERIFICATION ? (
        <head>
          <meta name="google-site-verification" content={SITE_VERIFICATION} />
        </head>
      ) : null}
      <body className="min-h-full flex flex-col bg-leaf text-ink">{children}</body>
    </html>
  );
}