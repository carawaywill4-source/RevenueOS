import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://tributeready.org",
  ),
  title: {
    default: "TributeReady — A life, beautifully remembered",
    template: "%s | TributeReady",
  },
  description:
    "Create a beautiful memorial page and coordinated print-ready keepsakes, gently guided from first memory to finished tribute.",
  keywords: [
    "memorial page",
    "funeral program",
    "celebration of life",
    "obituary writer",
    "memorial keepsakes",
  ],
  openGraph: {
    title: "TributeReady — A life, beautifully remembered",
    description:
      "Thoughtful memorial pages and print-ready keepsakes, created with care.",
    url: "/",
    siteName: "TributeReady",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TributeReady — A life, beautifully remembered",
    description:
      "Thoughtful memorial pages and print-ready keepsakes, created with care.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL || "https://tributeready.org";
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${origin}/#organization`,
      name: "TributeReady",
      url: origin,
      description:
        "Guided memorial writing, print-ready funeral programs, coordinated keepsakes, and private memorial pages.",
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${origin}/#website`,
      url: origin,
      name: "TributeReady",
      publisher: { "@id": `${origin}/#organization` },
    },
    {
      "@context": "https://schema.org",
      "@type": "Service",
      "@id": `${origin}/#memorial-service`,
      name: "TributeReady memorial collection",
      provider: { "@id": `${origin}/#organization` },
      areaServed: "US",
      serviceType:
        "Memorial writing and digital funeral program design service",
      description:
        "A guided obituary draft, private memorial page, print-ready program, memorial card, and matching thank-you card.",
      offers: {
        "@type": "Offer",
        price: "34.99",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: `${origin}/#create`,
      },
    },
  ];

  return (
    <html
      lang="en"
      className={`${manrope.variable} ${cormorant.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
        {children}
      </body>
    </html>
  );
}
