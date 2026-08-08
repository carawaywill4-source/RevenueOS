import type { Metadata } from "next";
import { ArrowRight, Download } from "lucide-react";
import Link from "next/link";
import { GrowthPageView } from "@/components/growth-page-view";
import { ResourceFooter, ResourceHeader } from "@/components/resource-guide";
import { TEMPLATE_UPDATED } from "@/lib/obituary-templates";
import { orderOfServiceTemplates } from "@/lib/order-of-service-templates";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://tributeready.org";

const TITLE = "Free Funeral Program Template for Google Docs (Editable)";
const DESCRIPTION =
  "Free editable funeral program templates that open directly in Google Docs. Exact upload steps, what to check after import, how to export a print-ready PDF, and an honest note on Canva.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/funeral-program-google-docs" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/funeral-program-google-docs",
    siteName: "TributeReady",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

const INTRO = [
  "We publish these templates as .docx files rather than as Google Docs links, and that is deliberate. A .docx opens in Google Docs, Microsoft Word, Apple Pages, and LibreOffice, so one file serves everyone in the family regardless of what is on their computer.",
  "Google Docs reads .docx directly. Download the file, upload it, and edit it in the browser. There is no copy to request, no account to make with us, and no email address to hand over.",
];

const DOWNLOADS = [
  {
    name: "Bifold funeral program",
    file: "/api/word/bifold-funeral-program",
    format: "One 8.5 x 11 sheet, both sides, folded once — four panels",
    best: "The standard funeral program. Uses two columns and a landscape section, both of which Google Docs supports.",
  },
  {
    name: "Single-sheet order of service",
    file: "/api/word/single-sheet-order-of-service",
    format: "One 8.5 x 11 page, printed on one side",
    best: "One portrait page, no columns and no folding. This is the file that survives an import into anything with the fewest surprises.",
  },
];

const STEPS = [
  {
    name: "Download the template",
    text: "Click one of the downloads above. The file saves to your Downloads folder with a .docx extension. Nothing opens automatically.",
  },
  {
    name: "Open Google Docs",
    text: "Go to docs.google.com and sign in. A free Google account is enough; you do not need a paid Workspace plan.",
  },
  {
    name: "Choose File, then Open",
    text: "In the menu bar of any open document, or from the Docs home screen, choose File and then Open.",
  },
  {
    name: "Switch to the Upload tab",
    text: "The Open a file dialog has tabs across the top: Recent, Starred, Shared with me, My Drive, and Upload. Click Upload.",
  },
  {
    name: "Add the file",
    text: "Drag the .docx into the box, or click Browse and select it. The file uploads to your Google Drive and then opens in the Google Docs editor.",
  },
  {
    name: "Check the .DOCX label",
    text: "You should see .DOCX beside the file name at the top. That means Google Docs is editing the Word file in place and saving your changes back into that same .docx. If you would rather work in Google's own format, choose File and then Save as Google Docs, which creates a separate copy and leaves the original untouched.",
  },
  {
    name: "Delete the instruction page",
    text: "The first page is guidance and is meant to be removed. It sits behind a page break, so you can select it from the top of the document to the break and delete it in one action.",
  },
  {
    name: "Replace every bracketed field",
    text: "Every field you need to fill in is written inside [square brackets]. Press Ctrl+H, or Cmd+Shift+H on a Mac, to open find and replace, and search for an opening bracket to move between them until none are left.",
  },
];

const CHECKS = [
  {
    q: "Make sure the document is in Pages format, not Pageless",
    a: "Google Docs has a pageless mode in which page setup, columns, page breaks, and section breaks are all unavailable. Choose File, then Page setup, and confirm Pages is selected at the top of the dialog. Every other item on this list depends on this one, so check it first.",
  },
  {
    q: "Confirm the landscape sections came across",
    a: "The bifold template is a portrait instruction page followed by landscape pages. Google Docs supports different orientations in one document by using section breaks. To see where they are, choose View, then Show section breaks. To change one, put the cursor inside that section, choose File, then Page setup, and set Apply to: This section.",
  },
  {
    q: "Check the two columns on the panel pages",
    a: "Each bifold sheet is two columns, one panel per column. Verify with Format, then Columns. More options lets you set the gap between columns and whether a dividing line is drawn. To push text to the top of the next panel, use Insert, then Break, then Column break, rather than pressing Enter until it moves. Pressing Enter looks the same until you edit a line above it, at which point everything slides.",
  },
  {
    q: "Look at the alignment of the order of service lines",
    a: "Those lines use a right tab stop so the names stay in a column down the page. If they arrive ragged, select the lines and drag the tab marker on the ruler until they line up. If you cannot see the ruler, choose View, then Show ruler.",
  },
  {
    q: "Set the photograph to In line",
    a: "Insert, then Image, then Upload from computer. Click the image and choose In line from the small toolbar that appears beneath it. In line makes the picture behave like a very large character, so it stays where you put it. Wrap text and Break text both allow it to drift once you start typing above it, which is how photographs end up on the wrong panel.",
  },
];

const FONT_NOTE =
  "The templates are set in Georgia, which is one of the fonts Google Docs includes as standard, so the type should carry across unchanged. Fonts are still worth a glance: if any text substitutes to a different face, the line breaks move, so read the whole document once after you finish typing rather than before.";

const PDF_STEPS = [
  "Check File, then Page setup first. Confirm the paper size is the one your printer expects, Letter in North America or A4 elsewhere, and that the margins are what you want. Fixing this after you export means exporting again.",
  "Choose File, then Download, then PDF Document (.pdf). The file lands in your Downloads folder.",
  "Give the print shop the PDF, not the .docx. A PDF fixes the fonts and spacing exactly as you saw them. A .docx re-flows on whatever machine and font set the shop happens to have, which is how a name ends up alone on its own line.",
  "Open the PDF and read it before you send it. This is the last moment a wrong date is cheap to fix.",
  "Printing at home, choose actual size or 100 percent rather than fit to page, or the margins shift and the fold no longer lands where the design expects.",
  "For a bifold, print double-sided flipping on the SHORT edge. Long-edge flipping prints the inside upside down. Print one, fold it, then run the rest.",
];

const OTHER_APPS = [
  "Apple Pages opens .docx directly. Double-click the file. Pages will note that it is a Word document and convert it as it opens, and File, then Export To, then PDF produces the print file.",
  "LibreOffice Writer opens .docx directly and handles sections, columns, and tab stops closely enough that these templates usually need no repair at all. Use File, then Export as PDF.",
  "Microsoft Word is what the files were built for, and the layout there is the reference version. Our Word page covers the same templates with Word-specific instructions.",
];

const CANVA = [
  {
    h: "What Canva is genuinely good at here",
    p: "Canva is a visual design tool, and it is better than any word processor at the visual half of this job. Placing a photograph precisely, cropping it into a shape, setting a background, pairing display typefaces, and getting a cover that looks designed rather than typed are all easier there than in Google Docs or Word. If the appearance of the cover matters a great deal to your family, that is a genuine reason to use it.",
  },
  {
    h: "It is a separate account and a separate file",
    p: "You sign up, work in the browser, and the design lives in Canva. It is not a Word or Google Docs file. You can export a PDF for a relative, but they cannot open the design and correct a date without a Canva account of their own. If several people in the family need to edit the wording, a .docx is the more forgiving choice.",
  },
  {
    h: "Not every template is on every plan",
    p: "Canva lists a larger template and stock library on its paid plans than on its free one, and its plan comparison also covers print-ready and CMYK export. Plans and features change, so check canva.com yourself rather than trusting any third party, including this page, on what is included today. It is worth doing before you build a whole program around a template you may not be able to export the way you need.",
  },
  {
    h: "Ask the printer before you design, not after",
    p: "Whatever tool you use, ask your print shop what they want: paper size, single or double sided, whether they need bleed, and whether they need CMYK. Then confirm your export can produce it. This one question prevents most of the trouble people run into, and it is not specific to Canva.",
  },
  {
    h: "The fold is still yours",
    p: "No design tool solves the short-edge flip or the fold. If you are printing at home, the imposition and the folding are the same problem in Canva as anywhere else.",
  },
];

const CANVA_CLOSE =
  "If you want visual control, use Canva. If you want a file that anyone can open and edit on any computer, use the .docx above. Neither is wrong, and there is nothing stopping you from designing the cover in one and writing the text in the other.";

const FAQS = [
  {
    q: "Is there a funeral program template for Google Docs?",
    a: "Yes. The files on this page are .docx templates, and Google Docs opens .docx directly through File, then Open, then Upload. Once uploaded, you edit them in the browser exactly as you would any Google Doc, and Google saves your changes back into the same file.",
  },
  {
    q: "Are these really free?",
    a: "Yes. No signup, no email address, no watermark, and nothing withheld for a paid version. You may edit, print, share, and reuse them, including for a service you are paid to arrange, and you do not need to credit us.",
  },
  {
    q: "Do I need a Google account?",
    a: "You need a free Google account to use Google Docs, which is Google's requirement rather than ours. If you would rather not create one, the same file opens in Apple Pages and in LibreOffice, both of which run on your own computer.",
  },
  {
    q: "Do I have to convert the file to Google Docs format?",
    a: "No. Google Docs edits .docx files in place and shows a .DOCX label beside the file name while it does. Converting with File, then Save as Google Docs is optional, and it creates a second file rather than changing the first.",
  },
  {
    q: "Why can I not find the columns or page setup options?",
    a: "The document is almost certainly in pageless format, which hides page setup, columns, page breaks, and section breaks. Choose File, then Page setup, and select Pages at the top of the dialog. Everything reappears.",
  },
  {
    q: "Will Google Docs change the layout?",
    a: "Some spacing can shift slightly between any two programs, which is true of Word and LibreOffice as well. The five checks above cover everything that moves in practice. Read the whole document once after you finish typing, and print one copy and fold it before running the rest.",
  },
  {
    q: "How do I get a PDF for the print shop?",
    a: "Choose File, then Download, then PDF Document (.pdf). Check File, then Page setup first so the paper size is right. Send the print shop the PDF rather than the editable file, because a PDF fixes the fonts and spacing and an editable file does not.",
  },
  {
    q: "Should I use Canva instead?",
    a: "Canva is a strong choice if the visual design of the cover matters most to you, since it handles photographs and typography better than a word processor. A .docx is the better choice if several relatives need to edit the text, or if you want a file that opens on any computer without an account. Check canva.com for what its current plans include before you commit to building there.",
  },
];

export default function GoogleDocsProgramPage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: TITLE,
      description: DESCRIPTION,
      url: `${SITE_URL}/funeral-program-google-docs`,
      isAccessibleForFree: true,
      dateModified: TEMPLATE_UPDATED,
      publisher: {
        "@type": "Organization",
        name: "TributeReady",
        url: SITE_URL,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: "How to open a funeral program template in Google Docs",
      description:
        "Upload a .docx funeral program template to Google Docs and edit it in the browser.",
      totalTime: "PT5M",
      step: STEPS.map((s, index) => ({
        "@type": "HowToStep",
        position: index + 1,
        name: s.name,
        text: s.text,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
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
          name: "Funeral program template for Google Docs",
          item: `${SITE_URL}/funeral-program-google-docs`,
        },
      ],
    },
  ];

  return (
    <div className="bg-paper">
      <GrowthPageView page="funeral_program_google_docs" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <ResourceHeader />

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-12">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-forest/50">
          Google Docs, Pages, LibreOffice
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-forest sm:text-5xl">
          Funeral program template for Google Docs
        </h1>
        <div className="mt-6 space-y-4 text-lg leading-8 text-forest/75">
          {INTRO.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>

        <section id="download" className="mt-14 scroll-mt-8">
          <h2 className="font-display text-3xl font-semibold text-forest">
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
                  Download the file
                </a>
              </div>
            ))}
          </div>

          <h3 className="mt-10 font-display text-2xl font-semibold text-forest">
            Templates by tradition
          </h3>
          <p className="mt-3 text-base leading-7 text-forest/70">
            Each of these downloads as an editable file with the service
            sequence already in the right order for that tradition, and each
            opens in Google Docs the same way. Confirm the order with your
            officiant before printing, since congregations vary.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
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

        <section id="open" className="mt-16 scroll-mt-8">
          <h2 className="font-display text-3xl font-semibold text-forest">
            Open the template in Google Docs
          </h2>
          <ol className="mt-7 space-y-4">
            {STEPS.map((s, index) => (
              <li
                key={s.name}
                className="flex gap-4 rounded-2xl border border-forest/10 bg-white p-6"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-mist font-display text-sm font-semibold text-forest">
                  {index + 1}
                </span>
                <div>
                  <p className="font-display text-lg font-semibold text-forest">
                    {s.name}
                  </p>
                  <p className="mt-2 text-base leading-7 text-forest/70">
                    {s.text}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="checks" className="mt-16 scroll-mt-8">
          <h2 className="font-display text-3xl font-semibold text-forest">
            Five things to check after the import
          </h2>
          <p className="mt-4 text-base leading-8 text-forest/70">
            Moving a document between two programs almost always shifts
            something. These are the five places it happens with these
            templates, in the order worth checking them.
          </p>
          <dl className="mt-7 space-y-5">
            {CHECKS.map((c) => (
              <div
                key={c.q}
                className="rounded-2xl border border-forest/10 bg-white p-6"
              >
                <dt className="font-display text-lg font-semibold text-forest">
                  {c.q}
                </dt>
                <dd className="mt-2 text-base leading-7 text-forest/70">
                  {c.a}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-7 border-l-2 border-sage bg-mist/60 px-5 py-4 text-base leading-7 text-forest/70">
            {FONT_NOTE}
          </p>
        </section>

        <section id="pdf" className="mt-16 scroll-mt-8">
          <h2 className="font-display text-3xl font-semibold text-forest">
            Export a print-ready PDF
          </h2>
          <ul className="mt-6 space-y-3">
            {PDF_STEPS.map((s) => (
              <li
                key={s}
                className="flex gap-3 text-base leading-7 text-forest/70"
              >
                <span
                  aria-hidden="true"
                  className="mt-2.5 size-1.5 shrink-0 rounded-full bg-gold"
                />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </section>

        <section id="other-apps" className="mt-16 scroll-mt-8">
          <h2 className="font-display text-3xl font-semibold text-forest">
            The same file in Pages, LibreOffice, and Word
          </h2>
          <div className="mt-5 space-y-4 text-base leading-8 text-forest/70">
            {OTHER_APPS.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          <Link
            href="/funeral-program-template-word"
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-forest/20 px-5 py-3 text-sm font-semibold text-forest transition hover:border-forest/40"
          >
            Microsoft Word instructions
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>

        <section id="canva" className="mt-16 scroll-mt-8">
          <h2 className="font-display text-3xl font-semibold text-forest">
            A straight answer about Canva
          </h2>
          <p className="mt-4 text-base leading-8 text-forest/70">
            Canva comes up constantly alongside Google Docs in these searches,
            and it deserves a real answer rather than a dismissal from a site
            that does not sell it.
          </p>
          <div className="mt-7 space-y-5">
            {CANVA.map((c) => (
              <div
                key={c.h}
                className="rounded-2xl border border-forest/10 bg-white p-6"
              >
                <h3 className="font-display text-lg font-semibold text-forest">
                  {c.h}
                </h3>
                <p className="mt-2 text-base leading-7 text-forest/70">{c.p}</p>
              </div>
            ))}
          </div>
          <p className="mt-7 border-l-2 border-sage bg-mist/60 px-5 py-4 text-base leading-7 text-forest/70">
            {CANVA_CLOSE}
          </p>
        </section>

        <section id="questions" className="mt-16 scroll-mt-8">
          <h2 className="font-display text-3xl font-semibold text-forest">
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

        <section className="mt-16 rounded-3xl border border-forest/10 bg-white p-8">
          <h2 className="font-display text-2xl font-semibold text-forest">
            If you would rather skip the layout entirely
          </h2>
          <p className="mt-3 text-base leading-7 text-forest/70">
            The templates above are genuinely free and always will be. But
            formatting four panels in a browser while grieving, on a deadline,
            is a real burden, and double-sided printing goes wrong more often
            than it goes right. TributeReady asks a few questions about the
            person and returns a finished, print-ready PDF with the panels
            already imposed correctly, for a one-time $34.99. No subscription.
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
              {
                href: "/funeral-pamphlet-template",
                label: "Pamphlet sizes and panel wording",
              },
              {
                href: "/funeral-program-template-word",
                label: "Word templates and printing guide",
              },
              {
                href: "/order-of-service-templates",
                label: "Order of service by tradition",
              },
              { href: "/obituary-templates", label: "Obituary templates" },
              { href: "/eulogy-examples", label: "Eulogy examples" },
              {
                href: "/funeral-readings",
                label: "Poems and readings you may legally print",
              },
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
