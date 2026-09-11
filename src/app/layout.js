import { Fraunces, IBM_Plex_Sans, IBM_Plex_Mono, Instrument_Serif, PT_Sans_Narrow } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["500", "600"],
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["500", "600"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: ["400"],
});

// Heading font for everything EXCEPT the logo/wordmark (that stays on
// font-brand / Instrument Serif, used in BottomNav.js and the login page).
const ptSansNarrow = PT_Sans_Narrow({
  variable: "--font-pt-narrow",
  subsets: ["latin"],
  weight: ["400", "700"],
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