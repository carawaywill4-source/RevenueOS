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
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Source+Sans+3:wght@400;600&display=swap"
          rel="stylesheet"
        />
        <BeaconScript />
      </head>
      <body>{children}</body>
    </html>
  );
}
