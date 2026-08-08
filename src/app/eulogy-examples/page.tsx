import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { GrowthPageView } from "@/components/growth-page-view";
import { ResourceFooter, ResourceHeader } from "@/components/resource-guide";
import { EULOGY_STRUCTURE, eulogyTemplates } from "@/lib/eulogy-templates";
import { TEMPLATE_UPDATED } from "@/lib/obituary-templates";

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://tributeready.org";

const TITLE = "Eulogy Examples and a Structure That Works";
const DESCRIPTION =
  "Complete example eulogies for a mother, father, grandparent, sibling, and friend, with a five-part structure, opening lines, and practical advice on delivering it.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/eulogy-examples" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/eulogy-examples",
    siteName: "TributeReady",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

const MISTAKES = [
  {
    title: "Starting with \"I have been asked to say a few words\"",
    fix: "Start inside a scene instead. A specific moment in the first sentence buys you the room's attention for the next four minutes.",
  },
  {
    title: "Listing qualities instead of proving them",
    fix: "\"She was generous\" is forgettable. \"She kept a drawer of candy and five-dollar bills for the grandchildren, restocked before every visit\" is not. Details survive; adjectives do not.",
  },
  {
    title: "Trying to cover the whole life",
    fix: "The obituary is the record. The eulogy is one true version. Choose a single thread and follow it.",
  },
  {
    title: "Writing a flawless person",
    fix: "One affectionate flaw makes the rest believable. Rooms relax the moment they recognize the real person.",
  },
  {
    title: "Going long",
    fix: "Past six minutes, attention drops and the closing loses its force. Time yourself out loud, not on the page.",
  },
  {
    title: "Having no backup",
    fix: "Give a printed copy to someone in the front row and agree they will finish if you cannot. Officiants expect this.",
  },
];

const FAQS = [
  {
    question: "How long should a eulogy be?",
    answer:
      "Three to five minutes, which is about four hundred to seven hundred spoken words at a normal pace. Some services allow up to seven minutes for a single main eulogy. Ask the officiant for your limit before you write, particularly when several people are speaking.",
  },
  {
    question: "How many words is a five-minute eulogy?",
    answer:
      "Roughly 650 words. Most people speak at about 130 words a minute, and grief tends to slow that down rather than speed it up. Read your draft aloud with a timer rather than trusting a word count.",
  },
  {
    question: "Who normally gives the eulogy?",
    answer:
      "Most often an adult child, a sibling, a grandchild, or a close friend. Some families ask the officiant to deliver it on their behalf, which is entirely normal. The only real requirement is that the person can get through it, so choose someone one step removed from the deepest grief if you can.",
  },
  {
    question: "Can more than one person speak?",
    answer:
      "Yes, and it is common to have one main eulogy plus one or two short reflections. Agree in advance on who covers which stories, or you will get the same anecdote three times. Watch the total speaking time.",
  },
  {
    question: "What if I break down while speaking?",
    answer:
      "Stop, breathe, drink some water, and continue. Everyone in the room understands. Arrange beforehand for someone in the front row to hold a copy and finish if you need them to, and tell yourself in advance that using that backup is a perfectly good outcome.",
  },
];

export default function EulogyHub() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: TITLE,
      description: DESCRIPTION,
      url: `${SITE_URL}/eulogy-examples`,
      isAccessibleForFree: true,
      dateModified: TEMPLATE_UPDATED,
      publisher: {
        "@type": "Organization",
        name: "TributeReady",
        url: SITE_URL,
      },
      mainEntity: {
        "@type": "ItemList",
        itemListElement: eulogyTemplates.map((template, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: template.shortTitle,
          url: `${SITE_URL}/eulogy-examples/${template.slug}`,
        })),
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

  return (
    <>
      <GrowthPageView page="eulogy_examples" />
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
              Complete examples · free, no sign-up
            </p>
            <h1 className="mt-4 max-w-3xl font-display text-5xl font-semibold leading-[0.95] tracking-[-0.02em] text-forest sm:text-7xl">
              Eulogy examples, written to be said out loud
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-forest/65 sm:text-lg">
              Full eulogies rather than fragments, each one timed for delivery,
              with the structure underneath them made explicit and honest advice
              about getting through it on the day.
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8 lg:py-16">
          <section id="examples">
            <h2 className="font-display text-4xl font-semibold leading-tight text-forest">
              Examples by relationship
            </h2>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {eulogyTemplates.map((template) => (
                <Link
                  key={template.slug}
                  href={`/eulogy-examples/${template.slug}`}
                  className="group rounded-2xl border border-forest/10 bg-paper p-6 transition hover:-translate-y-0.5 hover:border-sage"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
                    For a {template.relationship}
                  </p>
                  <p className="mt-3 font-display text-2xl font-semibold leading-tight text-forest">
                    {template.shortTitle}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-forest/60">
                    Full example, {template.example.minutes.toLowerCase()}, plus
                    four openings and delivery notes.
                  </p>
                  <ArrowRight className="mt-4 text-gold" size={16} />
                </Link>
              ))}
            </div>
          </section>

          <section id="structure" className="mt-16">
            <h2 className="font-display text-4xl font-semibold leading-tight text-forest">
              The five-part structure
            </h2>
            <p className="mt-4 text-base leading-8 text-forest/70">
              Nearly every eulogy that works follows this shape. Written out, it
              takes about three and a half minutes to deliver.
            </p>
            <ol className="mt-7 space-y-4">
              {EULOGY_STRUCTURE.map((part, index) => (
                <li
                  key={part.part}
                  className="rounded-2xl border border-forest/10 bg-paper p-6"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <p className="font-display text-2xl font-semibold text-forest">
                      <span className="mr-3 text-base font-bold text-gold">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {part.part}
                    </p>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-forest/45">
                      {part.seconds}
                    </p>
                  </div>
                  <p className="mt-3 text-base leading-7 text-forest/70">
                    {part.detail}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <section id="mistakes" className="mt-16">
            <h2 className="font-display text-4xl font-semibold leading-tight text-forest">
              Six mistakes worth avoiding
            </h2>
            <div className="mt-7 space-y-4">
              {MISTAKES.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-forest/10 bg-paper p-6"
                >
                  <p className="font-display text-2xl font-semibold leading-tight text-forest">
                    {item.title}
                  </p>
                  <p className="mt-3 text-base leading-7 text-forest/70">
                    {item.fix}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-16 rounded-[2rem] bg-forest p-8 text-white sm:p-10">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#d8c08e]">
              For the printed service
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold">
              The program that goes with the eulogy
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-white/65">
              These examples stay free. If you also need the printed pieces,
              TributeReady drafts the tribute with you, lets you edit every
              line, and produces a print-ready program, keepsake, and thank-you
              card for a one-time $34.99.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/#create"
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-forest"
              >
                Start a draft for free <ArrowRight size={15} />
              </Link>
              <Link
                href="/api/sample"
                className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3.5 text-sm font-bold text-white"
              >
                See a sample PDF
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
                  href: "/funeral-readings",
                  label: "Funeral poems and readings",
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
