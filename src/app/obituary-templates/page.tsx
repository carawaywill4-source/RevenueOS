import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { CopyTextButton } from "@/components/copy-text-button";
import { GrowthPageView } from "@/components/growth-page-view";
import { ResourceFooter, ResourceHeader } from "@/components/resource-guide";
import { obituaryTemplates, TEMPLATE_UPDATED } from "@/lib/obituary-templates";

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://tributeready.org";

const TITLE = "Free Obituary Templates and Examples for Every Relationship";
const DESCRIPTION =
  "Free fill-in-the-blank obituary templates for a mother, father, grandparent, spouse, child, or sibling, with completed examples, wording help, and no sign-up.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/obituary-templates" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/obituary-templates",
    siteName: "TributeReady",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

const UNIVERSAL_TEMPLATE = [
  "[Full name, including maiden name or nickname], [age], of [city, state], died on [date of death] [optional: at home / after a long illness / unexpectedly].",
  "[He/She/They] was born on [birth date] in [birthplace] to [parents' names]. [Education, military service, or training.] [Work or occupation, and for how long.]",
  "[Marriage: name, date, and number of years. Note if the spouse died earlier.]",
  "[One paragraph about who they actually were: what they did with their time, what they were known for, one concrete habit or saying.]",
  "[He/She/They] is survived by [spouse]; [children and their spouses]; [number] grandchildren; and [siblings]. [He/She/They] was preceded in death by [names and relationships].",
  "A [funeral service / memorial service / celebration of life] will be held on [date] at [time] at [location]. [Visitation details.] In lieu of flowers, donations may be made to [organization].",
];

const LENGTH_GUIDE = [
  {
    label: "Newspaper notice",
    range: "75 to 200 words",
    note: "Most papers charge by the line or column inch, so families cut personality first. Keep the announcement, the family list, and the service details, and add one identifying sentence if the budget allows.",
  },
  {
    label: "Funeral home website",
    range: "250 to 500 words",
    note: "Usually free and usually the version people actually read and share. This is where the specific stories belong.",
  },
  {
    label: "Funeral program or keepsake",
    range: "150 to 350 words",
    note: "Must fit a printed panel alongside a photograph and the order of service. Write it last, after the service details are fixed.",
  },
  {
    label: "Read aloud at a service",
    range: "About 130 words per minute",
    note: "A 400-word obituary takes roughly three minutes to read aloud. Shorter sentences are easier to deliver when the reader is upset.",
  },
];

const FAQS = [
  {
    question: "Are these obituary templates really free?",
    answer:
      "Yes. Every template and example on this page is free to copy, edit, and publish. There is no sign-up, no email required, and no watermark. TributeReady sells an optional paid product that turns finished wording into print-ready funeral programs, but nothing on this page requires it.",
  },
  {
    question: "What should an obituary always include?",
    answer:
      "At minimum: full name, age, city, date of death, and service information. Nearly all obituaries also include birth details, surviving family, and family who died earlier. Cause of death, exact home address, and full birth date are all optional, and many families omit them for privacy and identity-theft reasons.",
  },
  {
    question: "How much does it cost to publish an obituary in a newspaper?",
    answer:
      "Newspaper pricing varies widely by market and is typically charged per line, per column inch, or per word, with photographs priced separately. Rates commonly range from under a hundred dollars in small local papers to several hundred or more in large metropolitan dailies. Ask the paper for its current rate card and word limit before you finalize length, and ask whether your funeral home submits on your behalf.",
  },
  {
    question: "Can I write an obituary myself instead of using the funeral home?",
    answer:
      "Yes. Funeral homes will usually submit and format the notice, but the text is normally written by the family. Writing it yourself costs nothing and almost always produces a more personal result. Ask the funeral home for the newspaper's deadline and word limit before you start.",
  },
  {
    question: "How do I list surviving family members?",
    answer:
      "The most common order is spouse, then children with their spouses in parentheses, then grandchildren and great-grandchildren, then siblings, then nieces and nephews. Name individuals while the list stays readable and switch to counts when it does not. Confirm every spelling with one family member before publishing.",
  },
];

export default function ObituaryTemplatesHub() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: TITLE,
      description: DESCRIPTION,
      url: `${SITE_URL}/obituary-templates`,
      isAccessibleForFree: true,
      dateModified: TEMPLATE_UPDATED,
      publisher: {
        "@type": "Organization",
        name: "TributeReady",
        url: SITE_URL,
      },
      mainEntity: {
        "@type": "ItemList",
        itemListElement: obituaryTemplates.map((template, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: template.shortTitle,
          url: `${SITE_URL}/obituary-templates/${template.slug}`,
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
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        {
          "@type": "ListItem",
          position: 2,
          name: "Obituary templates",
          item: `${SITE_URL}/obituary-templates`,
        },
      ],
    },
  ];

  return (
    <>
      <GrowthPageView page="obituary_templates" />
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
              Free templates · no sign-up
            </p>
            <h1 className="mt-4 max-w-3xl font-display text-5xl font-semibold leading-[0.95] tracking-[-0.02em] text-forest sm:text-7xl">
              Free obituary templates and examples
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-forest/65 sm:text-lg">
              Fill-in-the-blank templates for the relationships families write
              about most, each with completed examples, wording help for the
              parts people get stuck on, and guidance on length. Copy anything
              here and use it however you need to.
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8 lg:py-16">
          <section id="universal">
            <h2 className="font-display text-4xl font-semibold leading-tight text-forest">
              The standard obituary template
            </h2>
            <p className="mt-4 text-base leading-8 text-forest/70">
              Nearly every obituary follows the same six movements: the
              announcement, the biography, the marriage, the person, the family,
              and the service. This works for anyone. The relationship-specific
              templates below adjust the emphasis and the wording.
            </p>
            <div className="mt-6 rounded-3xl border border-forest/10 bg-paper p-6 shadow-[0_18px_50px_rgba(23,62,53,0.06)] sm:p-8">
              <div className="space-y-4 text-[15px] leading-7 text-forest/80">
                {UNIVERSAL_TEMPLATE.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
              <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-forest/10 pt-6">
                <CopyTextButton text={UNIVERSAL_TEMPLATE.join("\n\n")} />
                <span className="text-xs text-forest/50">
                  Free to copy. Nothing is required of you.
                </span>
              </div>
            </div>
          </section>

          <section id="printable" className="mt-10">
            <div className="rounded-3xl border border-forest/10 bg-mist/50 p-6 sm:p-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
                Free printable
              </p>
              <h2 className="mt-3 font-display text-3xl font-semibold leading-tight text-forest">
                Obituary worksheet, two pages, ready to print
              </h2>
              <p className="mt-3 text-base leading-7 text-forest/70">
                Gather the facts by hand before you try to write anything. It
                collects names, dates, family, and service details, then gives
                you the fill-in-the-blank draft on the second page. No email
                required.
              </p>
              <a
                href="/api/printable/obituary-worksheet"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-forest px-6 py-3.5 text-sm font-bold text-white"
              >
                Download the PDF <ArrowRight size={15} />
              </a>
            </div>
          </section>

          <section id="templates" className="mt-16">
            <h2 className="font-display text-4xl font-semibold leading-tight text-forest">
              Templates by relationship
            </h2>
            <p className="mt-4 text-base leading-8 text-forest/70">
              Each page includes a fill-in-the-blank template, a short version
              sized for a newspaper, a longer version for a funeral home page,
              and wording help specific to that relationship.
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {obituaryTemplates.map((template) => (
                <Link
                  key={template.slug}
                  href={`/obituary-templates/${template.slug}`}
                  className="group rounded-2xl border border-forest/10 bg-paper p-6 transition hover:-translate-y-0.5 hover:border-sage"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
                    For a {template.relationship}
                  </p>
                  <p className="mt-3 font-display text-2xl font-semibold leading-tight text-forest">
                    {template.shortTitle}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-forest/60">
                    Template, two fictional examples, and wording guidance.
                  </p>
                  <ArrowRight className="mt-4 text-gold" size={16} />
                </Link>
              ))}
            </div>
          </section>

          <section id="length" className="mt-16">
            <h2 className="font-display text-4xl font-semibold leading-tight text-forest">
              How long an obituary should be
            </h2>
            <p className="mt-4 text-base leading-8 text-forest/70">
              Length is decided by where the obituary will appear, not by how
              much there is to say. Most families write the long version first
              and cut it down.
            </p>
            <div className="mt-7 space-y-4">
              {LENGTH_GUIDE.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-forest/10 bg-paper p-6"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <p className="font-display text-2xl font-semibold text-forest">
                      {item.label}
                    </p>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold">
                      {item.range}
                    </p>
                  </div>
                  <p className="mt-3 text-base leading-7 text-forest/70">
                    {item.note}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-16 rounded-[2rem] bg-forest p-8 text-white sm:p-10">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#d8c08e]">
              When you are ready
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold">
              From wording to a printable program
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-white/65">
              These templates stay free. If you also need the printed pieces for
              the service, TributeReady drafts the wording with you, lets you
              edit every line, and produces a print-ready funeral program,
              memorial keepsake, and thank-you card for a one-time $34.99. You
              see the full draft before you decide anything.
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
                {
                  href: "/order-of-service-templates",
                  label: "Order of service templates",
                },
                {
                  href: "/funeral-readings",
                  label: "Funeral poems and readings",
                },
                {
                  href: "/resources/how-to-write-an-obituary",
                  label: "How to write an obituary",
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
