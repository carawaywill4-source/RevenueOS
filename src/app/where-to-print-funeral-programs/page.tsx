import type { Metadata } from "next";
import { ArrowRight, Download, ExternalLink } from "lucide-react";
import Link from "next/link";
import { GrowthPageView } from "@/components/growth-page-view";
import { ResourceFooter, ResourceHeader } from "@/components/resource-guide";
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://tributeready.org";

// The date the retailer claims below were last checked against each company's
// own website. Only move this after actually re-checking them.
const RETAILERS_CHECKED = "2026-08-07";

const TITLE = "Where to Print Funeral Programs (Same-Day Options and What to Bring)";
const DESCRIPTION =
  "Where to get a funeral program printed today, what file to bring, which product to ask for, and what paper to choose. Every retailer detail checked against the store's own website, with sources.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/where-to-print-funeral-programs" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/where-to-print-funeral-programs",
    siteName: "TributeReady",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

const CHECKED_ON = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
}).format(new Date(`${RETAILERS_CHECKED}T00:00:00Z`));

const INTRO = [
  "If the service is tomorrow and you do not know where to go, the short answer is a staffed print counter: Staples, FedEx Office, or Office Depot and OfficeMax all take a file in the morning and hand you finished copies the same afternoon, and an independent local print shop will often do the same. A drugstore photo counter will not, because it prints photographs rather than folded documents.",
  "Bring a PDF. Ask for document or copy printing with a folding finish. Do not ask for booklet printing, because a standard four-panel program is too short to qualify as a booklet and asking for the wrong product is the single most common reason a family gets turned away or told to come back tomorrow. That is explained in full below.",
];

const CUTOFFS = [
  {
    name: "Staples",
    speed: "Order by 12 pm for same-day service",
    detail:
      "Standard same-day pickup is free and available for many products ordered before 12 pm. Express pickup is offered for limited quantities at an additional cost and is guaranteed ready in three hours or less. Orders placed after the cutoff, which is 12 pm for standard or three hours before closing for express, will be ready the next day. Staples also warns that during peak periods some same-day products may only be available for next-day pickup because of demand.",
    sources: [
      {
        label: "Staples same-day print services",
        url: "https://www.staples.com/services/printing/same-day-services/",
      },
      {
        label: "Staples print and marketing services",
        url: "https://www.staples.com/services/printing/",
      },
    ],
  },
  {
    name: "FedEx Office",
    speed: "Most finished orders same day or within 24 to 48 hours",
    detail:
      "For documents that need binding, laminating, or finishing, FedEx Office states that most orders are completed the same day or within 24 to 48 hours when you order online and select in-store pickup. There is no published clock-time cutoff, so the honest answer is that it depends on the store. Simple self-service printing is faster: many locations have self-service printers you can walk up to, and FedEx Office says many simple document printing tasks can be completed the same day that way. Full-service printing may offer rush options at additional cost. Note that a surcharge is added to full-service print orders under $50.",
    sources: [
      {
        label: "FedEx Office binding, laminating and finishing",
        url: "https://www.office.fedex.com/default/binding-laminating-finishing-services",
      },
      {
        label: "FedEx Office in-store services",
        url: "https://www.office.fedex.com/default/services",
      },
    ],
  },
  {
    name: "Office Depot and OfficeMax",
    speed: "Order by 2 pm local time, and you must ask for it",
    detail:
      "Same-day service is available on full-service work in store, and can be bought online for in-store pickup. Two conditions matter and families miss the second one: the order must be placed by 2:00 pm local time, and Same-Day Service must be specifically requested on the job ticket at the time of order. It is not automatic. Same-day is not available for delivery and excludes self-service printing. The same-day quantity limits are far above anything a family needs, at 2,000 black and white copies or 1,000 color copies.",
    sources: [
      {
        label: "Office Depot same-day services",
        url: "https://www.officedepot.com/l/print-and-copy/same-day-printing",
      },
      {
        label: "Office Depot document printing",
        url: "https://www.officedepot.com/l/print-and-copy/document-printing",
      },
    ],
  },
  {
    name: "A local independent print shop",
    speed: "Often the fastest, but you have to call",
    detail:
      "We cannot verify turnaround for a shop we have not named, and neither can anyone else writing a page like this. What we can say honestly is that independent shops set their own schedule, can usually tell you in one phone call whether your job fits into today, and are the people most likely to look at your file and quietly fix a problem with it. If a chain tells you tomorrow, call two local shops before you accept that answer.",
    sources: [],
  },
];

const WALK_IN = [
  "A PDF, on a USB stick and also in your email or cloud storage, so a failed USB port does not end the trip.",
  "The number of copies. Decide before you arrive so you are not doing arithmetic at the counter.",
  "The flat sheet size and the finished size. For the standard program that is 8.5 x 11 inches printed on both sides, folded once, finishing at 5.5 x 8.5 inches.",
  "The words document printing or copies, and a folding finish. Say half fold or fold in half.",
  "Your phone number, so they can call you instead of guessing if something in the file looks wrong.",
  "A request to see one finished copy, folded, before they run the rest. Every printer will do this and it costs nothing.",
];

const BOOKLET_TRAP = [
  "A standard funeral program is one sheet of paper, printed on both sides, folded once. That is four panels, and in printing terms four pages. It is the format almost every family means when they say program.",
  "Booklet printing is a different product. It is a stack of sheets folded together and stapled through the spine, which is what saddle stitched means, and it has a minimum length. Staples offers booklets from 8 up to 80 pages, with the final page count required to be a multiple of four. VistaPrint saddle-stitch booklets run 8 to 76 pages including the four cover pages, in increments of four.",
  "So a four-page bifold is below the minimum at both. If you walk in and ask for booklet printing, the honest outcome is either confusion or an upsell into something longer than you need. Ask for document printing or copies with a folding finish instead, which is the product that actually matches a bifold.",
  "Folding is offered as a finishing option on the document side at all three chains. Staples lists folding among the finishes for document printing. FedEx Office lists half-fold, tri-fold, and Z-fold under finishing services for letter, legal, and tabloid printing. Office Depot lists folding among the options on its copies product.",
  "Booklet printing becomes the right answer when the program genuinely runs long: full hymn texts, several readings, a page of photographs, a long list of survivors. At that point you are at 8 pages or more, the page count has to be a multiple of four, and saddle stitching is exactly what you want.",
];

const BOOKLET_SOURCES = [
  {
    label: "Staples booklet printing, 8 to 80 pages, saddle stitched",
    url: "https://www.staples.com/services/printing/copies-documents-printing/booklets/",
  },
  {
    label: "Staples document printing finishes, including folding",
    url: "https://www.staples.com/services/printing/copies-documents-printing/",
  },
  {
    label: "FedEx Office finishing services, half-fold and tri-fold",
    url: "https://www.office.fedex.com/default/binding-laminating-finishing-services",
  },
  {
    label: "VistaPrint saddle-stitch booklets, 8 to 76 pages",
    url: "https://www.vistaprint.com/marketing-materials/booklets/saddle-stitch",
  },
];

const NOT_A_FIT = [
  {
    name: "Walgreens and CVS photo counters",
    detail:
      "These are photo labs, not copy shops. Walgreens lists same-day pickup for prints, enlargements, posters, collage prints, photo books, canvas, and greeting cards, with prints ready in about an hour and same-day pickup not guaranteed. CVS states that same-day pickup applies to select photo products for orders received by 7 pm local time. Neither publishes a document or copy printing service, and neither lists a letter-size double-sided document with a fold. They are a good answer if what you need is a framed portrait for the entrance table or a stack of photographs, and the wrong answer for the program itself.",
    sources: [
      {
        label: "Walgreens photo pickup and delivery options",
        url: "https://photo.walgreens.com/store/photo-fulfillment-options",
      },
      {
        label: "Walgreens same-day pickup product list",
        url: "https://photo.walgreens.com/store/same-day-pickup",
      },
      { label: "CVS Photo", url: "https://www.cvs.com/photo" },
    ],
  },
  {
    name: "VistaPrint and other ship-to-you printers",
    detail:
      "Good quality, genuinely cheaper per copy at higher quantities, and structurally unable to help you this week. VistaPrint publishes delivery in as soon as 8 business days for economy, 6 for standard, 3 for express, and 2 business days for rush, and states that all of those times include production as well as shipping. Rush is not offered on every product. Their bi-fold brochure, which is the closest match to a bifold program at 8.5 x 11 folded in half into four surfaces, and their saddle-stitch booklets both quote the slower end. Order from an online printer only if the service is more than a week away.",
    sources: [
      {
        label: "VistaPrint shipping and delivery",
        url: "https://www.vistaprint.com/shipping",
      },
      {
        label: "VistaPrint bi-fold brochures",
        url: "https://www.vistaprint.com/marketing-materials/brochures/bi-fold",
      },
    ],
  },
  {
    name: "The funeral home",
    detail:
      "Worth asking, always, because they may already be printing something and because they know the local shops. We deliberately make no claim about funeral home pricing or turnaround, because it varies by home and we have no way to verify it. Ask what it costs, ask when they need the final wording, and ask whether you may supply your own file.",
    sources: [],
  },
];

const FILE_POINTS = [
  {
    q: "Bring a PDF, not a Word file",
    a: "A .docx describes your document in terms of fonts and settings that have to exist on the machine opening it. On someone else's computer a missing font gets substituted, line breaks move, and a photograph can slide onto the wrong panel. A PDF freezes the page. What you saw is what prints. This is not a small risk for a bifold, because the whole layout depends on the fold landing between two specific panels.",
  },
  {
    q: "Some print counters will not accept a Word file at all",
    a: "Staples Print and Marketing Services lists its supported upload types as .jpeg, .jpg, .pdf, .png, .tif, .tiff, .bmp, and .gif, with individual files capped at 50 MB. Word documents are not on that list. Convert before you leave the house.",
  },
  {
    q: "How to export a PDF from Word",
    a: "In Word for Windows, choose File, then Save a Copy or Save As, then pick PDF in the file type list. On a Mac, choose File, then Save As, set the File Format box to PDF, and choose Export. In Word for the web, choose File, then Export, then Download as PDF. Give the PDF a different name from the Word file so you keep an editable original.",
  },
  {
    q: "How to export a PDF from Google Docs",
    a: "Open the document, choose File, then Download, then PDF Document. If the file is large, Google suggests File, then Print, then setting the destination to Save as PDF.",
  },
  {
    q: "Then open the PDF and look at it",
    a: "Open the exported file and read every panel before you send it anywhere. The export is where fonts and images go wrong, so the PDF, not the Word file, is the version you should proofread. Check the dates, the spelling of every name, and that the cover panel is on the correct side.",
  },
];

const FILE_SOURCES = [
  {
    label: "Staples supported file types and sizes",
    url: "https://pnimedia.uservoice.com/knowledgebase/articles/652843-supported-file-types-and-sizes",
  },
  {
    label: "Microsoft: export a Word document as PDF",
    url: "https://support.microsoft.com/en-us/word/export-word-document-as-pdf",
  },
  {
    label: "Microsoft: save or convert to PDF on your Mac",
    url: "https://support.microsoft.com/en-us/word/save-or-convert-to-pdf-on-your-mac",
  },
  {
    label: "Google: create, view, or download a file",
    url: "https://support.google.com/docs/answer/49114",
  },
];

const PAPER = [
  {
    weight: "20 lb to 24 lb text",
    what: "Ordinary copier and laser paper",
    verdict:
      "This is what a self-service machine loads by default. It is thin enough that heavy ink shows through from the other side, and thin enough that a folded program goes limp in a warm room after being held for an hour. Acceptable if cost or time leaves you no choice. Not what you would pick.",
  },
  {
    weight: "28 lb to 32 lb text",
    what: "Mid-weight and premium laser paper",
    verdict:
      "The sensible default for a bifold. Noticeably more substantial in the hand than copier paper, folds cleanly without any special preparation, and costs very little more across a hundred copies. If you say nothing else about paper, ask for the 28 or 32 pound stock.",
  },
  {
    weight: "60 lb to 80 lb text",
    what: "Heavier text stock",
    verdict:
      "A step up again, still foldable. Worth it if the program has a full-bleed photograph or a dark background, because heavier paper handles ink coverage with less show-through and less curl.",
  },
  {
    weight: "100 lb cover",
    what: "Cardstock",
    verdict:
      "This is card, not paper. It feels expensive and it holds up to being carried home in a coat pocket. The thing to ask before you commit is whether the shop will score the fold, because heavy stock folded without a score can crack along the crease. Ask the question at the counter rather than discovering it on a hundred copies.",
  },
];

const PAPER_NOTES = [
  "Those weights are not invented. FedEx Office lists its copies and custom documents paper as Laser 24 lb, Laser 32 lb, Laser Recycled 28 lb, 30 percent Recycled 20 lb, Laser 60 lb, Laser 80 lb, Gloss Text 32 lb, and Matte Cover 100 lb, alongside water resistant and colored stocks. Staples describes its document paper as standard and mid-weight whites, cardstock in a range of colors, and premium varieties in gloss or matte, and names basic 24 pound, standard 28 pound, and premium 32 pound in its own copy.",
  "Choose matte over gloss. Gloss makes a photograph look richer under a shop light and then behaves badly at a service: it throws glare back at anyone reading under fluorescent lighting, and it takes fingerprints from every hand that touches it. A matte or uncoated stock reads more easily, photographs acceptably, and looks the same at the end of the afternoon as it did at the start. Both Staples and FedEx Office offer matte options on the document side.",
  "If the program has a dark or full-bleed background, mention it when you order. Heavy ink coverage is the situation where thin paper curls and shows through, and it is also the situation a home printer handles worst.",
];

const PAPER_SOURCES = [
  {
    label: "FedEx Office copies and custom documents, paper types",
    url: "https://www.office.fedex.com/default/copies.html",
  },
  {
    label: "Staples document printing, paper and finishes",
    url: "https://www.staples.com/services/printing/copies-documents-printing/",
  },
];

const SIZES = [
  {
    name: "Bifold on letter",
    detail:
      "One 8.5 x 11 inch sheet, printed on both sides, folded once across the middle. Finished size 5.5 x 8.5 inches, four panels: cover, order of service, the life, acknowledgment. This is the default and the one to choose if you are unsure.",
  },
  {
    name: "Single sheet",
    detail:
      "One 8.5 x 11 inch page, printed on one side. No fold to align and nothing to impose, which makes it almost impossible to get wrong. This is the right choice when the service is tomorrow morning and the file is not finished.",
  },
  {
    name: "Large bifold on tabloid",
    detail:
      "One 11 x 17 inch sheet folded once, finishing at 8.5 x 11 inches. Four panels, each a full letter page. Useful for a long obituary or for type large enough to be read without glasses. Tabloid is a print shop job rather than a home printer one, and it is a size all three chains list.",
  },
  {
    name: "Saddle-stitched booklet",
    detail:
      "Several sheets folded together and stapled through the fold line. Staples describes its booklets as stapled along the fold line, offers them from 8 to 80 pages, and requires the final page count to be a multiple of four, inserting blank pages before the back cover if it is not. Choose this only when the content genuinely fills eight pages or more.",
  },
];

const QUANTITY = [
  "There is no verified industry figure for this, and anyone who quotes one precisely is guessing. What follows is reasoning, not data.",
  "Order fewer copies than the number of people you expect, because couples and families share one program. A common working rule is one program for every two attendees. Then add a margin on top, because the cost of a few extra copies is trivial and the cost of running out is a family member standing at the door with nothing to hand someone.",
  "Add copies for people who are not at the service. Relatives who could not travel will ask for one. So will the church office, the funeral home, and often a local library or historical society, because a program with full names and dates is a genealogy record whether or not anyone intends it that way. Twenty spare covers all of that comfortably.",
  "Quantity will not be what slows you down. Office Depot excludes same-day service only above 2,000 black and white or 1,000 color copies, which is an order of magnitude beyond a family service.",
  "If you are genuinely torn, print more. Families regret the shortage far more often than the surplus, and a small stack of leftover programs is something people are glad to have five years later.",
];

const HOME_GOOD = [
  "The program is a single sheet printed on one side. Nothing to align, nothing to fold.",
  "You need fewer than about forty copies.",
  "The design is mostly text on a light background, so ink use is modest.",
  "You have a duplex printer you have used successfully before, and a cartridge you know is not nearly empty.",
  "You have time to print one, fold it, look at it, and start again if it is wrong.",
];

const HOME_BAD = [
  "The design has a dark or photographic background covering the page. Home inkjets lay down a great deal of ink to fill a page, the paper cockles as it dries, and the color drifts as the cartridge depletes, so copy one and copy eighty do not match.",
  "You need more than about a hundred copies. That is a long unattended run, and the most common way it fails is a cartridge emptying somewhere in the middle, at which point the copies before and after it are visibly different and you cannot buy the identical cartridge at midnight.",
  "You want a heavier paper. Home printers have a paper weight limit and a straight enough paper path to match it, and cardstock is where jams and roller marks appear.",
  "You want an edge-to-edge design. Most home printers cannot print to the edge of the sheet, so a background that runs off the page will come back with a white border. Staples lists edge-to-edge printing among its full-customization document options, which is one of the real reasons to use a shop.",
  "The service is tomorrow morning. If the run fails at 11 pm you have no fallback, whereas a shop that fails at 11 am can reprint by 2 pm.",
];

const HOME_RULES = [
  "For a bifold, print double-sided and flip on the SHORT edge. Flipping on the long edge prints the inside upside down and is the most common way a program is ruined.",
  "Print one copy, fold it by hand, and read all four panels before you run the rest. This catches nearly every mistake while it is still cheap.",
  "Print at 100 percent or actual size, never fit to page, or the margins creep in and the fold no longer lands where the design expects it.",
  "Buy more paper than you need. Nothing is worse than a run that stops at copy seventy.",
  "Fold against a straight edge, or fold one carefully and use it as a guide for the rest. A ruler and a steady table produce a better crease than a hurried hand.",
];

const FAQS = [
  {
    q: "Where can I print funeral programs?",
    a: "A staffed print counter is the practical answer: Staples, FedEx Office, Office Depot or OfficeMax, or an independent local print shop. All of them take a PDF, print it double-sided on your choice of paper, and can fold it for you. Ask for document or copy printing with a folding finish rather than booklet printing. Drugstore photo counters print photographs rather than folded documents and are not a fit for the program itself.",
  },
  {
    q: "Can Staples print funeral programs?",
    a: "Yes, though not as a product with that name. Order it as document printing, choose letter size, double-sided, and add a folding finish. Staples lists folding among the finishes available on document printing, offers letter, legal, and ledger sizes, and states that ordering by 12 pm gets same-day service. Do not order it as booklet printing: Staples booklets start at 8 pages, and a standard bifold program is 4.",
  },
  {
    q: "Can I get funeral programs printed the same day?",
    a: "Usually, if you get the file in early enough. Staples publishes a 12 pm cutoff for same-day service, with paid express pickup guaranteed in three hours or less for limited quantities. Office Depot and OfficeMax require the order by 2 pm local time and require you to request Same-Day Service on the job ticket. FedEx Office states that most finished orders are completed the same day or within 24 to 48 hours when ordered online for in-store pickup. All of these depend on how busy that particular store is on that particular day, so call the store and confirm before you drive over.",
  },
  {
    q: "Can Walgreens or CVS print funeral programs?",
    a: "Not the program itself. Both run photo labs rather than document print shops. Walgreens lists same-day pickup for prints, posters, photo books, canvas, and greeting cards, with prints often ready in about an hour and same-day not guaranteed. CVS states same-day pickup applies to select photo products for orders received by 7 pm local time. Neither publishes a letter-size double-sided document with a fold. They are useful for a portrait print for the entrance table, and not for the order of service.",
  },
  {
    q: "How to print funeral programs at home?",
    a: "Export a PDF, load paper heavier than ordinary copier stock if your printer accepts it, print double-sided flipping on the SHORT edge, and print exactly one copy first so you can fold it and check all four panels before committing. Set the scale to 100 percent or actual size rather than fit to page. Home printing works well for a single-sheet program or a short run on a light background. It works badly for dark full-page designs, for runs over about a hundred, and for anything due the next morning.",
  },
  {
    q: "What paper should funeral programs be printed on?",
    a: "A text-weight stock in the 28 to 32 pound range is the sensible default: clearly better in the hand than copier paper, still folds cleanly, and barely more expensive. Heavier 60 to 80 pound text handles photographs and dark backgrounds better. Cardstock, around 100 pound cover, feels the most substantial but should be scored before folding, so ask the shop whether they will score it. Choose matte rather than gloss, because gloss glares under overhead lighting and holds fingerprints.",
  },
  {
    q: "What file should I bring to the print shop?",
    a: "A PDF. A Word file can substitute fonts and reflow on another machine, which moves your panels and can push a photograph across the fold. Staples lists its supported upload formats as .jpeg, .jpg, .pdf, .png, .tif, .tiff, .bmp, and .gif, with a 50 MB per-file limit, and Word documents are not on that list. Bring the PDF on a USB stick and also have it in your email so a failed USB port does not cost you the trip.",
  },
  {
    q: "What is saddle stitch and do I need it?",
    a: "Saddle stitch means stapled through the fold line, which is how a booklet of several folded sheets is held together. You need it only when the program runs to eight pages or more, and the total page count then has to be a multiple of four. A standard four-panel bifold is a single folded sheet and needs no stapling at all.",
  },
  {
    q: "How many funeral programs should I print?",
    a: "Fewer than the number of people expected, because couples share, and then a margin on top. One per two attendees plus about twenty spare is a reasonable working rule rather than a researched figure. Add copies for relatives who cannot attend, for the church office, and for anyone tracing family history later. Running short at the door is much worse than a small stack left over.",
  },
  {
    q: "How much does it cost to print funeral programs?",
    a: "We are not going to quote a number, because print prices change constantly and a stale figure is worse than none. The cost is driven by four things: quantity, color versus black and white, paper weight, and whether you add finishing such as folding. Ask for a quote at the counter with those four answers ready and you will get a real figure in under a minute. A phone call to two shops will tell you more than any article can.",
  },
  {
    q: "Can I get funeral programs printed near me tonight?",
    a: "Store hours vary by location and we will not claim otherwise. Look up your nearest branch on the retailer site, check today's closing time, and call before driving. If a chain cannot help this evening, an independent print shop is worth calling in the morning, since they can often turn a simple job around in hours.",
  },
];

const RELATED = [
  {
    href: "/funeral-program-template-word",
    label: "Free editable Word templates",
  },
  {
    href: "/funeral-pamphlet-template",
    label: "Pamphlet sizes and panel wording",
  },
  { href: "/funeral-program-google-docs", label: "Editing in Google Docs" },
  {
    href: "/order-of-service-templates",
    label: "Order of service by tradition",
  },
  { href: "/obituary-templates", label: "Obituary templates" },
  {
    href: "/funeral-readings",
    label: "Poems and readings you may legally print",
  },
];

function SourceList({
  sources,
}: {
  sources: { label: string; url: string }[];
}) {
  if (sources.length === 0) return null;
  return (
    <ul className="mt-4 space-y-1.5 border-t border-forest/10 pt-4">
      {sources.map((s) => (
        <li key={s.url}>
          <a
            href={s.url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-start gap-1.5 text-xs font-semibold leading-5 text-forest/55 underline underline-offset-4 transition hover:text-forest"
          >
            <ExternalLink
              className="mt-0.5 h-3 w-3 shrink-0"
              aria-hidden="true"
            />
            <span>{s.label}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export default function WhereToPrintPage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: TITLE,
      description: DESCRIPTION,
      url: `${SITE_URL}/where-to-print-funeral-programs`,
      mainEntityOfPage: `${SITE_URL}/where-to-print-funeral-programs`,
      datePublished: RETAILERS_CHECKED,
      dateModified: RETAILERS_CHECKED,
      isAccessibleForFree: true,
      inLanguage: "en-US",
      author: { "@type": "Organization", name: "TributeReady", url: SITE_URL },
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
          name: "Where to print funeral programs",
          item: `${SITE_URL}/where-to-print-funeral-programs`,
        },
      ],
    },
  ];

  return (
    <div className="bg-paper">
      <GrowthPageView page="where_to_print" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <ResourceHeader />

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-12">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-forest/50">
          Printing, in a hurry
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-forest sm:text-5xl">
          Where to print funeral programs
        </h1>
        <div className="mt-6 space-y-4 text-lg leading-8 text-forest/75">
          {INTRO.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>

        <p className="mt-7 border-l-2 border-sage bg-mist/60 px-5 py-4 text-sm leading-6 text-forest/70">
          <strong className="text-forest">
            Every retailer detail on this page was checked on {CHECKED_ON}
          </strong>{" "}
          against that company&#8217;s own website, and the source is linked
          beneath each claim. Cutoffs and turnaround still depend on how busy
          your particular store is that day, so call and confirm before you
          drive over. We have deliberately not published prices, because they
          change constantly and a stale number would be worse than none.
          TributeReady has no partnership, affiliation, or arrangement with any
          company named here, and earns nothing if you use them.
        </p>

        <section id="fastest" className="mt-16 scroll-mt-8">
          <h2 className="font-display text-3xl font-semibold text-forest">
            The fastest realistic options today
          </h2>
          <p className="mt-4 text-base leading-8 text-forest/70">
            Ordered by how much of the day you have left. If it is already
            afternoon, start at the bottom of this list and start phoning.
          </p>
          <div className="mt-7 space-y-4">
            {CUTOFFS.map((c) => (
              <div
                key={c.name}
                className="rounded-2xl border border-forest/10 bg-white p-6"
              >
                <h3 className="font-display text-xl font-semibold text-forest">
                  {c.name}
                </h3>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gold">
                  {c.speed}
                </p>
                <p className="mt-3 text-base leading-7 text-forest/70">
                  {c.detail}
                </p>
                <SourceList sources={c.sources} />
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-forest/10 bg-cream p-6">
            <h3 className="font-display text-xl font-semibold text-forest">
              What to have in hand before you walk in
            </h3>
            <ul className="mt-4 space-y-3">
              {WALK_IN.map((w) => (
                <li
                  key={w}
                  className="flex gap-3 text-base leading-7 text-forest/70"
                >
                  <span
                    aria-hidden="true"
                    className="mt-2.5 size-1.5 shrink-0 rounded-full bg-gold"
                  />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="booklet-trap" className="mt-16 scroll-mt-8">
          <h2 className="font-display text-3xl font-semibold text-forest">
            Ask for document printing, not booklet printing
          </h2>
          <p className="mt-4 text-base leading-8 text-forest/70">
            This is the part of the page worth reading even if you skip
            everything else, because choosing the wrong product is what causes
            a family to be turned away or told to come back tomorrow.
          </p>
          <div className="mt-6 space-y-4 text-base leading-8 text-forest/70">
            {BOOKLET_TRAP.map((b) => (
              <p key={b}>{b}</p>
            ))}
          </div>
          <SourceList sources={BOOKLET_SOURCES} />
        </section>

        <section id="not-a-fit" className="mt-16 scroll-mt-8">
          <h2 className="font-display text-3xl font-semibold text-forest">
            Places people try that will not work in time
          </h2>
          <p className="mt-4 text-base leading-8 text-forest/70">
            These are not bad companies. They are the wrong shape for this
            particular job, and knowing that now saves you an afternoon.
          </p>
          <div className="mt-7 space-y-4">
            {NOT_A_FIT.map((n) => (
              <div
                key={n.name}
                className="rounded-2xl border border-forest/10 bg-white p-6"
              >
                <h3 className="font-display text-xl font-semibold text-forest">
                  {n.name}
                </h3>
                <p className="mt-3 text-base leading-7 text-forest/70">
                  {n.detail}
                </p>
                <SourceList sources={n.sources} />
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm leading-6 text-forest/60">
            We looked at Costco Photo as well and left it off, because we could
            not verify a current Costco printing service from Costco&#8217;s own
            site. If you remember using it, that is why.
          </p>
        </section>

        <section id="file" className="mt-16 scroll-mt-8">
          <h2 className="font-display text-3xl font-semibold text-forest">
            What file to bring
          </h2>
          <p className="mt-4 text-base leading-8 text-forest/70">
            PDF is the safe universal answer, and the reason is worth thirty
            seconds of your attention because it is the difference between the
            program you designed and something slightly wrong that you only
            notice after a hundred copies exist.
          </p>
          <dl className="mt-7 space-y-4">
            {FILE_POINTS.map((f) => (
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
          <SourceList sources={FILE_SOURCES} />

          <div className="mt-8 rounded-2xl border border-forest/10 bg-cream p-6">
            <h3 className="font-display text-xl font-semibold text-forest">
              If you do not have a file yet
            </h3>
            <p className="mt-3 text-base leading-7 text-forest/70">
              Our editable Word templates are free, with no signup and no
              watermark. The bifold file already has the four panels imposed in
              the right order, so the cover lands where it should after folding.
              Fill it in, export a PDF, and take that to the counter.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href="/api/word/bifold-funeral-program"
                className="inline-flex items-center gap-2 rounded-full bg-forest px-5 py-3 text-sm font-semibold text-paper transition hover:bg-forest/90"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Bifold Word template
              </a>
              <a
                href="/api/word/single-sheet-order-of-service"
                className="inline-flex items-center gap-2 rounded-full border border-forest/20 px-5 py-3 text-sm font-semibold text-forest transition hover:border-forest/40"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Single-sheet Word template
              </a>
            </div>
            <Link
              href="/funeral-program-template-word"
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-forest hover:text-forest/70"
            >
              All free Word templates and printing instructions
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section id="paper" className="mt-16 scroll-mt-8">
          <h2 className="font-display text-3xl font-semibold text-forest">
            Which paper to choose
          </h2>
          <p className="mt-4 text-base leading-8 text-forest/70">
            Paper is described by weight in pounds, and the number means
            different things for text stock and cover stock, which is why 32
            pound text and 100 pound cover sound far apart and are only two
            steps apart in practice. Here is what the options actually feel
            like in the hand.
          </p>
          <div className="mt-7 space-y-4">
            {PAPER.map((p) => (
              <div
                key={p.weight}
                className="rounded-2xl border border-forest/10 bg-white p-6"
              >
                <h3 className="font-display text-xl font-semibold text-forest">
                  {p.weight}
                </h3>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gold">
                  {p.what}
                </p>
                <p className="mt-3 text-base leading-7 text-forest/70">
                  {p.verdict}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-7 space-y-4 text-base leading-8 text-forest/70">
            {PAPER_NOTES.map((n) => (
              <p key={n}>{n}</p>
            ))}
          </div>
          <SourceList sources={PAPER_SOURCES} />
        </section>

        <section id="sizes" className="mt-16 scroll-mt-8">
          <h2 className="font-display text-3xl font-semibold text-forest">
            Sizes and folding
          </h2>
          <div className="mt-7 space-y-4">
            {SIZES.map((s) => (
              <div
                key={s.name}
                className="rounded-2xl border border-forest/10 bg-white p-6"
              >
                <h3 className="font-display text-xl font-semibold text-forest">
                  {s.name}
                </h3>
                <p className="mt-3 text-base leading-7 text-forest/70">
                  {s.detail}
                </p>
              </div>
            ))}
          </div>
          <Link
            href="/funeral-pamphlet-template"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-forest hover:text-forest/70"
          >
            Full size chart, including trifold, legal, and A4
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>

        <section id="how-many" className="mt-16 scroll-mt-8">
          <h2 className="font-display text-3xl font-semibold text-forest">
            How many copies to order
          </h2>
          <div className="mt-5 space-y-4 text-base leading-8 text-forest/70">
            {QUANTITY.map((q) => (
              <p key={q}>{q}</p>
            ))}
          </div>
        </section>

        <section id="at-home" className="mt-16 scroll-mt-8">
          <h2 className="font-display text-3xl font-semibold text-forest">
            Printing at home
          </h2>
          <p className="mt-4 text-base leading-8 text-forest/70">
            Sometimes this is genuinely the right call, and sometimes it turns a
            hard week into a worse one at eleven at night. The difference is
            predictable.
          </p>

          <div className="mt-7 rounded-2xl border border-forest/10 bg-white p-6">
            <h3 className="font-display text-xl font-semibold text-forest">
              Print at home when
            </h3>
            <ul className="mt-4 space-y-3">
              {HOME_GOOD.map((h) => (
                <li
                  key={h}
                  className="flex gap-3 text-base leading-7 text-forest/70"
                >
                  <span
                    aria-hidden="true"
                    className="mt-2.5 size-1.5 shrink-0 rounded-full bg-sage"
                  />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 rounded-2xl border border-forest/10 bg-white p-6">
            <h3 className="font-display text-xl font-semibold text-forest">
              Take it to a shop when
            </h3>
            <ul className="mt-4 space-y-3">
              {HOME_BAD.map((h) => (
                <li
                  key={h}
                  className="flex gap-3 text-base leading-7 text-forest/70"
                >
                  <span
                    aria-hidden="true"
                    className="mt-2.5 size-1.5 shrink-0 rounded-full bg-gold"
                  />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </div>

          <h3 className="mt-8 font-display text-2xl font-semibold text-forest">
            If you are printing at home, these five things
          </h3>
          <ul className="mt-5 space-y-3">
            {HOME_RULES.map((r) => (
              <li
                key={r}
                className="flex gap-3 text-base leading-7 text-forest/70"
              >
                <span
                  aria-hidden="true"
                  className="mt-2.5 size-1.5 shrink-0 rounded-full bg-gold"
                />
                <span>{r}</span>
              </li>
            ))}
          </ul>

          <p className="mt-6 text-base leading-8 text-forest/70">
            There is a middle path worth knowing about. FedEx Office self-service
            printers accept a file by email, from cloud storage, or on a USB
            drive, and hand you a retrieval code at the machine. Those printers
            cannot take paper you bring from home, but they include a standard
            paper option at no extra cost, and FedEx Office says you can buy
            approved paper options from a team member before you use the
            machine if you want a different stock. That gets you a
            shop-quality double-sided print without waiting for a full-service
            queue, and you fold them yourself.
          </p>
          <SourceList
            sources={[
              {
                label: "FedEx Office self-service printing and Print and Go",
                url: "https://www.office.fedex.com/default/services",
              },
            ]}
          />
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
            If what you are missing is the file itself
          </h2>
          <p className="mt-3 text-base leading-7 text-forest/70">
            Everything above works whether or not you ever buy anything from
            us, and the Word templates stay free. But the hardest part of this
            is often not finding a printer, it is producing a print-ready file
            at midnight with the panels imposed correctly. TributeReady asks a
            few questions about the person and returns a finished PDF laid out
            for a bifold, for a one-time $34.99. No subscription. Take that PDF
            to any of the shops on this page.
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
            {RELATED.map((l) => (
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
