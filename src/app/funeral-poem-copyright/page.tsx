import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { GrowthPageView } from "@/components/growth-page-view";
import { ResourceFooter, ResourceHeader } from "@/components/resource-guide";
import {
  carefulPublisher,
  enginesUnavailable,
  STUDY_DATE,
  studyDomains,
  studyExcluded,
  studyFindings,
  studyLimitations,
  studyMethod,
  studyWorks,
} from "@/lib/poem-copyright-study";

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://tributeready.org";

const TITLE =
  "Most Funeral Poem Lists Publish Copyrighted Work: A Study of 13 Top-Ranking Pages";
const DESCRIPTION =
  "We checked the funeral poem pages families actually find. Eleven of thirteen reproduced work that is in copyright or of disputed status, and one stated the public-domain status of anything. Full sample and method published.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/funeral-poem-copyright" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/funeral-poem-copyright",
    siteName: "TributeReady",
    type: "article",
    publishedTime: STUDY_DATE,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

const FAQS = [
  {
    question: "Is it illegal to print a poem in a funeral program?",
    answer:
      "It depends entirely on the poem. Reproducing a work that is in the public domain is unrestricted. Reproducing a work still in copyright without permission is an infringement, even in a small, non-commercial print run handed out at a service. Reading a work aloud at a private gathering is treated differently from reproducing its text.",
  },
  {
    question: "How can a family check a poem before printing it?",
    answer:
      "Find the year of first publication and the author's death date. In the United States, anything first published in 1930 or earlier is in the public domain. Elsewhere the common rule is the author's life plus seventy years. If the poem circulates online with no author credit, treat that as a warning sign rather than as evidence that it is free, because uncredited circulation is exactly how modern poems end up presumed to be anonymous.",
  },
  {
    question: "What should a funeral home do about this?",
    answer:
      "Most exposure comes from template libraries and printed programs that reproduce whatever families request. A short internal list of verified public-domain readings, offered to families as the default, removes almost all of the risk and takes very little effort to maintain.",
  },
  {
    question: "Can we cite this study?",
    answer:
      "Yes. The methodology, the sample size, and the limitations are stated on this page so that the finding can be checked. Please link to this page so readers can see how the sample was constructed and what it does not establish.",
  },
];

export default function PoemCopyrightStudy() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: TITLE,
      description: DESCRIPTION,
      datePublished: STUDY_DATE,
      dateModified: STUDY_DATE,
      isAccessibleForFree: true,
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": `${SITE_URL}/funeral-poem-copyright`,
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
  ];

  const formattedDate = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${STUDY_DATE}T00:00:00Z`));

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
              <span aria-hidden="true" className="mx-2">
                /
              </span>
              <Link href="/funeral-readings" className="hover:text-forest">
                Funeral readings
              </Link>
            </nav>
            <p className="mt-10 text-[10px] font-bold uppercase tracking-[0.24em] text-gold">
              Original research
            </p>
            <h1 className="mt-4 max-w-3xl font-display text-5xl font-semibold leading-[0.95] tracking-[-0.02em] text-forest sm:text-6xl">
              Most funeral poem lists publish work they probably cannot publish
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-forest/65 sm:text-lg">
              Families searching for a funeral reading land on a small set of
              pages. We checked what those pages actually reproduce. Of the
              thirteen we could analyze, eleven published work that is in
              copyright or of disputed status, and one stated the public-domain
              status of anything at all. The full list of pages is published
              below so the count can be checked.
            </p>
            <p className="mt-8 text-xs font-semibold text-forest/50">
              Published {formattedDate} · Methodology and limitations below
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8 lg:py-16">
          <section>
            <div className="grid gap-4 sm:grid-cols-2">
              {studyFindings.map((finding) => (
                <div
                  key={finding.label}
                  className="rounded-2xl border border-forest/10 bg-paper p-6"
                >
                  <p className="font-display text-5xl font-semibold leading-none text-forest">
                    {finding.stat}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-forest/65">
                    {finding.label}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section id="why" className="mt-16">
            <h2 className="font-display text-4xl font-semibold leading-tight text-forest">
              Why this matters to a family
            </h2>
            <div className="mt-5 space-y-4 text-base leading-8 text-forest/70">
              <p>
                A funeral program is a reproduction. When a family copies a poem
                from a website into a program and prints two hundred copies,
                they have republished it, and the fact that the printing was
                small, unpaid, and grief-stricken does not change that.
              </p>
              <p>
                In practice, families almost never face consequences. The people
                who do are the ones printing at scale: funeral homes, print
                shops, template sellers, and stationery businesses. At least one
                frequently requested modern poem has a rights holder with a
                documented history of pursuing unlicensed use.
              </p>
              <p>
                The deeper problem is that families cannot tell the difference.
                A poem published online with no author credit looks free. Very
                often it is not free; it is simply uncredited, and the missing
                credit is what makes it look safe.
              </p>
            </div>
          </section>

          <section id="works" className="mt-16">
            <h2 className="font-display text-4xl font-semibold leading-tight text-forest">
              What was being reproduced
            </h2>
            <p className="mt-4 text-base leading-8 text-forest/70">
              Ordered by how many of the thirteen pages carried at least one
              identifying line of each work. The second figure counts pages
              reproducing at least seventy percent of its lines.
            </p>
            <div className="mt-7 space-y-4">
              {studyWorks.map((work) => (
                <div
                  key={work.title}
                  className="rounded-2xl border border-forest/10 bg-paper p-6"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <p className="font-display text-2xl font-semibold leading-tight text-forest">
                      {work.title}
                    </p>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-gold">
                      {work.pages} of 13 · {work.fullText} in full
                    </p>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-forest/55">
                    {work.author}
                  </p>
                  <p className="mt-3 text-base leading-7 text-forest/70">
                    {work.status}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section id="sample" className="mt-16">
            <h2 className="font-display text-4xl font-semibold leading-tight text-forest">
              The pages analysed
            </h2>
            <p className="mt-4 text-base leading-8 text-forest/70">
              Published in full so that anyone can repeat the count. Listed
              alphabetically, not in ranking order. The complete dataset,
              including per-page line-coverage figures and every search engine
              attempt,{" "}
              <a
                href="/funeral-poem-copyright-study.json"
                className="font-semibold text-forest underline decoration-sage underline-offset-4"
              >
                is available as JSON
              </a>
              . Verbatim lines of the poems are withheld from it, because
              republishing them is the practice this study measures.
            </p>
            <ul className="mt-6 grid gap-2 sm:grid-cols-2">
              {[...studyDomains].sort().map((domain) => (
                <li
                  key={domain}
                  className="rounded-xl border border-forest/10 bg-paper px-4 py-3 text-sm font-semibold text-forest/75"
                >
                  {domain}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-base leading-8 text-forest/70">
              Two further domains were found but could not be analysed, and are
              excluded from every figure on this page:
            </p>
            <ul className="mt-4 space-y-3">
              {studyExcluded.map((item) => (
                <li
                  key={item.domain}
                  className="rounded-xl border border-forest/10 bg-paper px-4 py-3 text-sm leading-6 text-forest/70"
                >
                  <span className="font-semibold text-forest">
                    {item.domain}
                  </span>{" "}
                  — {item.reason}
                </li>
              ))}
            </ul>
          </section>

          <section id="careful" className="mt-16 rounded-[2rem] border border-sage/40 bg-mist/40 p-8 sm:p-10">
            <h2 className="font-display text-4xl font-semibold leading-tight text-forest">
              One page did it properly
            </h2>
            <p className="mt-4 text-base leading-8 text-forest/70">
              <span className="font-semibold text-forest">
                {carefulPublisher.domain}
              </span>{" "}
              {carefulPublisher.detail}
            </p>
          </section>

          <section id="method" className="mt-16">
            <h2 className="font-display text-4xl font-semibold leading-tight text-forest">
              How this was done
            </h2>
            <div className="mt-5 space-y-4 text-base leading-8 text-forest/70">
              <p>
                On {formattedDate} we collected the top ten organic results for{" "}
                {studyMethod.queries.map((q) => `"${q}"`).join(" and ")} from{" "}
                {studyMethod.engine} and deduplicated by registrable domain,
                producing {studyMethod.hostsFound} unique publishers.{" "}
                {studyMethod.excluded} could not be analysed, leaving{" "}
                {studyMethod.analyzed} pages.
              </p>
              <p>
                {studyMethod.engine} was used because every other engine we
                tried refused automated access that day:{" "}
                {enginesUnavailable.map((e) => e.engine).join(", ")}. We did not
                attempt to defeat any anti-bot measure. This matters when reading
                the result, because the choice of engine determines the sample.
              </p>
              <p>
                Each page was fetched and reduced to plain text. We then measured
                how many lines of eleven works that are in copyright or of
                disputed status appeared on it, counting a work as reproduced in
                full at seventy percent line coverage or above. A bare title, or
                a note telling readers where a poem can be found, is not counted
                as reproduction. That distinction matters: for five of these
                eleven works the title is also the opening line, so a simpler
                rule would score a page that merely names a poem as though it had
                published it.
              </p>
              <p>
                The full-text figure is not sensitive to where that line is
                drawn. It holds at eight of thirteen at every coverage threshold
                from sixty to ninety percent.
              </p>
              <p>
                Separately we recorded whether the page stated public-domain
                status anywhere, and whether any permission or licence statement
                appeared beside a reproduced modern poem.
              </p>
            </div>
          </section>

          <section id="limitations" className="mt-16">
            <h2 className="font-display text-4xl font-semibold leading-tight text-forest">
              What this does not establish
            </h2>
            <ul className="mt-6 space-y-3">
              {studyLimitations.map((item) => (
                <li
                  key={item}
                  className="flex gap-3 text-base leading-7 text-forest/70"
                >
                  <span
                    aria-hidden="true"
                    className="mt-2.5 size-1.5 shrink-0 rounded-full bg-sage"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-16 rounded-[2rem] border border-forest/10 bg-paper p-8 sm:p-10">
            <h2 className="font-display text-4xl font-semibold leading-tight text-forest">
              What we did about it
            </h2>
            <p className="mt-4 text-base leading-8 text-forest/70">
              We publish our own list of funeral readings, so the honest
              response was to hold it to the standard this study measures. Every
              poem and passage on it carries its publication year, a link to the
              source text, and a plain statement of why it is free to print. The
              same page names the frequently requested readings that are not
              free to print, including several found repeatedly in this study.
            </p>
            <Link
              href="/funeral-readings"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-forest px-6 py-3.5 text-sm font-bold text-white"
            >
              See the verified readings <ArrowRight size={15} />
            </Link>
          </section>

          <section id="faq" className="mt-16">
            <h2 className="font-display text-4xl font-semibold leading-tight text-forest">
              Questions
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

          <section className="mt-12 rounded-2xl border border-forest/10 bg-mist/50 p-6 text-sm leading-6 text-forest/65">
            <h2 className="font-semibold text-forest">
              Citation and corrections
            </h2>
            <p className="mt-2">
              Cite as: TributeReady, &ldquo;Most funeral poem lists publish work
              they probably cannot publish,&rdquo; {formattedDate}, sample of{" "}
              {studyMethod.analyzed} pages from {studyMethod.engine},
              tributeready.org/funeral-poem-copyright. This page describes
              publishing practice in aggregate and does not accuse any
              individual publisher of infringement. If you publish one of the
              pages analyzed and hold a licence, or if you believe a work is
              categorized incorrectly, write to care@tributeready.org and we
              will correct the page.
            </p>
          </section>
        </div>
        <ResourceFooter />
      </main>
    </>
  );
}
