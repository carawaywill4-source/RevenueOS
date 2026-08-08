import type { Metadata } from "next";
import { ArrowRight, Download } from "lucide-react";
import Link from "next/link";
import { GrowthPageView } from "@/components/growth-page-view";
import { ResourceFooter, ResourceHeader } from "@/components/resource-guide";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://tributeready.org";
const UPDATED = "2026-08-07";

const TITLE = "Funeral Program Examples (Annotated Sample Layouts)";
const DESCRIPTION =
  "Annotated funeral program examples showing what belongs on each panel, with a fictional sample PDF you can open. Use them as structure, not as wording to copy.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/funeral-program-examples" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/funeral-program-examples",
    siteName: "TributeReady",
    type: "article",
  },
};

const PANELS = [
  {
    title: "Front cover",
    points: [
      "Full name as the family uses it",
      "Years, or birth and death dates if you choose to publish them",
      "A photograph only if the family wants one",
      "A short opening line — specific, not a stock phrase",
      "Service title if there is one (funeral, memorial, celebration of life)",
    ],
  },
  {
    title: "Inside left — gratitude or welcome",
    points: [
      "A short thank-you for those attending",
      "Optional acknowledgments to caregivers, clergy, or friends",
      "Keep this panel brief so the facing page can hold the order of service",
    ],
  },
  {
    title: "Inside right — order of service",
    points: [
      "Date, time, and place near the top",
      "The sequence guests will follow, in plain language",
      "Names of speakers or musicians only when confirmed",
      "A reading title, not a long copyrighted poem unless you have rights",
    ],
  },
  {
    title: "Back cover — life note and practical details",
    points: [
      "A short life paragraph or remembrance",
      "Surviving family only if it fits without crowding",
      "Reception details, livestream link, or donation request if needed",
      "Nothing that helps a burglar during the service — no home address",
    ],
  },
];

const EXAMPLES = [
  {
    title: "Traditional funeral bifold",
    setting: "Church or funeral-home chapel, seated service with an order of worship",
    why: "Guests need the sequence in front of them. The cover stays quiet; the inside carries timing and speakers.",
    sample: [
      "Cover: name, years, one line that sounds like them",
      "Inside: welcome, hymn or reading, remembrances, committal note",
      "Back: short life note, surviving family, reception afterward",
    ],
  },
  {
    title: "Celebration-of-life program",
    setting: "Garden, community hall, or home — less formal, still needs a shared plan",
    why: "The order can be looser, but people still want to know when to speak, when music starts, and where to gather after.",
    sample: [
      "Cover: name, “A celebration of life,” date",
      "Inside: welcome, shared stories, favorite music, closing gratitude",
      "Back: how the family wants to be remembered — a walk, a donation, a song",
    ],
  },
  {
    title: "Memorial service without a casket present",
    setting: "Weeks after the death, often when travel delayed the gathering",
    why: "The program still orients guests. Service language should match what is actually happening — memorial, not funeral — so no one is surprised.",
    sample: [
      "Cover: name and “In memoriam” or “Memorial service”",
      "Inside: welcome, readings, remembrances, music",
      "Back: a fuller life note; private burial already held can be stated plainly",
    ],
  },
];

const QUESTIONS = [
  {
    question: "What does a funeral program look like?",
    answer:
      "Most family-printed programs are a single US Letter sheet printed on both sides and folded once, making four panels about 5.5 by 8.5 inches. That is a bifold. Longer booklets exist, but they take longer to print and cost more.",
  },
  {
    question: "Can I copy these examples word for word?",
    answer:
      "No. The sample person is fictional, and the layouts are models for structure. Replace every line with details that belong to the person you are remembering. Copied praise reads as empty because it is.",
  },
  {
    question: "Where can I see a finished sample PDF?",
    answer:
      "Open the fictional TributeReady sample linked on this page. It is a complete bifold collection for an invented person, labeled as a sample so it is never mistaken for a customer review.",
  },
  {
    question: "What size should a funeral program be?",
    answer:
      "The most common DIY size in the US is a letter sheet folded to 5.5 by 8.5 inches. Ask your print counter for document printing with a folding finish. Booklet printing is usually the wrong product for a four-panel program.",
  },
];

const RELATED = [
  {
    href: "/funeral-program-maker",
    title: "Funeral program maker",
    copy: "Guided writing and a print-ready collection when you want the assembly done.",
  },
  {
    href: "/funeral-program-template-word",
    title: "Free Word templates",
    copy: "Editable bifold and single-sheet files with no signup.",
  },
  {
    href: "/funeral-program-cost",
    title: "Funeral program cost",
    copy: "What drives the bill — design, copies, paper, rush — without invented prices.",
  },
  {
    href: "/where-to-print-funeral-programs",
    title: "Where to print",
    copy: "Same-day counters, cutoffs, and which product to ask for.",
  },
];

export default function FuneralProgramExamplesPage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: TITLE,
      description: DESCRIPTION,
      dateModified: UPDATED,
      author: { "@type": "Organization", name: "TributeReady" },
      publisher: { "@type": "Organization", name: "TributeReady", url: SITE_URL },
      mainEntityOfPage: `${SITE_URL}/funeral-program-examples`,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        {
          "@type": "ListItem",
          position: 2,
          name: "Funeral program examples",
          item: `${SITE_URL}/funeral-program-examples`,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: QUESTIONS.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
  ];

  return (
    <div className="bg-paper">
      <GrowthPageView page="funeral_program_examples" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <ResourceHeader />

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-12">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-forest/50">
          Examples
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-forest sm:text-5xl">
          Funeral program examples
        </h1>
        <p className="mt-6 text-lg leading-8 text-forest/75">
          These examples show structure, not scripts. Borrow the panel layout and
          the order of information, then replace every sentence with details that
          belong to the person you are remembering. All names below are fictional.
        </p>

        <p className="mt-7 border-l-2 border-sage bg-mist/60 px-5 py-4 text-sm leading-6 text-forest/70">
          <strong className="text-forest">Open a finished fictional sample.</strong>{" "}
          The PDF is a complete bifold collection for Eleanor Rose Bennett, an
          invented person. It is labeled as a sample so it cannot be mistaken for
          a customer story.
          <a
            href="/api/sample"
            className="mt-3 inline-flex items-center gap-2 font-semibold text-forest underline underline-offset-4"
          >
            <Download size={14} /> View sample PDF
          </a>
        </p>

        <section className="mt-16">
          <h2 className="font-display text-3xl font-semibold text-forest">
            What each panel is for
          </h2>
          <ul className="mt-6 space-y-4">
            {PANELS.map((panel) => (
              <li
                key={panel.title}
                className="rounded-2xl border border-forest/10 bg-white p-5"
              >
                <h3 className="font-semibold text-forest">{panel.title}</h3>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-forest/75">
                  {panel.points.map((point) => (
                    <li key={point}>• {point}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-16">
          <h2 className="font-display text-3xl font-semibold text-forest">
            Three common program shapes
          </h2>
          <div className="mt-6 space-y-4">
            {EXAMPLES.map((example) => (
              <article
                key={example.title}
                className="rounded-2xl border border-forest/10 bg-white p-5"
              >
                <h3 className="font-semibold text-forest">{example.title}</h3>
                <p className="mt-2 text-sm leading-7 text-forest/70">
                  <span className="font-semibold text-forest">Setting: </span>
                  {example.setting}
                </p>
                <p className="mt-2 text-sm leading-7 text-forest/70">
                  <span className="font-semibold text-forest">Why this shape: </span>
                  {example.why}
                </p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-forest/75">
                  {example.sample.map((line) => (
                    <li key={line}>• {line}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-16 rounded-3xl bg-forest px-6 py-8 text-cream sm:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d8c08e]">
            From example to finished file
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold">
            Write theirs, not Eleanor&apos;s
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-8 text-cream/75">
            Use a free Word template if you want to type into a blank layout, or
            start the guided maker if you want help turning memories into wording
            you can edit before you pay.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/#create"
              className="inline-flex items-center gap-2 rounded-full bg-cream px-5 py-3 text-sm font-semibold text-forest"
            >
              Start a program <ArrowRight size={16} />
            </Link>
            <Link
              href="/funeral-program-template-word"
              className="inline-flex items-center gap-2 rounded-full border border-cream/30 px-5 py-3 text-sm font-semibold text-cream"
            >
              Free Word template
            </Link>
          </div>
        </section>

        <section className="mt-16">
          <h2 className="font-display text-3xl font-semibold text-forest">
            Questions
          </h2>
          <dl className="mt-6 space-y-4">
            {QUESTIONS.map((item) => (
              <div
                key={item.question}
                className="rounded-2xl border border-forest/10 bg-white p-5"
              >
                <dt className="font-semibold text-forest">{item.question}</dt>
                <dd className="mt-2 text-sm leading-7 text-forest/75">
                  {item.answer}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-16">
          <h2 className="font-display text-3xl font-semibold text-forest">
            Related
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {RELATED.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded-2xl border border-forest/10 bg-white p-5 transition hover:border-forest/25"
                >
                  <p className="font-semibold text-forest">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-forest/70">
                    {item.copy}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <ResourceFooter />
    </div>
  );
}
