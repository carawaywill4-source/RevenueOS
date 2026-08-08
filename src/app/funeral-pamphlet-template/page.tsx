import type { Metadata } from "next";
import { ArrowRight, Download } from "lucide-react";
import Link from "next/link";
import { GrowthPageView } from "@/components/growth-page-view";
import { ResourceFooter, ResourceHeader } from "@/components/resource-guide";
import { TEMPLATE_UPDATED } from "@/lib/obituary-templates";
import { orderOfServiceTemplates } from "@/lib/order-of-service-templates";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://tributeready.org";

const TITLE = "Funeral Pamphlet Templates: Sizes, Wording, and Free Files";
const DESCRIPTION =
  "What a funeral pamphlet is actually called, standard sizes with real dimensions, wording for every panel you can copy, and free editable templates. No signup, no watermark.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/funeral-pamphlet-template" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/funeral-pamphlet-template",
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
  "You may have searched for a funeral pamphlet, a bulletin, a booklet, an order of service, or a memorial folder. In nearly every case these are the same object: a folded sheet of paper handed to guests as they arrive, telling them what will happen and who the person was.",
  "This page answers the question underneath most of those searches — what the thing is called and why the name keeps changing — then gives real dimensions for each size, wording you can copy for every panel, and free editable files.",
];

const NAMES = [
  {
    term: "Funeral program",
    who: "United States, general use",
    detail:
      "The most widely used term in the United States and the safest word to type into a print shop website or a template search. If you only remember one of these words, remember this one.",
  },
  {
    term: "Order of service",
    who: "United Kingdom, Ireland, Australia",
    detail:
      "The standard term outside North America, sometimes shortened to service sheet. In the United States the same phrase usually means something narrower: the sequence of the service itself, the list of hymns, readings, and prayers, rather than the whole printed booklet. That is the one genuine ambiguity in this list, so if someone uses it, it is worth asking whether they mean the list or the printed piece.",
  },
  {
    term: "Funeral bulletin",
    who: "American Protestant churches",
    detail:
      "The handout a congregation receives every Sunday is already called the bulletin, and the funeral one is produced by the same church office, on the same paper, in the same way. If the service is at a church, this is often the word the staff will use.",
  },
  {
    term: "Funeral pamphlet",
    who: "Families, plain English",
    detail:
      "A description of the physical object rather than a trade term: a small folded printed sheet. Funeral directors and stationery printers rarely put this word on an invoice, but a great many families use it, which is why it is on this page.",
  },
  {
    term: "Funeral booklet",
    who: "Anywhere, when the content runs long",
    detail:
      "Usually implies more than four panels: several sheets folded together and stapled at the spine. Reach for this word when there is a long obituary, full hymn texts, or a page of photographs.",
  },
  {
    term: "Memorial folder or funeral folder",
    who: "Funeral homes and stationery printers",
    detail:
      "The trade term. If you order printed programs through a funeral director, this is likely the wording on the order form and the invoice, and it usually refers to the standard bifold.",
  },
  {
    term: "Obituary pamphlet",
    who: "When the obituary is the main content",
    detail:
      "Describes what is inside rather than how it folds. It is the right word when there is no formal order of service to print, or when the service is short and the obituary is what people will actually read and keep.",
  },
  {
    term: "Memorial program or celebration of life program",
    who: "Non-traditional services",
    detail:
      "Used when the gathering is not a funeral in the traditional sense. Same object, different tone, and usually a little more room given to photographs and stories.",
  },
];

const NAMES_TAKEAWAY = [
  "The practical rule is to use the other person's word. If the church office says bulletin, say bulletin. If the printer's website says memorial folder, order the memorial folder. You will be handed the same folded sheet either way, and nobody will think less of you for using a different term than they do.",
  "There is no official name and no governing body that assigns one. The vocabulary follows the country, the denomination, and whoever happens to be doing the printing.",
];

const SIZES = [
  {
    name: "Single sheet",
    flat: "8.5 x 11 in (US Letter)",
    finished: "8.5 x 11 in, no fold",
    panels: "One or two sides",
    best: "The order of service and little else. Nothing to fold and nothing to align, so it is very hard to get wrong. This is the right choice when the service is tomorrow.",
  },
  {
    name: "Bifold",
    flat: "8.5 x 11 in, folded once across the middle",
    finished: "5.5 x 8.5 in",
    panels: "Four panels",
    best: "The default funeral program, and what most people picture. One panel each for the cover, the order of service, the life or obituary, and the acknowledgment. If you are unsure, choose this.",
  },
  {
    name: "Large bifold",
    flat: "11 x 17 in (tabloid), folded once",
    finished: "8.5 x 11 in",
    panels: "Four panels, each a full letter page",
    best: "A long obituary, a photo collage, or type large enough for older guests to read without glasses. Almost always a print shop job rather than a home printer one.",
  },
  {
    name: "Trifold",
    flat: "8.5 x 11 in, folded twice",
    finished: "About 3.67 x 8.5 in, one third of 11 inches per panel",
    panels: "Six panels",
    best: "Content that divides naturally into six short blocks. Be warned that the panels are narrow: a portrait photograph on a 3.67 inch panel is small, and folding equal thirds evenly by hand is harder than it looks.",
  },
  {
    name: "Legal bifold",
    flat: "8.5 x 14 in (US Legal), folded once",
    finished: "7 x 8.5 in",
    panels: "Four panels",
    best: "An obituary that runs slightly long for a letter bifold. Each panel is about an inch and a half wider, which is often exactly the extra room you need.",
  },
  {
    name: "Booklet",
    flat: "Several 8.5 x 11 sheets folded together and stapled at the fold",
    finished: "5.5 x 8.5 in",
    panels: "Always a multiple of four: two sheets give 8 pages, three give 12, four give 16",
    best: "Full hymn texts, several readings, a list of survivors, or more than one page of photographs. Ask a print shop about saddle stitching rather than trying to staple a thick fold at home.",
  },
  {
    name: "Graduated or step fold",
    flat: "Sheets cut to different depths, folded together",
    finished: "Varies by design",
    panels: "Each lower edge visible as a step",
    best: "A decorative option where each page edge shows in a stepped stack. It looks striking and it is difficult to produce at home. Take this one to a printer.",
  },
  {
    name: "A4 order of service",
    flat: "A4, 210 x 297 mm, folded once",
    finished: "A5, 148 x 210 mm",
    panels: "Four panels",
    best: "The standard size in the United Kingdom, Ireland, Australia, and most of Europe. It is the same shape as a US bifold, very slightly taller and narrower.",
  },
];

const SIZE_NOTES = [
  "Count what you actually have before you choose the fold. One photograph and a ten-line order of service fits a single sheet. A photograph, an order of service, and three paragraphs of obituary is a bifold, which is why the bifold became the default.",
  "Once you need a fourth block of content, go to a booklet rather than a trifold. Trifold panels are narrow, and squeezing a photograph and an obituary onto them usually produces something cramped rather than something elegant.",
  "Check what your printer physically takes before you commit. Many home printers stop at legal size, and tabloid nearly always means a trip to a print shop.",
];

const PANELS = [
  {
    panel: "Front cover",
    purpose:
      "Identify the person and the service. A guest should be able to read the name and know they are in the right room without unfolding anything.",
    sample: [
      "In Loving Memory of",
      "MARGARET ANNE ELLIS",
      "March 4, 1941 — January 18, 2026",
      "[photograph]",
      "A Service of Remembrance",
      "Saturday, January 25, 2026 at eleven o'clock in the morning",
      "First Presbyterian Church",
      "Bloomington, Indiana",
    ],
    tip: "Keep the name the largest text on the panel. A common mistake is letting a decorative heading such as In Loving Memory outgrow the person's name.",
  },
  {
    panel: "Inside left — order of service",
    purpose:
      "Tell people what will happen and who is doing it. Put a name beside every part, because the most common question during a service is who is that.",
    sample: [
      "Order of Service",
      "Prelude — Ellen Vance, organ",
      "Welcome — The Reverend Thomas Reid",
      "Opening Prayer — The Reverend Thomas Reid",
      "Hymn — Amazing Grace",
      "Scripture Reading — Psalm 23, read by David Ellis",
      "Eulogy — Katherine Ellis Moore",
      "Musical Selection — In the Garden, sung by Ruth Alden",
      "Remarks from Family and Friends",
      "Closing Prayer — The Reverend Thomas Reid",
      "Recessional",
    ],
    tip: "Confirm the sequence with the officiant before printing. Congregations vary, and a printed order that contradicts the service leader is more confusing than no printed order at all.",
  },
  {
    panel: "Inside right — the life",
    purpose:
      "The obituary, or a shorter tribute. This is the panel people keep, and it is the one most likely to be read again years later, often by someone tracing the family.",
    sample: [
      "Margaret Anne Ellis was born on March 4, 1941, in Terre Haute, Indiana, to Walter and Ruth Callahan.",
      "She taught fourth grade at Fairview Elementary for thirty-one years, and kept a jar of pencils on her desk that any child could take from without asking.",
      "She married Robert Ellis in 1963. They had three children and were married for fifty-two years.",
      "She is survived by her children David, Katherine, and Anne; seven grandchildren; and her sister Louise Callahan Byrd. She was preceded in death by her husband Robert.",
    ],
    tip: "Include full names, including maiden names, and real dates. One concrete habit is worth more than five adjectives, so write the jar of pencils rather than the word dedicated.",
  },
  {
    panel: "Back cover — acknowledgment",
    purpose:
      "Thank the guests, and give them the practical information they need after the service ends.",
    sample: [
      "Acknowledgment",
      "The family of Margaret Anne Ellis wishes to thank you for your kindness, your prayers, and your presence today. Your support has meant more than we are able to say.",
      "Interment",
      "Rose Hill Cemetery, Bloomington, Indiana",
      "Pallbearers",
      "David Ellis · Michael Moore · James Byrd",
      "Peter Alden · Samuel Reed · Charles Innes",
      "Reception to follow in the Fellowship Hall",
      "In lieu of flowers, the family asks that donations be made to the Monroe County Public Library.",
    ],
    tip: "Two other acknowledgment openings that work: The family is deeply grateful for every kindness shown during these days. And: We thank you for standing with us today, and for every card, meal, and quiet visit that came before it.",
  },
];

const OMIT = [
  "The family home address. The service time is public and the house is empty during it.",
  "Phone numbers and email addresses of grieving relatives, which are difficult to withdraw once a few hundred copies are in circulation.",
  "Any name, role, or time that is not yet confirmed. A printed program is the one document nobody can quietly correct on the day.",
  "Copyrighted poems and song lyrics, unless you have permission. Naming the work and the author in the program and reading it aloud is the safer route.",
];

const DOWNLOADS = [
  {
    name: "Bifold pamphlet template",
    file: "/api/word/bifold-funeral-program",
    format: "One 8.5 x 11 sheet, both sides, folded once — four panels",
    best: "The standard four-panel pamphlet described above, with the panel order already imposed correctly so the cover lands where it should after folding.",
  },
  {
    name: "Single-sheet order of service",
    file: "/api/word/single-sheet-order-of-service",
    format: "One 8.5 x 11 page, printed on one side",
    best: "Nothing to fold, nothing to align. The right choice when time is very short.",
  },
];

const PRINTABLES = [
  {
    name: "Funeral program planner",
    file: "/api/printable/funeral-program-planner",
    detail:
      "Two pages, ready to print. Plan the four panels, write the order of service with a name beside every part, confirm pallbearers and readers, and work through the printing checklist.",
  },
  {
    name: "Obituary worksheet",
    file: "/api/printable/obituary-worksheet",
    detail:
      "Prompts for gathering dates, names, and the specific details that make an obituary read like a person rather than a form.",
  },
];

const BEFORE_PRINTING = [
  "For a bifold, print double-sided and flip on the SHORT edge. Flipping on the long edge prints the inside upside down, and it is the single most common way a pamphlet is ruined.",
  "Print one copy and fold it before running the rest. This catches nearly every mistake while it is still cheap to fix.",
  "Print at 100 percent or actual size, not fit to page, or the margins will creep in and the fold will no longer sit where the design expects it.",
  "A common guide is one pamphlet for every two people expected, plus about twenty spare. People take them home, and families almost always wish they had printed more.",
];

const FAQS = [
  {
    q: "What is a funeral pamphlet called?",
    a: "There is no single official name. Funeral program is the most common term in the United States, order of service is standard in the United Kingdom, Ireland, and Australia, bulletin is usual in American Protestant churches, and memorial folder or funeral folder is what funeral homes and stationery printers tend to call it. Pamphlet, booklet, and obituary pamphlet all describe the same handout. Use whichever word the person you are talking to uses.",
  },
  {
    q: "Is a funeral bulletin the same as a funeral program?",
    a: "In practice, yes. Bulletin is the word churches use, because the handout given out at ordinary Sunday worship is already called the bulletin and the funeral one comes from the same office. A bulletin sometimes leans more toward the liturgy and a program more toward the tribute, but the distinction is a tendency rather than a rule, and both usually contain both.",
  },
  {
    q: "What size is a funeral pamphlet?",
    a: "Most commonly one 8.5 x 11 inch sheet folded once down the middle, giving a finished size of 5.5 x 8.5 inches and four panels. Outside North America the equivalent is A4 folded to A5, 148 x 210 mm. Larger options are 11 x 17 inches folded to 8.5 x 11, or legal 8.5 x 14 folded to 7 x 8.5.",
  },
  {
    q: "How many pages should a funeral pamphlet be?",
    a: "Four panels covers most services: cover, order of service, obituary, acknowledgment. Go to a stapled booklet only when you have full hymn texts, several readings, or more than one page of photographs, and remember that a booklet page count is always a multiple of four.",
  },
  {
    q: "What do you write in a funeral pamphlet?",
    a: "The person's full name and dates, a photograph, the date, time, and place of the service, the order of service with a name beside each part, a short obituary or life summary, the names of pallbearers, interment details, and a short acknowledgment thanking guests. Reception details and donation requests go on the back panel.",
  },
  {
    q: "How do I make an obituary pamphlet?",
    a: "Start from the bifold file above and give the obituary the inside spread rather than a single panel. An obituary pamphlet is the right shape when there is no formal order of service to print, or when the service is short and what people will keep is the writing about the person.",
  },
  {
    q: "Who normally makes the funeral pamphlet?",
    a: "Either the funeral home, the church office, or the family. Funeral homes and churches usually charge for printing and work from a fixed set of designs. A family printing at home or at a copy shop has more control over the wording and photographs, which is the reason most people end up looking for a template.",
  },
  {
    q: "Are the templates on this page really free?",
    a: "Yes. No signup, no email address, no watermark, and nothing withheld for a paid version. The files download when you click. You may edit, print, share, and reuse them, including for a service you are paid to arrange, and you do not need to credit us.",
  },
];

export default function FuneralPamphletPage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: TITLE,
      description: DESCRIPTION,
      url: `${SITE_URL}/funeral-pamphlet-template`,
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
          name: "Funeral pamphlet templates",
          item: `${SITE_URL}/funeral-pamphlet-template`,
        },
      ],
    },
  ];

  return (
    <div className="bg-paper">
      <GrowthPageView page="funeral_pamphlet" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <ResourceHeader />

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-12">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-forest/50">
          Pamphlet, bulletin, booklet, folder
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-forest sm:text-5xl">
          Funeral pamphlet templates, sizes, and wording
        </h1>
        <div className="mt-6 space-y-4 text-lg leading-8 text-forest/75">
          {INTRO.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>

        <section id="what-its-called" className="mt-14 scroll-mt-8">
          <h2 className="font-display text-3xl font-semibold text-forest">
            What is a funeral pamphlet called?
          </h2>
          <p className="mt-4 text-base leading-8 text-forest/70">
            {NAMES_TAKEAWAY[1]}
          </p>
          <dl className="mt-7 space-y-4">
            {NAMES.map((n) => (
              <div
                key={n.term}
                className="rounded-2xl border border-forest/10 bg-white p-6"
              >
                <dt>
                  <span className="font-display text-xl font-semibold text-forest">
                    {n.term}
                  </span>
                  <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-gold">
                    {n.who}
                  </span>
                </dt>
                <dd className="mt-3 text-base leading-7 text-forest/70">
                  {n.detail}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-7 border-l-2 border-sage bg-mist/60 px-5 py-4 text-base leading-7 text-forest/70">
            {NAMES_TAKEAWAY[0]}
          </p>
        </section>

        <section id="sizes" className="mt-16 scroll-mt-8">
          <h2 className="font-display text-3xl font-semibold text-forest">
            Standard funeral pamphlet sizes
          </h2>
          <p className="mt-4 text-base leading-8 text-forest/70">
            The fold follows the amount of content, not the other way around.
            Every size below is given as the flat sheet you print on and the
            finished size after folding.
          </p>
          <div className="mt-7 space-y-4">
            {SIZES.map((s) => (
              <div
                key={s.name}
                className="rounded-2xl border border-forest/10 bg-white p-6"
              >
                <h3 className="font-display text-xl font-semibold text-forest">
                  {s.name}
                </h3>
                <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[7rem_minmax(0,1fr)]">
                  <dt className="font-semibold text-forest/50">Flat sheet</dt>
                  <dd className="text-forest/75">{s.flat}</dd>
                  <dt className="font-semibold text-forest/50">Finished</dt>
                  <dd className="text-forest/75">{s.finished}</dd>
                  <dt className="font-semibold text-forest/50">Panels</dt>
                  <dd className="text-forest/75">{s.panels}</dd>
                </dl>
                <p className="mt-4 text-base leading-7 text-forest/70">
                  {s.best}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-7 space-y-4 text-base leading-8 text-forest/70">
            {SIZE_NOTES.map((n) => (
              <p key={n}>{n}</p>
            ))}
          </div>
        </section>

        <section id="wording" className="mt-16 scroll-mt-8">
          <h2 className="font-display text-3xl font-semibold text-forest">
            What to write on each panel
          </h2>
          <p className="mt-4 text-base leading-8 text-forest/70">
            The wording below follows the standard four-panel bifold. Copy it
            and replace the details. Every name, date, and place in these
            examples is fictional.
          </p>
          <div className="mt-7 space-y-6">
            {PANELS.map((p) => (
              <div
                key={p.panel}
                className="rounded-2xl border border-forest/10 bg-white p-6 sm:p-7"
              >
                <h3 className="font-display text-xl font-semibold text-forest">
                  {p.panel}
                </h3>
                <p className="mt-3 text-base leading-7 text-forest/70">
                  {p.purpose}
                </p>
                <figure className="mt-5 rounded-xl bg-cream px-5 py-5">
                  <figcaption className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
                    Sample wording
                  </figcaption>
                  <div className="mt-3 space-y-1.5 font-display text-base leading-7 text-forest">
                    {p.sample.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </figure>
                <p className="mt-5 text-sm leading-6 text-forest/65">
                  {p.tip}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-forest/10 bg-white p-6">
            <h3 className="font-display text-xl font-semibold text-forest">
              What to leave off
            </h3>
            <ul className="mt-4 space-y-3">
              {OMIT.map((o) => (
                <li
                  key={o}
                  className="flex gap-3 text-base leading-7 text-forest/70"
                >
                  <span
                    aria-hidden="true"
                    className="mt-2.5 size-1.5 shrink-0 rounded-full bg-gold"
                  />
                  <span>{o}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/funeral-readings"
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-forest hover:text-forest/70"
            >
              Poems and readings you may legally print
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section id="download" className="mt-16 scroll-mt-8">
          <h2 className="font-display text-3xl font-semibold text-forest">
            Download an editable pamphlet
          </h2>
          <p className="mt-4 text-base leading-8 text-forest/70">
            These are the same files as our Word templates, because a pamphlet
            and a program are the same object. They are standard .docx files, so
            they open in Word, Google Docs, Pages, and LibreOffice. Every field
            you need to replace is written inside [square brackets].
          </p>
          <div className="mt-7 grid gap-5">
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

          <h3 className="mt-10 font-display text-2xl font-semibold text-forest">
            Bulletins by tradition
          </h3>
          <p className="mt-3 text-base leading-7 text-forest/70">
            Each of these downloads as an editable Word file with the service
            sequence already in the right order for that tradition. Confirm the
            order with your officiant before printing, since congregations vary.
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

          <h3 className="mt-10 font-display text-2xl font-semibold text-forest">
            Free printable worksheets
          </h3>
          <div className="mt-5 grid gap-5">
            {PRINTABLES.map((p) => (
              <div
                key={p.name}
                className="rounded-2xl border border-forest/10 bg-white p-6"
              >
                <h4 className="font-display text-lg font-semibold text-forest">
                  {p.name}
                </h4>
                <p className="mt-2 text-base leading-7 text-forest/70">
                  {p.detail}
                </p>
                <a
                  href={p.file}
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-forest hover:text-forest/70"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Download the PDF
                </a>
              </div>
            ))}
          </div>
        </section>

        <section id="printing" className="mt-16 scroll-mt-8">
          <h2 className="font-display text-3xl font-semibold text-forest">
            Before you print
          </h2>
          <ul className="mt-6 space-y-3">
            {BEFORE_PRINTING.map((b) => (
              <li
                key={b}
                className="flex gap-3 text-base leading-7 text-forest/70"
              >
                <span
                  aria-hidden="true"
                  className="mt-2.5 size-1.5 shrink-0 rounded-full bg-gold"
                />
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/funeral-program-template-word"
              className="inline-flex items-center gap-2 rounded-full border border-forest/20 px-5 py-3 text-sm font-semibold text-forest transition hover:border-forest/40"
            >
              Full printing and folding guide
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/funeral-program-google-docs"
              className="inline-flex items-center gap-2 rounded-full border border-forest/20 px-5 py-3 text-sm font-semibold text-forest transition hover:border-forest/40"
            >
              Editing in Google Docs
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
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
            If you would rather not lay it out yourself
          </h2>
          <p className="mt-3 text-base leading-7 text-forest/70">
            Everything on this page is free and stays free. But laying out four
            panels while grieving, on a deadline, is a real burden, and
            double-sided printing goes wrong more often than it goes right.
            TributeReady asks a few questions about the person and returns a
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
              {
                href: "/funeral-program-template-word",
                label: "Word templates and printing guide",
              },
              {
                href: "/funeral-program-google-docs",
                label: "Editing in Google Docs",
              },
              {
                href: "/order-of-service-templates",
                label: "Order of service by tradition",
              },
              { href: "/obituary-templates", label: "Obituary templates" },
              { href: "/eulogy-examples", label: "Eulogy examples" },
              {
                href: "/resources/what-to-include-in-a-funeral-program",
                label: "What to include in a program",
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
