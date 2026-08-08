import type { Metadata } from "next";
import { IntentLanding } from "@/components/intent-landing";

const TITLE = "Obituary Writer: A First Draft Built From Your Own Memories";
const DESCRIPTION =
  "An obituary writer that asks about the person instead of handing you a blank template. It invents nothing, you rewrite every line before paying anything, and the finished wording is yours to submit anywhere.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/obituary-writer" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/obituary-writer",
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
    heading: "Why the blank page is the hard part",
    paragraphs: [
      "Almost nobody has written an obituary before, and it arrives at the worst possible moment: within a day or two of the death, often with a newspaper deadline attached, and usually landing on whoever in the family seems most capable that week.",
      "The instinct is to reach for the phrases we have all read a thousand times. Passed away peacefully surrounded by family. Will be dearly missed by all who knew them. There is nothing wrong with those sentences, but a page of them describes no one in particular, and families often feel that when they read it back.",
      "What makes an obituary sound like a person is specificity. Thirty-one years running the same school office. A tin of shortbread in the bottom drawer. The thing they always said when a plan fell apart. Those details cannot be generated from nothing, which is why this asks you for them rather than guessing.",
    ],
  },
  {
    heading: "What it asks, and what comes back",
    paragraphs: [
      "There is no blank page and no formatting to fight. You answer a short set of plain questions — their name, the years, your relationship to them, three words that describe them, one memory you keep returning to, and anything they often said. Only the name and that one memory really matter; the rest is optional.",
      "What comes back is a draft in four parts: an opening line, the life story in two or three short paragraphs, a remembrance built around the memory you chose, and a closing inscription short enough to print on a card. Each part is an editable text box, so you can rewrite a phrase, replace a paragraph, or delete the draft and type your own.",
      "Obituary writer, obituary generator, obituary template — people search for all three meaning much the same thing. The difference that matters is whether you are handed a blank form to fill in or a draft to react to, and reacting to a draft is far easier than starting cold.",
    ],
  },
  {
    heading: "It does not make things up, and you must still check it",
    paragraphs: [
      "This matters more here than almost anywhere else, so it is worth being direct. The writing model is explicitly instructed not to invent relatives, dates, causes of death, religious beliefs, military service, jobs, or accomplishments. If you did not say your mother was religious, no religious language appears. If you did not give a cause of death, none is guessed at. Stock phrases are filtered out before the text reaches your screen.",
      "None of that makes the draft correct. Verify every name and spelling, the dates, and above all the list of surviving family, which is the single most common source of hurt feelings in a published obituary. The draft is a first pass written by a machine. You are the person who actually knew them.",
    ],
  },
  {
    heading: "Length, and what newspapers charge for",
    paragraphs: [
      "Newspapers typically bill by the line or the column inch, and a long obituary in a metropolitan paper can cost several hundred dollars. That surprises many families. Ask the paper for its rate and word count before you write to a length.",
      "A funeral home will often submit the notice for you, sometimes with the placement cost inside their charges and sometimes not — ask which. If cost is a concern, a short paid notice in the paper alongside a fuller version in the program and on a memorial page is a common and perfectly dignified arrangement.",
    ],
    links: [
      {
        href: "/obituary-templates",
        label: "Free obituary templates and examples",
      },
      {
        href: "/resources/how-to-write-an-obituary",
        label: "How to write an obituary",
      },
    ],
  },
  {
    heading: "What $34.99 covers, and what happens after you pay",
    paragraphs: [
      "The wording itself is yours whether you pay or not. There is no licence, watermark, or attribution requirement, and you can copy the finished draft off the screen and submit it anywhere.",
      "What $34.99 buys is the collection built around it: the obituary laid into a print-ready program with the order of service, a 5 by 7 inch memorial card, a matching thank-you card, and a private memorial page. One payment, no subscription, no per-copy charge. The same wording flows into all of them, so the phrasing stays consistent rather than being retyped three times at midnight.",
      "After payment the collection is emailed to the address you gave at checkout as a single PDF, with the link to the memorial page. We do not publish a delivery time, because we would rather not promise one we cannot keep. If it has not arrived, or the files do not match the preview you approved, write to care@tributeready.org and we will correct them.",
    ],
  },
];

const INCLUDED = [
  {
    title: "The finished obituary",
    copy: "A complete draft in four parts, edited by you, ready to submit to a paper or read aloud.",
  },
  {
    title: "A print-ready program",
    copy: "The same wording laid into a four-panel bifold with the order of service. US Letter, folded once.",
  },
  {
    title: "Memorial and thank-you cards",
    copy: "Two 5 by 7 inch keepsakes, including the thank-you note that comes afterwards, already worded.",
  },
  {
    title: "A private memorial page",
    copy: "The photograph, story, and remembrance at an unlisted link, with a QR code you can download.",
  },
];

const STEPS = [
  {
    title: "About them",
    copy: "Their full name, the years, your relationship, and a photograph if you have one. Only the name is required.",
  },
  {
    title: "Their story",
    copy: "Three words that describe them, one memory you keep returning to, and anything they used to say.",
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
  heading: "Four ways to get the obituary written",
  intro:
    "We publish free obituary templates ourselves, so we have no reason to pretend the alternatives do not exist.",
  options: [
    {
      name: "A free obituary template",
      cost: "Free",
      bestWhen:
        "You know what you want to say and only need a structure to hang it on. Ours give fill-in wording for a mother, father, grandparent, spouse, child, or sibling, each with two worked examples.",
      tradeoff:
        "A template cannot supply the specific detail that makes the piece sound like them, and that is the part most people are stuck on at eleven at night.",
    },
    {
      name: "Letting the funeral home write it",
      cost: "Varies by home",
      bestWhen:
        "You would rather hand it over. They write these constantly, know the local paper's format, and will usually handle submission.",
      tradeoff:
        "It is written by someone who did not know them, so it tends toward the standard phrasing. We make no claim about what any funeral home charges — ask whether writing and placement are included.",
    },
    {
      name: "Hiring a writer",
      cost: "Varies",
      bestWhen:
        "The life was complicated, or long, or you want an interviewer to draw the story out of the family rather than a form.",
      tradeoff:
        "Finding someone good within a two-day deadline is the difficulty, and a good one will still need the same specific memories from you.",
    },
    {
      name: "TributeReady",
      cost: "$34.99, once",
      bestWhen:
        "You want a real first draft from your own details in a few minutes, and you want the program and cards to carry the same wording. You read and edit everything before paying.",
      tradeoff:
        "It is only as good as what you put in. Three adjectives and no memory will produce a draft that reads like three adjectives and no memory.",
    },
  ],
  note: "You can write the whole obituary here, read it, and edit every word without paying or making an account. Payment applies only to the print-ready collection. If that is not what you need, take the free templates and keep your money.",
};

const RELATED = [
  {
    href: "/obituary-templates",
    title: "Free obituary templates",
    copy: "Fill-in wording for each relationship, with two worked examples apiece.",
  },
  {
    href: "/resources/how-to-write-an-obituary",
    title: "How to write an obituary",
    copy: "Structure, what to include, and the mistakes that cause family friction.",
  },
  {
    href: "/resources/obituary-family-order",
    title: "What order family members go in",
    copy: "Surviving and predeceased lists, blended families, and when to count instead of naming everyone.",
  },
  {
    href: "/eulogy-examples",
    title: "Eulogy examples",
    copy: "Full eulogies written to be read aloud, timed for delivery.",
  },
  {
    href: "/funeral-readings",
    title: "Funeral poems and readings",
    copy: "Public-domain poems and scripture in full, with the copyright status of each stated plainly.",
  },
];

const QUESTIONS = [
  {
    question: "Is there a free obituary writer?",
    answer:
      "You can answer the questions, read the complete draft, and edit every word without paying or creating an account. Payment applies only to the print-ready collection. Our obituary templates are also free and complete, with two worked examples for each relationship and nothing held back for a paid tier.",
  },
  {
    question: "Will it sound like it was written by a machine?",
    answer:
      "The draft is written by a language model from your answers alone, and the interchangeable phrases — passed away peacefully, surrounded by family, gained their wings — are filtered out before you see it. What keeps it from sounding generic is the specific memory you give it. Then you edit every line, so the last voice on the page is yours.",
  },
  {
    question: "Does it invent missing information?",
    answer:
      "No. It is explicitly instructed not to invent facts, relatives, religious beliefs, causes of death, or life events, and anything you do not provide simply does not appear. You should still verify every name, date, and spelling before publishing, particularly the list of surviving family.",
  },
  {
    question: "How long should an obituary be?",
    answer:
      "Most run between 200 and 500 words. Newspapers usually charge by the line or column inch, so length has a direct cost; ask the paper for its rate before writing to a length. Versions for the program and the memorial page have no such limit.",
  },
  {
    question: "Can I use the obituary outside TributeReady?",
    answer:
      "Yes. The final wording is yours, with no licence or attribution requirement. Use it for a newspaper submission, the funeral home, the service program, a family email, or a memorial page.",
  },
  {
    question: "What should I leave out of an obituary?",
    answer:
      "Leave out the home address of a house that is now empty, the full date of birth, a mother's maiden name, and other details useful for identity theft or a burglary during the service. It is also wise to agree the list of surviving relatives with the family before anything is published.",
  },
  {
    question: "Is what I type private?",
    answer:
      "While you write, the draft is stored only in your own browser, expires after seven days, and can be cleared with a button in the builder. If you buy the collection, the memorial page sits behind a long unlisted link that search engines are told not to index, though anyone holding that link can open it. Card details go directly to Stripe.",
  },
];

export default function ObituaryWriterPage() {
  return (
    <IntentLanding
      page="obituary"
      path="/obituary-writer"
      breadcrumb="Obituary writer"
      eyebrow="Guided obituary writer"
      title="Their life,"
      accent="in words that feel true."
      description="A good obituary is built from specific memories, not stock phrases. TributeReady asks a few plain questions, writes only from what you give it, and hands you a full draft you can rewrite line by line before deciding whether to pay for anything."
      benefits={[
        "A complete first draft, not a blank template",
        "No invented relatives, dates, beliefs, or events",
        "Every sentence editable before anything is charged",
        "Wording that is yours to reuse anywhere",
        "Program and keepsake cards carrying the same text",
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
