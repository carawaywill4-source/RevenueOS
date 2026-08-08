import type { Metadata } from "next";
import { IntentLanding } from "@/components/intent-landing";

const TITLE = "Funeral Program Maker: Write It, Edit It, Print It Today";
const DESCRIPTION =
  "An online funeral program maker that writes the wording with you instead of handing you a blank template. Read and edit the whole draft before paying $34.99, then print the PDF at home or at any print counter. No design software.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/funeral-program-maker" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/funeral-program-maker",
    siteName: "TributeReady",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

const SECTIONS = [
  {
    heading: "What $34.99 buys, and what happens after you pay",
    paragraphs: [
      "One payment covers the finished collection for one person: a print-ready program, two keepsake cards, and a private memorial page. No subscription, no per-copy charge, and no second charge if you print the same files again next year.",
      "Nothing is due while you write. You can answer every question, read the complete draft, rewrite any of it, and close the tab without paying.",
      "After payment the collection is emailed to the address you gave at checkout as a single PDF, with the link to the memorial page. We do not publish a delivery time, because we would rather not promise one we cannot keep. If it has not arrived, write to care@tributeready.org.",
    ],
  },
  {
    heading: "Do I need design software, or any design skill?",
    paragraphs: [
      "No, and funeral program software is a bad thing to start learning this week.",
      "A bifold is one sheet printed on both sides and folded once, giving four panels — but those panels do not print in reading order. The back cover has to sit beside the front cover on one side of the sheet. Design software will let you get that wrong, and so will a template. You find out after a hundred copies.",
      "TributeReady arranges the panels for you. Each one arrives already in position, with a faint fold guide and the printing instruction set on the sheet itself. It happens in the browser: nothing to install, no fonts to buy, no account to create.",
      "Maker, creator, generator, designer — people type all of these meaning the same thing. What separates them is how much of the writing they leave to you.",
    ],
  },
  {
    heading: "What goes in the four panels",
    paragraphs: [
      "The order is the one most families expect, and it is fixed, so it is one less decision.",
    ],
    bullets: [
      "Front cover — their name, the years, a photograph if you have one, and the service title, date, and place.",
      "Inside left — their story, then a short remembrance built around the memory you chose. A reading or poem goes here too.",
      "Inside right — the order of service, typed one item per line, up to twelve lines.",
      "Back cover — the family's acknowledgment and the closing line. Leave the acknowledgment blank and a plain thank-you is used instead.",
    ],
    note: "If a full order of service is more than you need, choose the single-sheet memorial version: one portrait page carrying the name, dates, photograph, story, remembrance, and closing. You pick one format or the other, not both.",
    links: [
      {
        href: "/order-of-service-templates",
        label: "Free order of service outlines",
      },
      { href: "/obituary-templates", label: "Free obituary templates" },
    ],
  },
  {
    heading: "Will it sound generic, or obviously written by a machine?",
    paragraphs: [
      "The first draft is written by a language model, and we are not going to pretend otherwise. What it is given is deliberately narrow: only the details you typed. It is instructed not to invent dates, relatives, beliefs, or events, and the phrases that make memorial writing interchangeable — passed away peacefully, surrounded by family, gained their wings — are filtered out before the text reaches your screen.",
      "It cannot know anything you did not tell it, which is the point rather than the limitation. A draft built from she kept a jar of pencils on her desk that any child could take from reads like a person. A draft built from three adjectives reads like three adjectives.",
      "Then you edit it. The opening line, the life story, the remembrance, and the closing are plain editable text boxes on the preview screen. Checking every name, date, and relationship is your job rather than the software's, and our terms say the same.",
    ],
  },
  {
    heading: "If the service is tomorrow",
    paragraphs: [
      "Work backwards from the printer. The files are print-ready the moment they arrive, so what constrains you is the counter's cutoff — at the chains that generally means getting the file in by early afternoon.",
      "Ask for document or copy printing with a folding finish, not booklet printing: a four-panel bifold falls below the page minimum most shops apply to booklets, and asking for the wrong product is the commonest reason a family is told to come back tomorrow. Ask to see one folded copy before they run the rest. If the day is genuinely against you, take the single-sheet version, because removing the fold removes the part that goes wrong.",
    ],
    links: [
      {
        href: "/where-to-print-funeral-programs",
        label: "Print counters, cutoffs, and paper",
      },
    ],
  },
];

const INCLUDED = [
  {
    title: "The program, print-ready",
    copy: "Two US Letter sheets in landscape. Printed double-sided and folded once, they become the four-panel program at 5.5 by 8.5 inches.",
  },
  {
    title: "Two keepsake cards",
    copy: "A 5 by 7 inch memorial card carrying their name and the opening line, and a matching thank-you card, already worded.",
  },
  {
    title: "A private memorial page",
    copy: "The photograph, story, and remembrance at an unlisted link you can text or email, with a QR code you can download.",
  },
  {
    title: "The wording itself",
    copy: "Yours to reuse in a eulogy, a newspaper notice, or a message to relatives who could not travel.",
  },
];

const STEPS = [
  {
    title: "About them",
    copy: "Their full name, the years, your relationship, and a photograph if you have one. Only the name is required.",
  },
  {
    title: "Their story",
    copy: "Three words that describe them, one memory you keep returning to, anything they used to say, and the order of service.",
  },
  {
    title: "Design",
    copy: "Three quiet designs — Quiet Garden, Timeless, and Open Sky — each built to stay readable in print.",
  },
  {
    title: "Preview",
    copy: "The full draft appears in four editable boxes. Payment is only requested from this screen.",
  },
];

const COMPARISON = {
  heading: "Four ways to get a program, compared fairly",
  intro:
    "We publish free templates ourselves, so we have no reason to pretend the alternatives do not exist.",
  options: [
    {
      name: "A free Word or Canva template",
      cost: "Free",
      bestWhen:
        "You already know roughly what you want to say. Our bifold .docx has the panels imposed correctly, so the cover lands in the right place after folding.",
      tradeoff:
        "The blank page is still yours to fill, and it is usually the writing rather than the layout that people get stuck on. Export a PDF before you leave the house, or the shop's machine may substitute the fonts.",
    },
    {
      name: "The funeral home's printed folders",
      cost: "Varies by home",
      bestWhen:
        "They are already printing something, know the local printers, and will take the job off your hands.",
      tradeoff:
        "You choose from their designs and work to their deadline for final wording. We make no claim about what any funeral home charges — ask the price, and ask whether you may supply your own file.",
    },
    {
      name: "Hiring a designer",
      cost: "Varies",
      bestWhen:
        "The design genuinely matters, there is time, and you want something nobody else has.",
      tradeoff:
        "Turnaround. Someone working through a weekend is doing you a favor rather than selling you a service, and briefing them carefully while grieving is its own kind of work.",
    },
    {
      name: "TributeReady",
      cost: "$34.99, once",
      bestWhen:
        "The wording is the part you are stuck on, the service is close, and you want the printing question already solved. You read and edit every line before paying.",
      tradeoff:
        "You are paying for something you could assemble yourself with a free template and a quiet evening. If you have that evening, take the template.",
    },
  ],
  note: "If all you need is a blank layout, download the Word file and keep your money. It is complete, unwatermarked, and needs no email address. What we sell is the writing and the assembly, not the file format.",
  downloads: [
    {
      href: "/api/word/bifold-funeral-program",
      label: "Bifold Word template",
    },
    {
      href: "/api/word/single-sheet-order-of-service",
      label: "Single-sheet Word template",
    },
  ],
};

const RELATED = [
  {
    href: "/funeral-program-template-word",
    title: "Editable Word templates",
    copy: "Bifold and single-sheet .docx files with the panels already imposed.",
  },
  {
    href: "/order-of-service-templates",
    title: "Order of service templates",
    copy: "Outlines with realistic timing for Catholic, Baptist, military, graveside, and memorial services.",
  },
  {
    href: "/where-to-print-funeral-programs",
    title: "Where to print a program",
    copy: "Same-day counters with their published cutoffs, and which paper to choose.",
  },
  {
    href: "/funeral-program-cost",
    title: "Funeral program cost",
    copy: "What drives the bill — design, copies, paper, rush — without invented retail prices.",
  },
  {
    href: "/funeral-program-examples",
    title: "Funeral program examples",
    copy: "Annotated panels and three common shapes, with a fictional sample PDF.",
  },
  {
    href: "/funeral-readings",
    title: "Poems and readings you may print",
    copy: "Public-domain poems and scripture in full, with the copyright status of each stated plainly.",
  },
];

const QUESTIONS = [
  {
    question: "Is there a free funeral program maker?",
    answer:
      "You can write the whole program, read the finished draft, and edit every word without paying or creating an account; payment is only asked for if you want the print-ready files. Our editable Word templates are free outright — no signup, no watermark, nothing withheld for a paid tier.",
  },
  {
    question: "Can I change the wording it generates?",
    answer:
      "Yes, and most families should. The opening line, the life story, the remembrance, and the closing are editable text boxes before checkout. Rewrite a phrase, replace a paragraph, or delete the draft and type your own. Nothing is charged or shared until you approve it.",
  },
  {
    question: "What size is the program, and how do I print it?",
    answer:
      "US Letter, printed double-sided and folded once to a finished 5.5 by 8.5 inches. Print at actual size rather than fit to page, and flip on the short edge — flipping on the long edge prints the inside upside down. A text-weight paper around 28 to 32 pound is a sensible default.",
  },
  {
    question: "Do I need a photograph?",
    answer:
      "No, it is optional at every stage. Without one the cover centers the name, the years, and the opening line, and the layout closes up rather than leaving a gap. A JPG, PNG, or WebP up to 8 MB is resized automatically, so a picture straight off your phone is fine.",
  },
  {
    question: "Can I print it myself?",
    answer:
      "Yes, and there is no per-copy charge, now or later. Home printing works well for a short run of a light, mostly text design. It works badly for a dark full-page background, for more than about a hundred copies, and at eleven at night before a morning service.",
  },
  {
    question: "Is my family's information private?",
    answer:
      "While you write, the draft is stored only in your own browser, expires after seven days, and can be cleared from the builder. The memorial page sits behind a long unlisted link that search engines are told not to index, but anyone holding that link can open it. Card details go directly to Stripe.",
  },
  {
    question: "What if something is wrong with the files?",
    answer:
      "Email care@tributeready.org. If there is a technical defect, or the files do not match the preview you approved, we will correct them and send them again. Because each collection is customized for one person, purchases are otherwise generally non-refundable after delivery. The full wording is in our terms.",
  },
  {
    question: "Does TributeReady arrange or conduct funerals?",
    answer:
      "No. TributeReady writes and lays out memorial documents. It is not a funeral home, is not affiliated with any funeral home, and does not arrange services or sell funeral goods.",
  },
];

export default function FuneralProgramMakerPage() {
  return (
    <IntentLanding
      page="funeral_program"
      path="/funeral-program-maker"
      breadcrumb="Funeral program maker"
      eyebrow="Online funeral program maker"
      title="A beautiful program,"
      accent="ready to print."
      description="Share the service details and the memories you already carry. TributeReady shapes them into a clear, printable program — cover, order of service, their story, and a closing word — that you read and edit in full before you pay."
      benefits={[
        "A four-panel bifold, imposed and ready to fold",
        "Every line editable before anything is charged",
        "Memorial and thank-you cards in the same PDF",
        "A private, unlisted memorial page for distant family",
        "One payment, no subscription, no account",
      ]}
      sections={SECTIONS}
      included={INCLUDED}
      steps={STEPS}
      comparison={COMPARISON}
      related={RELATED}
      questions={QUESTIONS}
    />
  );
}
