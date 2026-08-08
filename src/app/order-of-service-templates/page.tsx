import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { GrowthPageView } from "@/components/growth-page-view";
import { ResourceFooter, ResourceHeader } from "@/components/resource-guide";
import { TEMPLATE_UPDATED } from "@/lib/obituary-templates";
import { orderOfServiceTemplates } from "@/lib/order-of-service-templates";

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://tributeready.org";

const TITLE = "Free Funeral Order of Service Templates by Tradition";
const DESCRIPTION =
  "Free order of service templates for Catholic, Baptist, non-denominational, military, graveside, memorial, and celebration of life services, with copyable program wording.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/order-of-service-templates" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/order-of-service-templates",
    siteName: "TributeReady",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

const CHOOSING = [
  {
    question: "Is the body present?",
    answer:
      "If yes, you are planning a funeral. If no, it is a memorial service, and it can be held whenever suits your family.",
  },
  {
    question: "Is there a faith community involved?",
    answer:
      "If the person belonged to a parish or congregation, that community usually sets the structure and will tell you what is fixed and what you choose.",
  },
  {
    question: "Will the burial happen the same day?",
    answer:
      "If so, add a committal or graveside service. Allow travel time between the service and the cemetery, and tell guests whether they are invited to both.",
  },
  {
    question: "Did the person serve in the military?",
    answer:
      "Military honors are rendered for eligible veterans at no cost and are requested through the funeral director. They add ten to twenty minutes at the committal.",
  },
  {
    question: "How many people will want to speak?",
    answer:
      "This single question determines the length of the service more than any other. Decide before printing whether sharing is open or invitation-only.",
  },
];

export default function OrderOfServiceHub() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: TITLE,
      description: DESCRIPTION,
      url: `${SITE_URL}/order-of-service-templates`,
      isAccessibleForFree: true,
      dateModified: TEMPLATE_UPDATED,
      publisher: {
        "@type": "Organization",
        name: "TributeReady",
        url: SITE_URL,
      },
      mainEntity: {
        "@type": "ItemList",
        itemListElement: orderOfServiceTemplates.map((template, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: template.shortTitle,
          url: `${SITE_URL}/order-of-service-templates/${template.slug}`,
        })),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        {
          "@type": "ListItem",
          position: 2,
          name: "Order of service templates",
          item: `${SITE_URL}/order-of-service-templates`,
        },
      ],
    },
  ];

  return (
    <>
      <GrowthPageView page="order_of_service_templates" />
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
              Funeral order of service templates
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-forest/65 sm:text-lg">
              The full sequence for each kind of service, with realistic timing,
              copyable program wording, and notes on what to confirm with your
              officiant. Free to use, nothing required.
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-forest/60">
              Every tradition below is also available as an editable file for{" "}
              <Link
                href="/funeral-program-template-word"
                className="font-semibold text-forest underline underline-offset-4"
              >
                Microsoft Word
              </Link>{" "}
              and{" "}
              <Link
                href="/funeral-program-google-docs"
                className="font-semibold text-forest underline underline-offset-4"
              >
                Google Docs
              </Link>
              . If you are trying to work out what size to print, or which word
              your church or printer uses, start with{" "}
              <Link
                href="/funeral-pamphlet-template"
                className="font-semibold text-forest underline underline-offset-4"
              >
                funeral pamphlet sizes and wording
              </Link>
              .
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8 lg:py-16">
          <section id="templates">
            <h2 className="font-display text-4xl font-semibold leading-tight text-forest">
              Choose your service type
            </h2>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {orderOfServiceTemplates.map((template) => (
                <Link
                  key={template.slug}
                  href={`/order-of-service-templates/${template.slug}`}
                  className="group rounded-2xl border border-forest/10 bg-paper p-6 transition hover:-translate-y-0.5 hover:border-sage"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
                    {template.label}
                  </p>
                  <p className="mt-3 font-display text-2xl font-semibold leading-tight text-forest">
                    {template.shortTitle}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-forest/60">
                    {template.duration}
                  </p>
                  <ArrowRight className="mt-4 text-gold" size={16} />
                </Link>
              ))}
            </div>
          </section>

          <section id="printable" className="mt-16">
            <div className="rounded-3xl border border-forest/10 bg-mist/50 p-6 sm:p-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
                Free printable
              </p>
              <h2 className="mt-3 font-display text-3xl font-semibold leading-tight text-forest">
                Funeral program planner, two pages, ready to print
              </h2>
              <p className="mt-3 text-base leading-7 text-forest/70">
                Plan the four panels, write the order of service with a name
                beside every part, confirm pallbearers and readers, and work
                through the printing checklist. No email required.
              </p>
              <a
                href="/api/printable/funeral-program-planner"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-forest px-6 py-3.5 text-sm font-bold text-white"
              >
                Download the PDF <ArrowRight size={15} />
              </a>
            </div>
          </section>

          <section id="choosing" className="mt-16">
            <h2 className="font-display text-4xl font-semibold leading-tight text-forest">
              Five questions that decide the structure
            </h2>
            <p className="mt-4 text-base leading-8 text-forest/70">
              Most families can settle the shape of a service by answering
              these. Everything else is preference.
            </p>
            <dl className="mt-7 space-y-5">
              {CHOOSING.map((item) => (
                <div
                  key={item.question}
                  className="rounded-2xl border border-forest/10 bg-paper p-6"
                >
                  <dt className="font-display text-2xl font-semibold text-forest">
                    {item.question}
                  </dt>
                  <dd className="mt-3 text-base leading-8 text-forest/70">
                    {item.answer}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="mt-16 rounded-[2rem] bg-forest p-8 text-white sm:p-10">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#d8c08e]">
              When you are ready
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold">
              Turn the order of service into a printed program
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-white/65">
              TributeReady lays out a four-panel bifold program with your order
              of service, photograph, and tribute, and gives you print-ready
              files for a one-time $34.99. Everything here stays free.
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

          <section className="mt-14 border-t border-forest/10 pt-10">
            <h2 className="font-display text-3xl font-semibold text-forest">
              Related free resources
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                {
                  href: "/funeral-pamphlet-template",
                  label: "Pamphlet sizes and panel wording",
                },
                {
                  href: "/funeral-program-template-word",
                  label: "Editable Word templates",
                },
                {
                  href: "/funeral-program-google-docs",
                  label: "Editing in Google Docs",
                },
                { href: "/obituary-templates", label: "Obituary templates" },
                {
                  href: "/funeral-readings",
                  label: "Funeral poems and readings",
                },
                {
                  href: "/resources/what-to-include-in-a-funeral-program",
                  label: "What to include in a program",
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
