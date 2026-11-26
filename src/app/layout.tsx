import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { motionScript } from "@/lib/motion";
import { anniversary } from "@/data/anniversary";
import "./globals.css";
import "./gift-intro.css";

// Self-hosted (assets/fonts/), so builds never need to reach Google Fonts.
// Variable fonts: one file each covers every weight from 100 to 900.
const geistSans = localFont({
  src: "../../assets/fonts/Geist-Variable.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
});
const geistMono = localFont({
  src: "../../assets/fonts/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: anniversary.title,
  description: anniversary.description,
  robots: { index: false, follow: false }, // a private gift, not something to find in search
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: "#050608",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the motion script changes <html> before React loads
    <html lang="en" id="top" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script data-cfasync="false" dangerouslySetInnerHTML={{ __html: motionScript }} />
      </head>
      <body className="antialiased">
        <main>{children}</main>
      </body>
    </html>
  );
}
