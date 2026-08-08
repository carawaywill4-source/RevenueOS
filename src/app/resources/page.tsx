import { ArrowRight, BookOpen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ResourceFooter,
  ResourceHeader,
} from "@/components/resource-guide";
import { RESOURCE_UPDATED, resourceGuides } from "@/lib/resources";
import { GrowthPageView } from "@/components/growth-page-view";

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://tributeready.org";

export const metadata: Metadata = {
  title: "Memorial Writing & Funeral Program Resources",
  description:
    "Clear, compassionate guides for writing obituaries, planning funeral programs, choosing memorial wording, and preparing files for print.",
  alternates: { canonical: "/resources" },
  openGraph: {
    title: "Memorial Writing & Funeral Program Resources",
    description:
      "Practical, compassionate guidance for writing and creating a meaningful memorial.",
    url: "/resources",
    siteName: "TributeReady",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Memorial Writing & Funeral Program Resources",
    description:
      "Practical, compassionate guidance for writing and creating a meaningful memorial.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "TributeReady Resource Library",
  description: metadata.description,
  url: `${SITE_URL}/resources`,
  dateModified: RESOURCE_UPDATED,
  hasPart: resourceGuides.map((guide) => ({
    "@type": "Article",
    headline: guide.title,
    url: `${SITE_URL}/resources/${guide.slug}`,
  })),
};

export default function ResourcesPage() {
  return (
    <main className="min-h-screen bg-cream">
      <GrowthPageView page="resources" />
      <ResourceHeader />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <section className="botanical-glow soft-grid border-b border-forest/10 px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-gold">
            TributeReady resource library
          </p>
          <h1 className="mt-5 max-w-4xl font-display text-6xl font-semibold leading-[0.9] tracking-[-0.03em] text-forest sm:text-7xl">
            Gentle guidance for
            <br />
            <span className="italic text-sage">meaningful remembrance.</span>
          </h1>
          <p className="mt-7 max-w-2xl text-base leading-8 text-forest/65 sm:text-lg">
            Original, practical guides for writing an obituary, planning a
            service program, choosing the right words, and preparing memorial
            pieces for print.
          </p>
          <p className="mt-5 text-xs font-semibold text-forest/45">
            Updated August 6, 2026 · Editorially reviewed by TributeReady
          </p>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-5 md:grid-cols-2">
            {resourceGuides.map((guide, index) => (
              <article
                key={guide.slug}
                className="group relative flex min-h-72 flex-col rounded-[2rem] border border-forest/10 bg-paper p-7 shadow-[0_18px_50px_rgba(23,62,53,0.05)] transition hover:-translate-y-1 hover:border-sage sm:p-9"
              >
                <div className="flex items-center justify-between gap-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
                    {guide.eyebrow}
                  </p>
                  <span className="font-display text-2xl italic text-sage/60">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h2 className="mt-5 font-display text-4xl font-semibold leading-none text-forest">
                  <Link href={`/resources/${guide.slug}`}>
                    <span className="absolute inset-0" aria-hidden="true" />
                    {guide.shortTitle}
                  </Link>
                </h2>
                <p className="mt-4 text-sm leading-7 text-forest/60">
                  {guide.description}
                </p>
                <div className="mt-auto flex items-center justify-between gap-4 pt-7 text-xs font-semibold text-forest/45">
                  <span className="inline-flex items-center gap-2">
                    <BookOpen size={14} /> {guide.readTime}
                  </span>
                  <ArrowRight
                    size={18}
                    className="text-gold transition group-hover:translate-x-1"
                  />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-forest/10 px-5 pb-20 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="pt-16 font-display text-5xl font-semibold leading-none text-forest">
            Free templates you can copy
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-8 text-forest/65">
            Fill-in-the-blank wording, order of service outlines, and readings
            that are free to print. No sign-up, nothing withheld.
          </p>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {[
              {
                href: "/obituary-templates",
                title: "Obituary templates",
                copy: "Fill-in-the-blank templates for a mother, father, grandparent, spouse, child, or sibling, each with two completed examples.",
              },
              {
                href: "/order-of-service-templates",
                title: "Order of service templates",
                copy: "Full service sequences with realistic timing for Catholic, Baptist, military, graveside, memorial, and celebration of life services.",
              },
              {
                href: "/eulogy-examples",
                title: "Eulogy examples",
                copy: "Complete eulogies for a mother, father, grandparent, sibling, or friend, timed for delivery with opening lines and delivery advice.",
              },
              {
                href: "/funeral-readings",
                title: "Funeral poems and readings",
                copy: "Verified public-domain poems and scripture with full text, sources, and an honest list of what still needs permission.",
              },
            ].map((card) => (
              <article
                key={card.href}
                className="group relative flex flex-col rounded-[2rem] border border-forest/10 bg-paper p-7 shadow-[0_18px_50px_rgba(23,62,53,0.05)] transition hover:-translate-y-1 hover:border-sage"
              >
                <h3 className="font-display text-3xl font-semibold leading-none text-forest">
                  <Link href={card.href}>
                    <span className="absolute inset-0" aria-hidden="true" />
                    {card.title}
                  </Link>
                </h3>
                <p className="mt-4 text-sm leading-7 text-forest/60">
                  {card.copy}
                </p>
                <ArrowRight
                  size={18}
                  className="mt-auto pt-7 text-gold transition group-hover:translate-x-1"
                />
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-forest px-5 py-20 text-center text-white sm:px-8">
        <h2 className="font-display text-5xl font-semibold sm:text-6xl">
          Ready to begin their tribute?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-white/65">
          Turn memories and service details into an editable obituary,
          print-ready program, and coordinated keepsakes.
        </p>
        <Link
          href="/#create"
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-6 py-4 text-sm font-bold text-forest"
        >
          Create a free preview <ArrowRight size={16} />
        </Link>
      </section>
      <ResourceFooter />
    </main>
  );
}
