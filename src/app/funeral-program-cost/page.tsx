import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { GrowthPageView } from "@/components/growth-page-view";
import { ResourceFooter, ResourceHeader } from "@/components/resource-guide";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://tributeready.org";
const CHECKED = "2026-08-07";

const TITLE = "Funeral Program Cost: What You Actually Pay For";
const DESCRIPTION =
  "What drives the cost of funeral programs, how funeral-home stationery charges differ from printing it yourself, and how to keep the bill sensible without inventing prices.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/funeral-program-cost" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/funeral-program-cost",
    siteName: "TributeReady",
    type: "article",
  },
};

const CHECKED_ON = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
}).format(new Date(`${CHECKED}T00:00:00Z`));

const COST_DRIVERS = [
  {
    title: "Who designs it",
    copy: "This is usually the largest hidden cost. A funeral home may design the program as part of a stationery package, a local printer may charge a setup fee, or someone in the family may spend an evening in Word or Canva. Paid online makers charge for the finished files. The design step is separate from the cost of the paper itself.",
  },
  {
    title: "How many copies",
    copy: "Programs are almost always priced by quantity. A small family gathering needs far fewer than a large church service. Order for the people expected in the room, plus a modest spare stack for those who could not travel and for the guestbook table. Leftovers are kinder than running out mid-service.",
  },
  {
    title: "Color, paper, and finishing",
    copy: "Black-and-white on ordinary letter paper is the least expensive. Color ink, heavier stock, and a folding finish each add cost at a print counter. A standard four-panel program is a folded letter sheet, not a bound booklet — ask for document or copy printing with folding, not booklet printing.",
  },
  {
    title: "Rush",
    copy: "Same-day and express pickup often carry a surcharge, and some counters only guarantee rush on limited quantities. If the service is tomorrow, call the counter before you drive over. Cutoffs and product names are covered in our printing guide.",
  },
  {
    title: "Whether stationery is itemized on the funeral bill",
    copy: "Some funeral homes include a basic program in a package. Others itemize memorial stationery separately — often as a package of programs, prayer cards, or thank-you notes. Ask for a line-item explanation before assuming the charge is for printing alone. You are allowed to supply your own printed programs.",
  },
];

const PATHS = [
  {
    title: "Funeral-home stationery",
    points: [
      "Convenient when staff already have the service details",
      "May be bundled or itemized — ask which",
      "Revisions can take a phone call and another proof cycle",
      "You can usually decline and bring your own printed copies",
    ],
  },
  {
    title: "Print it yourself from a finished file",
    points: [
      "You control wording, photo, and quantity",
      "Take a PDF to a staffed print counter for same-day copies",
      "Cost is mainly per-page printing, paper, and folding",
      "No per-copy licence fee if the file is yours to reprint",
    ],
  },
  {
    title: "Blank template you fill in",
    points: [
      "Free Word and Google Docs templates exist for this",
      "You still write every word and fix the layout yourself",
      "Good when someone in the family already knows Word",
      "The hard part is usually the writing, not the file format",
    ],
  },
];

const QUESTIONS = [
  {
    question: "How much do funeral programs cost?",
    answer:
      "There is no single price. The bill depends on who designs the program, how many copies you need, whether you print in color, what paper you choose, and whether a funeral home is itemizing stationery on your contract. Ask for a line-item quote from the funeral home or a per-page quote from a print counter rather than relying on a round number from the internet.",
  },
  {
    question: "Is it cheaper to print funeral programs myself?",
    answer:
      "Often yes for the printing step alone, especially at a staffed copy counter with a PDF you already have. The comparison changes if you value the funeral home’s design help, or if no one in the family can finish a layout before the service. Cheap printing with a rushed, error-filled program is not a saving.",
  },
  {
    question: "Can I bring my own programs to the funeral home?",
    answer:
      "Usually yes. Most funeral homes will place family-provided programs on the table or in the pews. Tell them ahead of time so they do not print a duplicate set you will be charged for.",
  },
  {
    question: "What is the difference between design cost and printing cost?",
    answer:
      "Design is the work of writing, laying out, and proofing the program. Printing is the paper, ink, and folding. Online tools and templates address design. Print counters and funeral-home stationery packages address printing — and sometimes both.",
  },
  {
    question: "How many funeral programs should I order?",
    answer:
      "Order for the number of people expected to attend, then add a small buffer for late arrivals and relatives who could not travel. A spare dozen is usually enough for a modest service; a large church funeral may want more. It is better to ask the funeral director for a headcount estimate than to guess from the parking lot.",
  },
];

const RELATED = [
  {
    href: "/where-to-print-funeral-programs",
    title: "Where to print funeral programs",
    copy: "Same-day counters, what file to bring, and which product to ask for.",
  },
  {
    href: "/funeral-program-template-word",
    title: "Free Word templates",
    copy: "Editable bifold and single-sheet files with no signup.",
  },
  {
    href: "/funeral-program-maker",
    title: "Funeral program maker",
    copy: "Guided writing and a print-ready collection when you want the assembly done.",
  },
  {
    href: "/resources/what-to-include-in-a-funeral-program",
    title: "What to include in a funeral program",
    copy: "The panels, the order of service, and what to leave out.",
  },
];

export default function FuneralProgramCostPage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: TITLE,
      description: DESCRIPTION,
      dateModified: CHECKED,
      author: { "@type": "Organization", name: "TributeReady" },
      publisher: { "@type": "Organization", name: "TributeReady", url: SITE_URL },
      mainEntityOfPage: `${SITE_URL}/funeral-program-cost`,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        {
          "@type": "ListItem",
          position: 2,
          name: "Funeral program cost",
          item: `${SITE_URL}/funeral-program-cost`,
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
      <GrowthPageView page="funeral_program_cost" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <ResourceHeader />

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-12">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-forest/50">
          Cost guide
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-forest sm:text-5xl">
          Funeral program cost
        </h1>
        <p className="mt-6 text-lg leading-8 text-forest/75">
          Families ask this when a funeral estimate arrives with a stationery
          line, or when someone volunteers to “just print a few programs” and
          then discovers the evening will disappear into layout software. The
          honest answer is that there is no single funeral-program price,
          because the bill is a stack of separate choices.
        </p>

        <p className="mt-7 border-l-2 border-sage bg-mist/60 px-5 py-4 text-sm leading-6 text-forest/70">
          <strong className="text-forest">
            No invented retail prices appear on this page.
          </strong>{" "}
          Print-counter rates change by store and by week, and a stale number
          would be worse than none. Ask the counter or the funeral home for a
          quote. Our own digital collection price ($34.99) is stated plainly
          below because it is ours. Reviewed {CHECKED_ON}.
        </p>

        <section className="mt-16">
          <h2 className="font-display text-3xl font-semibold text-forest">
            The short answer
          </h2>
          <div className="mt-5 space-y-4 text-base leading-8 text-forest/80">
            <p>
              You pay for two different jobs: getting the words and layout
              finished, and getting paper copies into people&apos;s hands. A
              funeral home may charge for both as memorial stationery. A print
              counter usually charges only for the second job, and only after
              you hand them a finished file. A free template leaves both jobs
              with the family. An online maker charges for the finished file;
              printing remains yours to arrange.
            </p>
            <p>
              TributeReady&apos;s print-ready memorial collection is{" "}
              <strong className="text-forest">$34.99</strong> for the digital
              files — program, keepsake card, thank-you card, and private
              memorial page. That is a design-and-assembly price, not a
              printing price. Copies are yours to print at home or at any
              counter, with no per-copy fee from us.
            </p>
          </div>
        </section>

        <section className="mt-16">
          <h2 className="font-display text-3xl font-semibold text-forest">
            What drives the cost
          </h2>
          <ul className="mt-6 space-y-4">
            {COST_DRIVERS.map((item) => (
              <li
                key={item.title}
                className="rounded-2xl border border-forest/10 bg-white p-5"
              >
                <h3 className="font-semibold text-forest">{item.title}</h3>
                <p className="mt-2 text-sm leading-7 text-forest/75">
                  {item.copy}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-16">
          <h2 className="font-display text-3xl font-semibold text-forest">
            Three common paths
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {PATHS.map((path) => (
              <div
                key={path.title}
                className="rounded-2xl border border-forest/10 bg-white p-5"
              >
                <h3 className="font-semibold text-forest">{path.title}</h3>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-forest/75">
                  {path.points.map((point) => (
                    <li key={point}>• {point}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="font-display text-3xl font-semibold text-forest">
            How to keep the bill sensible
          </h2>
          <ol className="mt-5 list-decimal space-y-3 pl-5 text-base leading-8 text-forest/80">
            <li>
              Ask the funeral home whether programs are included, optional, or
              already on the estimate. If they are optional, say you may supply
              your own before they print a set.
            </li>
            <li>
              Finish the wording before you touch layout. Most expensive
              reprints come from a misspelled name or a missing relative, not
              from the paper stock.
            </li>
            <li>
              Print a single proof copy and read it on paper. Screens hide
              spacing problems that a folded sheet will show immediately.
            </li>
            <li>
              Take a PDF to a staffed print counter and ask for document
              printing with a folding finish. Details are on{" "}
              <Link
                href="/where-to-print-funeral-programs"
                className="font-semibold text-forest underline underline-offset-4"
              >
                where to print funeral programs
              </Link>
              .
            </li>
            <li>
              If nobody in the family can face Word tonight, pay for assembly
              once and print the file as many times as you need. That is the
              job our{" "}
              <Link
                href="/funeral-program-maker"
                className="font-semibold text-forest underline underline-offset-4"
              >
                funeral program maker
              </Link>{" "}
              is built for.
            </li>
          </ol>
        </section>

        <section className="mt-16 rounded-3xl bg-forest px-6 py-8 text-cream sm:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d8c08e]">
            If you want the writing and layout handled
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold">
            $34.99 for the finished files
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-8 text-cream/75">
            You answer a few questions, edit every line, and receive a
            print-ready program plus matching cards and a private memorial
            page. Printing stays with you — at home or at any counter — with no
            per-copy charge from us.
          </p>
          <Link
            href="/#create"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-cream px-5 py-3 text-sm font-semibold text-forest"
          >
            Start a program <ArrowRight size={16} />
          </Link>
        </section>

        <section className="mt-16">
          <h2 className="font-display text-3xl font-semibold text-forest">
            Questions families ask
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
