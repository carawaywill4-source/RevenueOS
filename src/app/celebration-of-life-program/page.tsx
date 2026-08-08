import type { Metadata } from "next";
import { IntentLanding } from "@/components/intent-landing";

const TITLE =
  "Celebration of Life Program: Order of Service, Wording, and Ideas";
const DESCRIPTION =
  "Build a celebration of life program when there is no liturgy to follow. A flexible order of service, wording you can copy for every panel, and a print-ready PDF with matching keepsake cards for $34.99 — read and edited in full before you pay.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/celebration-of-life-program" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/celebration-of-life-program",
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
    heading: "Why this program has more work to do than a funeral bulletin",
    paragraphs: [
      "A funeral has a form to lean on. A celebration of life does not, so the family decides the sequence, the length, and who speaks — usually within a few days and usually while barely sleeping.",
      "That puts real weight on the printed program. At a church service the congregation already knows roughly what comes next; here nobody does. The program is the only thing in the room telling a guest when to sit, who is about to speak, whether they will be invited to speak themselves, and when it ends. It is also the object people take home, which matters more here, because a celebration of life is often the only printed record of someone who chose not to have a traditional service.",
    ],
  },
  {
    heading: "Building the order of service when there is nothing to follow",
    paragraphs: [
      "The arrangement that works most reliably is a clear beginning, a defined middle where people speak, and an unmistakable ending. Almost everything else is negotiable.",
    ],
    bullets: [
      "Have someone other than immediate family host. Grief makes hosting difficult, and the host is the one who has to close things gracefully.",
      "Decide before you print whether sharing is open to everyone or by invitation. It is the choice that most changes how long the gathering runs.",
      "Name each speaker on the page, with what they are speaking about. Naming people in print keeps everyone honest about length in a way that keep it short never does.",
      "Put the music in by title. Music the person actually liked, named on the page, sets the tone faster than any amount of careful wording.",
      "Give the reception its own line on the back panel, and say specifically that there is food. Guests do not know whether they are allowed to stay.",
    ],
    note: "Twelve lines is usually plenty for the order itself, which is what the layout accepts. If your sequence runs past twelve items, ask whether two can be combined — a gathering with fifteen segments is a gathering that overruns.",
    links: [
      {
        href: "/order-of-service-templates/celebration-of-life",
        label: "Full outline with timings, free",
      },
    ],
  },
  {
    heading: "Celebration of life wording you can copy",
    paragraphs: [
      "The hardest lines are the first and the last. These come from our free celebration of life template, which carries the full version with timings. Replace the brackets and change anything that does not sound like your family.",
    ],
    bullets: [
      "Cover — A Celebration of the Life of [Full Name], then the years, then the venue, date, and time. Keep the name the largest thing on the panel.",
      "Welcome — Thank you for being here. Today is not only about how we lost [Name]. It is about how much of [them] we still carry.",
      "Invitation to share — If you would like to say something, please come forward when invited. We ask that you keep to about two minutes, so everyone who wishes to speak is able to.",
      "Back cover — Please join us afterwards at [place] for food and more stories. In place of flowers, the family asks that you consider a gift to [organization].",
    ],
    note: "None of this has to be religious. TributeReady adds no religious language unless you supply it, so a program can be secular, spiritual, traditional, or entirely personal without you stripping anything back out of a draft.",
    links: [
      { href: "/funeral-readings", label: "Poems you may legally print" },
      { href: "/eulogy-examples", label: "Eulogy examples, timed for delivery" },
    ],
  },
  {
    heading: "Holding one months or years later",
    paragraphs: [
      "A celebration of life often follows a death by months and sometimes by decades — a scattering of ashes once the family can travel, an anniversary, a gathering after a private cremation, or a grandchild writing a life down before the people who remember it are gone.",
      "Nothing here assumes a recent death. The date fields take years rather than exact dates, the order of service is optional, and you can leave the service details empty and still receive the memorial sheet, the cards, and the private page.",
    ],
  },
  {
    heading: "What $34.99 covers, and what happens next",
    paragraphs: [
      "One payment covers the whole collection for one person: the program or a single memorial sheet, a 5 by 7 inch keepsake card, a matching thank-you card, and a private memorial page. No subscription and no per-copy charge — worth knowing here, because a celebration of life often draws a wider crowd than a funeral and families frequently print more than they first planned.",
      "Nothing is charged while you build it. Answer the questions, read the entire draft, rewrite whatever you want, and decide at the end.",
      "The finished collection is emailed to the address you enter at checkout as one PDF, with the private link beside it. We do not publish a delivery time, because we would rather not promise one we cannot keep. For relatives who could not travel, that private page is often the more useful half of what you bought.",
    ],
  },
];

const INCLUDED = [
  {
    title: "The celebration of life program",
    copy: "A four-panel bifold: the cover, the order of the gathering, their story and a remembrance, and the family's thanks. US Letter, folded once.",
  },
  {
    title: "Or a single memorial sheet",
    copy: "One portrait page with the photograph, story, remembrance, and closing, and no order of service. You choose one format or the other, not both.",
  },
  {
    title: "Two keepsake cards",
    copy: "A 5 by 7 inch card carrying their name and the opening line, and a matching thank-you card, already worded.",
  },
  {
    title: "A private memorial page",
    copy: "The photograph, story, and remembrance at an unlisted link search engines are asked not to index, with a QR code you can download.",
  },
];

const STEPS = [
  {
    title: "About them",
    copy: "Their full name, the years, your relationship, and a photograph if you have one. Only the name is required.",
  },
  {
    title: "Their story",
    copy: "Three words that describe them, one memory you keep returning to, anything they used to say, and the order of the gathering.",
  },
  {
    title: "Design",
    copy: "Three quiet designs — Quiet Garden, Timeless, and Open Sky. None are sombre by default and none add religious imagery.",
  },
  {
    title: "Preview",
    copy: "The whole draft appears in four editable boxes. Payment is only requested from this screen.",
  },
];

const COMPARISON = {
  heading: "Four ways to produce a celebration of life program",
  intro:
    "A celebration of life is usually organized by a family rather than a funeral director, which means this choice lands on you. Two of these options cost nothing.",
  options: [
    {
      name: "A free order of service template",
      cost: "Free",
      bestWhen:
        "You are confident about the sequence and only need a layout. Ours has the full running order with timings, sample wording for every panel, and a Word file you can type straight into.",
      tradeoff:
        "The writing about the person is still yours to do, and that is usually the slow part. Watch the fold as well: a bifold's panels do not print in reading order, so a template can be filled in perfectly and still come out wrong.",
    },
    {
      name: "The venue, celebrant, or funeral home",
      cost: "Varies",
      bestWhen:
        "Somebody is already coordinating the day and will carry the printing with it. A celebrant has run dozens of these and can tell you what tends to overrun.",
      tradeoff:
        "The designs and deadlines are theirs. Many venues do not print at all and a celebrant is not a designer, so ask early rather than assuming it is covered. We make no claim about what any of them charge.",
    },
    {
      name: "Hiring a designer",
      cost: "Varies",
      bestWhen:
        "There is time, the person had a strong visual life, and you want something that looks like them rather than like a category.",
      tradeoff:
        "Time, again. These gatherings are often scheduled around when relatives can fly, so the date moves — exactly the sort of thing that makes bespoke work expensive.",
    },
    {
      name: "TributeReady",
      cost: "$34.99, once",
      bestWhen:
        "You want the wording and the printed pieces to come out of one set of answers, and you want to read every line before paying anything.",
      tradeoff:
        "There are three designs rather than thirty, and the order of service holds up to twelve lines. If you want an eight-page booklet with full hymn texts and a photo spread, this is not the right tool and we would rather say so now.",
    },
  ],
  note: "If you already know exactly what the day looks like and only need a layout, take the free template and keep your money. It is complete, unwatermarked, and there is no email form standing in front of it.",
  downloads: [
    {
      href: "/api/word/order-of-service/celebration-of-life",
      label: "Celebration of life Word template",
    },
  ],
};

const RELATED = [
  {
    href: "/order-of-service-templates",
    title: "Order of service templates",
    copy: "Seven complete outlines with realistic timing, including a celebration of life and a non-denominational service.",
  },
  {
    href: "/eulogy-examples",
    title: "Eulogy examples",
    copy: "Full eulogies written to be said out loud, timed for delivery.",
  },
  {
    href: "/funeral-readings",
    title: "Poems and readings",
    copy: "Public-domain poems and scripture in full, with the copyright status of every one stated plainly.",
  },
  {
    href: "/where-to-print-funeral-programs",
    title: "Where to print a program",
    copy: "Same-day counters with their published cutoffs, and which paper to choose.",
  },
];

const QUESTIONS = [
  {
    question: "How is a celebration of life different from a funeral?",
    answer:
      "A funeral usually happens within days, follows a religious or established form, and often has the body present. A celebration of life can be weeks or months later, is typically less formal, and is organized around remembering the person rather than around a rite. Many families hold both.",
  },
  {
    question: "Do we need a program for a celebration of life?",
    answer:
      "It is not required, but it does two useful things: it tells guests what will happen, so nobody is anxious about when to speak or when it ends, and it becomes the thing people take home. A single folded sheet is enough.",
  },
  {
    question: "Does the program have to be religious?",
    answer:
      "No. TributeReady adds no religious language unless you supply it, so there is nothing to strip out afterwards. The same program can be secular, spiritual, traditional, or entirely personal.",
  },
  {
    question: "What should the order of service include?",
    answer:
      "A workable sequence is gathering music, a welcome, an opening reading, the life story, music, two to four invited tributes, a bounded period of open sharing, a slideshow, closing words, and closing music with the reception announced. You type it one line per item, up to twelve lines. Confirm the sequence with whoever is hosting before you print.",
  },
  {
    question: "Should we allow open sharing?",
    answer:
      "Open sharing produces the moments families remember, and it also makes the length impossible to predict. The usual compromise is two to four invited speakers followed by a bounded open period, with the host ready to close it warmly. Decide before you print, because the program is what tells guests which one it is.",
  },
  {
    question: "Can I create this years after someone died?",
    answer:
      "Yes. Nothing in the process assumes a recent death. Anniversaries, gatherings after a private cremation, a scattering of ashes once family can travel, and family history projects all work the same way, and the service details can be left blank entirely.",
  },
  {
    question: "Can family members share the memorial page?",
    answer:
      "The page uses a private, unguessable link and search engines are told not to index it. Anyone who receives that link can open it, so share it only with people you trust. There is also a QR code you can download if that is easier than passing a link around a room.",
  },
  {
    question: "Can I print the program myself?",
    answer:
      "Yes, and there is no per-copy charge, now or later. It is US Letter, printed double-sided and folded once, and the flip has to be on the short edge or the inside prints upside down. Print one and fold it before running the rest.",
  },
];

export default function CelebrationOfLifeProgramPage() {
  return (
    <IntentLanding
      page="celebration"
      path="/celebration-of-life-program"
      breadcrumb="Celebration of life program"
      eyebrow="Celebration of life program"
      title="Remember the person,"
      accent="not just the date."
      description="A celebration of life has no liturgy to lean on, which leaves the printed program doing most of the work. Write the order of the gathering, the stories, and the music into something guests can follow — and read every line of it before you pay."
      benefits={[
        "A program built around stories, music, and people",
        "An order of the gathering you write yourself",
        "No religious language unless you supply it",
        "Suits a gathering next week or an anniversary years on",
        "Keepsake and thank-you cards in the same PDF",
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
