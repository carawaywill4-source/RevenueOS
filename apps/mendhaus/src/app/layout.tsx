import type { Metadata } from "next";
import { Outfit, Source_Serif_4 } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { PromoBanner } from "@/components/PromoBanner";
import { Providers } from "@/components/Providers";
import { BRAND } from "@/lib/brand";
import { loadMerchState } from "@/lib/merch";
import "./globals.css";

/** Merch / promo state must stay fresh for RevenueOS deals. */
export const revalidate = 30;

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const origin = process.env.NEXT_PUBLIC_APP_URL || "https://mendhaus.shop";

export const metadata: Metadata = {
  metadataBase: new URL(origin),
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s | ${BRAND.name}`,
  },
  description:
    "Problem kits and single fixes for kitchen, bathroom, desk, closet, and renters. Honest install notes, US shipping, no fake reviews.",
  openGraph: {
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description:
      "Curated home fixes sold as kits that clear a real annoyance — under the sink, in the shower, at the desk.",
    url: "/",
    siteName: BRAND.name,
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const merch = await loadMerchState();
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: BRAND.name,
      url: origin,
      email: BRAND.supportEmail,
      description: BRAND.tagline,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: BRAND.name,
      url: origin,
    },
  ];

  return (
    <html lang="en" className={`${outfit.variable} ${sourceSerif.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-ink">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
        <Providers>
          <PromoBanner merch={merch} />
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
