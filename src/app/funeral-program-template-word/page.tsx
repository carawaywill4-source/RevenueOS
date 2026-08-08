import type { Metadata } from "next";
import { ArrowRight, Download } from "lucide-react";
import Link from "next/link";
import { GrowthPageView } from "@/components/growth-page-view";
import { ResourceFooter, ResourceHeader } from "@/components/resource-guide";
import { orderOfServiceTemplates } from "@/lib/order-of-service-templates";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://tributeready.org";

const TITLE = "Free Funeral Program Templates for Microsoft Word (Editable)";
const DESCRIPTION =
  "Free editable funeral program templates in Microsoft Word format. Bifold and single-sheet order of service .docx files, no signup, no watermark, plus printing and folding instructions.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/funeral-program-template-word" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/funeral-program-template-word",
    siteName: "TributeReady",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

const DOWNLOADS = [
  {
    name: "Bifold funeral program",
    file: "/api/word/bifold-funeral-program",
    format: "One 8.5 x 11 sheet, printed both sides, folded once — four panels",
    best: "The standard funeral program. Choose this if you have a photograph and an obituary to include.",
  },
  {
    name: "Single-sheet order of service",
    file: "/api/word/single-sheet-order-of-service",
    format: "One 8.5 x 11 page, printed on one side only",
    best: "Choose this if the service is tomorrow. Nothing to fold, nothing to align, very hard to get wrong.",
  },
];

const PRINTING = [
  {
    q: "Which paper should I use?",
    a: "Standard copier paper works, but 28lb paper or a light card stock feels noticeably better in the hand and costs very little more. If you are printing a photograph, matte paper hides fingerprints better than glossy.",
  },
  {
    q: "How many should I print?",
    a: "A common guide is one program for every two people expected, plus about twenty spare. People take them home, and families almost always wish they had printed more rather than fewer.",
  },
  {
    q: "Why did my double-sided print come out upside down?",
    a: "Your printer flipped on the long edge. For a bifold you need to flip on the SHORT edge. The setting is usually in the print dialog under two-sided printing. Print one copy and fold it before running the rest.",
  },
  {
    q: "Can I take the Word file to a copy shop?",
    a: "Yes, though most shops prefer a PDF because it guarantees your fonts and spacing survive. In Word choose File, then Save As, then PDF. Bring that file on a USB stick or email it ahead.",
  },
  {
    q: "The photo moves whenever I type. How do I fix it?",
    a: "Right-click the image, choose Wrap Text, then In Line with Text. The picture will then behave like a very large letter and stay where you put it.",
  },
];

const FAQS = [
  {
    q: "Are these really free?",
    a: "Yes. There is no signup, no email address required, no watermark, and no trial. The files download directly when you click. You may edit, print, share, and reuse them, including for a service you are paid to arrange, and you do not need to credit us.",
  },
  {
    q: "Will these open in Google Docs, Pages, or LibreOffice?",
    a: "Yes. They are standard .docx files. In Google Docs choose File, then Open, and upload the file. Some spacing may shift slightly between programs, so check the layout before printing. Pages and LibreOffice both open .docx directly.",
  },
  {
    q: "What are the square brackets for?",
    a: "Every field you need to replace is written inside [square brackets], so nothing gets missed. Press Ctrl+H, or Cmd+Shift+H on a Mac, and search for an opening bracket to jump between them.",
  },
  {
    q: "Do I have to delete the first page?",
    a: "Yes. The first page is instructions and is meant to be deleted before printing. It is separated by a page break so you can remove it in one action.",
  },
];

export default function WordTemplatePage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: TITLE,
      description: DESCRIPTION,
      url: `${SITE_URL}/funeral-program-template-word`,
      isAccessibleForFree: true,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [...FAQS, ...PRINTING].map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "TributeReady",
          item: SITE_URL,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Funeral program templates for Word",
          item: `${SITE_URL}/funeral-program-template-word`,
        },
      ],
    },
  ];

  return (
    <div className="bg-paper">
      <GrowthPageView page="funeral_program_word" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <ResourceHeader />

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-12">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-forest/50">
          Free Word templates
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-forest sm:text-5xl">
          Free funeral program templates for Microsoft Word
        </h1>
        <p className="mt-6 text-lg leading-8 text-forest/75">
          Editable <strong>.docx</strong> files you can open in Word, Google Docs,
          Pages, or LibreOffice and type straight into. No signup, no email
          address, no watermark, and nothing held back for a paid version. Every
          field you need to fill in is marked with [square brackets] so nothing
          gets missed at four in the morning.
        </p>
        <p className="mt-4 text-base leading-7 text-forest/65">
          Not using Word?{" "}
          <Link
            href="/funeral-program-google-docs"
            className="font-semibold text-forest underline underline-offset-4"
          >
            Step-by-step instructions for Google Docs
          </Link>
          . Looking for sizes, or for the word your church or printer uses?{" "}
          <Link
            href="/funeral-pamphlet-template"
            className="font-semibold text-forest underline underline-offset-4"
          >
            Funeral pamphlet sizes and panel wording
          </Link>
          .
        </p>

        <section className="mt-12">
          <h2 className="font-display text-2xl font-semibold text-forest">
            Download
          </h2>
          <div className="mt-6 grid gap-5">
            {DOWNLOADS.map((d) => (
              <div
                key={d.name}
                className="rounded-2xl border border-forest/10 bg-white p-6"
              >
                <h3 className="font-display text-xl font-semibold text-forest">
                  {d.name}
                </h3>
                <p className="mt-2 text-sm font-semibold text-forest/55">
                  {d.format}
                </p>
                <p className="mt-3 text-base leading-7 text-forest/70">
                  {d.best}
                </p>
                <a
                  href={d.file}
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-forest px-5 py-3 text-sm font-semibold text-paper transition hover:bg-forest/90"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Download Word file
                </a>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14">
          <h2 className="font-display text-2xl font-semibold text-forest">
            Templates by tradition
          </h2>
          <p className="mt-3 text-base leading-7 text-forest/70">
            Each of these downloads as an editable Word file with the service
            sequence already in the right order for that tradition. Confirm the
            order with your officiant before printing, since congregations vary.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {orderOfServiceTemplates.map((t) => (
              <a
                key={t.slug}
                href={`/api/word/order-of-service/${t.slug}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-forest/10 bg-white px-5 py-4 text-left transition hover:border-forest/30"
              >
                <span className="text-base font-semibold text-forest">
                  {t.shortTitle}
                </span>
                <Download
                  className="h-4 w-4 shrink-0 text-forest/50"
                  aria-hidden="true"
                />
              </a>
            ))}
          </div>
        </section>

        <section className="mt-14">
          <h2 className="font-display text-2xl font-semibold text-forest">
            Printing and folding
          </h2>
          <p className="mt-3 text-base leading-7 text-forest/70">
            More programs are ruined at the printer than in the writing. These
            are the mistakes that actually happen.
          </p>
          <dl className="mt-6 space-y-5">
            {PRINTING.map((f) => (
              <div
                key={f.q}
                className="rounded-2xl border border-forest/10 bg-white p-6"
              >
                <dt className="font-display text-lg font-semibold text-forest">
                  {f.q}
                </dt>
                <dd className="mt-2 text-base leading-7 text-forest/70">
                  {f.a}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-14">
          <h2 className="font-display text-2xl font-semibold text-forest">
            Questions
          </h2>
          <dl className="mt-6 space-y-5">
            {FAQS.map((f) => (
              <div
                key={f.q}
                className="rounded-2xl border border-forest/10 bg-white p-6"
              >
                <dt className="font-display text-lg font-semibold text-forest">
                  {f.q}
                </dt>
                <dd className="mt-2 text-base leading-7 text-forest/70">
                  {f.a}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-14 rounded-3xl border border-forest/10 bg-white p-8">
          <h2 className="font-display text-2xl font-semibold text-forest">
            If you would rather not fight with Word
          </h2>
          <p className="mt-3 text-base leading-7 text-forest/70">
            The templates above are genuinely free and always will be. But
            formatting a bifold while grieving, on a deadline, is a real burden,
            and double-sided printing goes wrong more often than it goes right.
            TributeReady answers a few questions about the person and returns a
            finished, print-ready PDF with the panels already imposed correctly,
            for a one-time $34.99. No subscription.
          </p>
          <Link
            href="/#create"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-forest px-6 py-3 text-sm font-semibold text-paper transition hover:bg-forest/90"
          >
            See how it works
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>

        <section className="mt-14">
          <h2 className="font-display text-2xl font-semibold text-forest">
            Related free resources
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              { href: "/funeral-pamphlet-template", label: "Pamphlet sizes and panel wording" },
              { href: "/funeral-program-google-docs", label: "Editing in Google Docs" },
              { href: "/order-of-service-templates", label: "Order of service by tradition" },
              { href: "/obituary-templates", label: "Obituary templates" },
              { href: "/eulogy-examples", label: "Eulogy examples" },
              { href: "/funeral-readings", label: "Poems and readings you may legally print" },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="flex items-center justify-between gap-3 rounded-xl border border-forest/10 bg-white px-5 py-4 transition hover:border-forest/30"
              >
                <span className="text-base font-semibold text-forest">
                  {l.label}
                </span>
                <ArrowRight
                  className="h-4 w-4 shrink-0 text-forest/50"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </div>
        </section>
      </main>

      <ResourceFooter />
    </div>
  );
}
