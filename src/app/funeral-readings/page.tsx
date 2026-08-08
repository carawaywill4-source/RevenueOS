import type { Metadata } from "next";
import { ArrowRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import { CopyTextButton } from "@/components/copy-text-button";
import { GrowthPageView } from "@/components/growth-page-view";
import { ResourceFooter, ResourceHeader } from "@/components/resource-guide";
import {
  funeralReadings,
  permissionNeeded,
  readingTones,
} from "@/lib/funeral-readings";
import { TEMPLATE_UPDATED } from "@/lib/obituary-templates";

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://tributeready.org";

const TITLE = "Funeral Poems and Readings You Can Legally Print";
const DESCRIPTION =
  "Verified public-domain funeral poems and scripture readings, with full text, source links, copyright status, and a list of frequently requested poems that still need permission.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/funeral-readings" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/funeral-readings",
    siteName: "TributeReady",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

const FAQS = [
  {
    question: "Can I print a poem in a funeral program?",
    answer:
      "Only if the poem is in the public domain or you have permission. Reading a poem aloud at a private service is generally treated differently from reproducing its text in a printed document you hand out. Every poem on this page is public domain in the United States and is safe to print, and each entry names the source and the reason.",
  },
  {
    question: "How do I know whether a poem is in the public domain?",
    answer:
      "In the United States, works published in 1930 or earlier are in the public domain. Works published later may still be protected. Outside the United States, the common rule is the author's life plus seventy years, which means a poem can be free to print in one country and protected in another. When a poem's status is unclear, the safest approach is to name the poem in the program and read it aloud rather than reproducing the text.",
  },
  {
    question: "What is the most common funeral reading?",
    answer:
      "Psalm 23 is the most widely read passage at English-language funerals. Among poems, Christina Rossetti's \"Remember,\" Robert Louis Stevenson's \"Requiem,\" and Tennyson's \"Crossing the Bar\" are the most frequently requested public-domain choices, and all three are short enough to read aloud comfortably.",
  },
  {
    question: "How long should a funeral reading be?",
    answer:
      "One to two minutes, which is roughly fourteen to forty lines. Most services include one or two readings. Longer passages are difficult for a grieving reader to deliver and difficult for a standing congregation to follow, particularly at a graveside.",
  },
  {
    question: "Who should read at a funeral?",
    answer:
      "Someone who can get through it. That is the only real requirement, and it is worth taking seriously. Ask a slightly more distant relative, a friend, or the officiant rather than the closest family member, and always have a second person prepared to step in.",
  },
];

export default function FuneralReadingsPage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: TITLE,
      description: DESCRIPTION,
      isAccessibleForFree: true,
      datePublished: TEMPLATE_UPDATED,
      dateModified: TEMPLATE_UPDATED,
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": `${SITE_URL}/funeral-readings`,
      },
      author: {
        "@type": "Organization",
        name: "TributeReady Editorial Team",
        url: `${SITE_URL}/resources`,
      },
      publisher: {
        "@type": "Organization",
        name: "TributeReady",
        url: SITE_URL,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        {
          "@type": "ListItem",
          position: 2,
          name: "Funeral poems and readings",
          item: `${SITE_URL}/funeral-readings`,
        },
      ],
    },
  ];

  return (
    <>
      <GrowthPageView page="funeral_readings" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <main className="min-h-screen bg-cream">
        <ResourceHeader />

        <header className="botanical-glow soft-grid border-b border-forest/10 px-5 py-16 sm:px-8 lg:py-24">
          <div className="mx-auto max-w-4xl">
            <nav
              aria-label="Breadcrumb"
              className="text-xs font-semibold text-forest/50"
            >
              <Link href="/" className="hover:text-forest">
                Home
              </Link>
            </nav>
            <p className="mt-10 text-[10px] font-bold uppercase tracking-[0.24em] text-gold">
              Verified public domain · free to print
            </p>
            <h1 className="mt-4 max-w-3xl font-display text-5xl font-semibold leading-[0.95] tracking-[-0.02em] text-forest sm:text-7xl">
              Funeral poems and readings you can legally print
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-forest/65 sm:text-lg">
              Every poem and passage below is in the public domain in the United
              States, with the full text, the original source, and the reason it
              is free to use. Further down there is an honest list of the poems
              families request most often that still require permission.
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8 lg:py-16">
          <section id="why">
            <h2 className="font-display text-4xl font-semibold leading-tight text-forest">
              Why this page checks the copyright
            </h2>
            <div className="mt-5 space-y-4 text-base leading-8 text-forest/70">
              <p>
                Most funeral poem lists online reproduce whatever is popular,
                including work that is firmly in copyright. That is a real
                problem for families, because printing a poem in a program is a
                reproduction, and it is a real problem for the funeral homes and
                churches that print on their behalf.
              </p>
              <p>
                So each reading here carries its publication year, its source,
                and a plain statement of its rights status. In the United
                States, anything published in 1930 or earlier is in the public
                domain. Outside the United States the usual rule is the
                author&apos;s life plus seventy years, which is why a poem can
                be free in one
                country and protected in another.
              </p>
              <p>
                If a poem you love is not on this list, you can still read it
                aloud at the service and name it in the program. Naming a work
                and reading it are different from reprinting its text.
              </p>
              <p>
                We checked how common the problem is.{" "}
                <Link
                  href="/funeral-poem-copyright"
                  className="font-semibold text-forest underline decoration-sage underline-offset-4"
                >
                  Of the twelve top-ranking funeral poem pages we could analyze,
                  eleven reproduced work that is in copyright or of disputed
                  status
                </Link>
                , and one stated the public-domain status of anything.
              </p>
            </div>
          </section>

          {readingTones.map((tone) => {
            const readings = funeralReadings.filter(
              (reading) => reading.tone === tone.id,
            );
            if (readings.length === 0) return null;
            return (
              <section key={tone.id} id={tone.id} className="mt-16 scroll-mt-8">
                <h2 className="font-display text-4xl font-semibold leading-tight text-forest">
                  {tone.label}
                </h2>
                <p className="mt-4 text-base leading-8 text-forest/70">
                  {tone.blurb}
                </p>
                <div className="mt-7 space-y-6">
                  {readings.map((reading) => (
                    <article
                      key={reading.id}
                      id={reading.id}
                      className="scroll-mt-8 rounded-3xl border border-forest/10 bg-paper p-6 shadow-[0_18px_50px_rgba(23,62,53,0.06)] sm:p-8"
                    >
                      <h3 className="font-display text-3xl font-semibold leading-tight text-forest">
                        {reading.title}
                      </h3>
                      <p className="mt-2 text-sm font-semibold text-forest/55">
                        {reading.author} · {reading.year}
                      </p>
                      <p className="mt-4 text-base leading-7 text-forest/70">
                        {reading.fits}
                      </p>
                      <pre className="mt-6 whitespace-pre-wrap font-sans text-[15px] leading-8 text-forest/85">
                        {reading.lines.join("\n")}
                      </pre>
                      <div className="mt-6 border-t border-forest/10 pt-5">
                        <p className="text-sm leading-6 text-forest/60">
                          <strong className="font-semibold text-forest">
                            Rights:
                          </strong>{" "}
                          {reading.rights}
                        </p>
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <CopyTextButton
                            text={`${reading.title}\n${reading.author}\n\n${reading.lines.join("\n")}`}
                            label="Copy reading"
                          />
                          <a
                            href={reading.source.url}
                            rel="noopener noreferrer"
                            target="_blank"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-forest/55 hover:text-forest"
                          >
                            {reading.source.label}
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}

          <section id="permission" className="mt-16 scroll-mt-8">
            <h2 className="font-display text-4xl font-semibold leading-tight text-forest">
              Frequently requested, but not free to print
            </h2>
            <p className="mt-4 text-base leading-8 text-forest/70">
              These are among the most-requested funeral readings in English,
              and all of them are reproduced constantly without permission. You
              can read them aloud at a private service. Printing the text in a
              program is a different act, and it is the one that creates risk.
            </p>
            <div className="mt-7 space-y-4">
              {permissionNeeded.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-forest/10 bg-paper p-6"
                >
                  <p className="font-display text-2xl font-semibold text-forest">
                    {item.title}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-forest/55">
                    {item.author}
                  </p>
                  <p className="mt-3 text-base leading-7 text-forest/70">
                    {item.status}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-6 border-l-2 border-sage bg-mist/60 px-5 py-4 text-sm leading-6 text-forest/65">
              <strong className="text-forest">Note:</strong> This page is
              general information, not legal advice. Copyright terms vary by
              country and by the specific edition of a work. If you are unsure,
              name the poem in the program rather than reprinting it.
            </p>
          </section>

          <section className="mt-16 rounded-[2rem] bg-forest p-8 text-white sm:p-10">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#d8c08e]">
              When you are ready
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold">
              Put the reading into a printed program
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-white/65">
              These readings are free. If you need the printed pieces for the
              service, TributeReady lays out a four-panel bifold program with
              your order of service, photograph, and tribute, and gives you
              print-ready files for a one-time $34.99.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/#create"
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-forest"
              >
                Start a draft for free <ArrowRight size={15} />
              </Link>
              <Link
                href="/order-of-service-templates"
                className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3.5 text-sm font-bold text-white"
              >
                Order of service templates
              </Link>
            </div>
          </section>

          <section id="faq" className="mt-16">
            <h2 className="font-display text-4xl font-semibold leading-tight text-forest">
              Common questions
            </h2>
            <dl className="mt-7 space-y-6">
              {FAQS.map((faq) => (
                <div
                  key={faq.question}
                  className="rounded-2xl border border-forest/10 bg-paper p-6"
                >
                  <dt className="font-display text-2xl font-semibold text-forest">
                    {faq.question}
                  </dt>
                  <dd className="mt-3 text-base leading-8 text-forest/70">
                    {faq.answer}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="mt-14 border-t border-forest/10 pt-10">
            <h2 className="font-display text-3xl font-semibold text-forest">
              Related free resources
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                { href: "/obituary-templates", label: "Obituary templates" },
                {
                  href: "/order-of-service-templates",
                  label: "Order of service templates",
                },
                {
                  href: "/resources/celebration-of-life-program-examples",
                  label: "Celebration of life examples",
                },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-2xl border border-forest/10 bg-paper p-5 text-sm font-semibold leading-6 text-forest transition hover:-translate-y-0.5 hover:border-sage"
                >
                  {link.label}
                  <ArrowRight className="mt-3 text-gold" size={15} />
                </Link>
              ))}
            </div>
          </section>
        </div>
        <ResourceFooter />
      </main>
    </>
  );
}
