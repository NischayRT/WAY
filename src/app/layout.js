import localFont from "next/font/local";
import "./globals.css";

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
  title: "WAY — Diet & Physique Studio",
  description: "Indian-food-focused macro tracking and 3D physique projection",
  icons: {
    icon: '/favicon.ico', // or your custom path like '/icon.png'
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable} ${instrumentSerif.variable} ${ptSansNarrow.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-leaf text-ink">{children}</body>
    </html>
  );
}