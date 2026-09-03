import type { Metadata } from "next";
import "./globals.css";
import { BRAND } from "@/lib/brand";
import { BeaconScript } from "@/components/BeaconScript";

export const metadata: Metadata = {
  title: `${BRAND.displayName} — ${BRAND.product.tagline}`,
  description: BRAND.product.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600&family=IBM+Plex+Serif:wght@600;700&display=swap"
          rel="stylesheet"
        />
        <BeaconScript />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
