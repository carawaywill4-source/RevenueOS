import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  PageOrientation,
  Packer,
  Paragraph,
  TabStopType,
  TextRun,
} from "docx";
import {
  orderOfServiceTemplates,
  type OrderOfServiceTemplate,
} from "@/lib/order-of-service-templates";

const BODY_FONT = "Georgia";
const HEADING_FONT = "Georgia";

/**
 * Placeholders are wrapped in square brackets so a grieving family can find
 * every field to replace with Word's own Find command rather than reading the
 * whole document looking for what is still blank.
 */
const FIND_HINT =
  "Every field you need to replace is written inside [square brackets]. " +
  "Press Ctrl+H (Cmd+Shift+H on a Mac) and search for [ to jump between them.";

function heading(text: string, size = 32) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 120 },
    children: [
      new TextRun({
        text,
        bold: true,
        font: HEADING_FONT,
        size,
      }),
    ],
  });
}

function centered(text: string, opts: { italics?: boolean; size?: number } = {}) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [
      new TextRun({
        text,
        italics: opts.italics ?? false,
        font: BODY_FONT,
        size: opts.size ?? 22,
      }),
    ],
  });
}

function body(text: string, opts: { italics?: boolean } = {}) {
  return new Paragraph({
    spacing: { after: 100 },
    children: [
      new TextRun({
        text,
        italics: opts.italics ?? false,
        font: BODY_FONT,
        size: 22,
      }),
    ],
  });
}

function rule() {
  return new Paragraph({
    spacing: { before: 80, after: 160 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: "999999", space: 1 },
    },
    children: [new TextRun({ text: "", size: 2 })],
  });
}

/**
 * A service step printed as "Name .......... detail", using a right tab stop so
 * the detail stays aligned after the family retypes the step names.
 */
function stepLine(name: string, detail?: string) {
  return new Paragraph({
    spacing: { after: 60 },
    tabStops: [{ type: TabStopType.RIGHT, position: 4200 }],
    children: [
      new TextRun({ text: name, bold: true, font: BODY_FONT, size: 22 }),
      ...(detail
        ? [
            new TextRun({ text: "\t", font: BODY_FONT, size: 22 }),
            new TextRun({
              text: detail,
              italics: true,
              font: BODY_FONT,
              size: 20,
              color: "555555",
            }),
          ]
        : []),
    ],
  });
}

function guidanceFooter() {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text:
              "Free template from tributeready.org — edit freely, no credit required.",
            font: BODY_FONT,
            size: 16,
            color: "888888",
          }),
        ],
      }),
    ],
  });
}

/**
 * Instruction block placed on its own page. Word users open the file and start
 * typing over the first thing they see, so the guidance has to sit somewhere it
 * can be deleted in one action rather than interleaved with the program itself.
 */
function instructionPage(title: string, notes: string[]) {
  return [
    heading(title, 30),
    body(
      "This page is instructions only. Delete this entire page before printing: " +
        "click at the very start of this page, hold Shift, and click at the end of " +
        "the page break below.",
    ),
    rule(),
    body(FIND_HINT),
    ...notes.map((n) => body(`• ${n}`)),
    body(
      "This template is free to use, edit, print, and share. You do not need to " +
        "credit TributeReady and you do not need permission. If you would rather not " +
        "format it yourself, tributeready.org can build a finished print-ready program " +
        "for a one-time $34.99 — but nothing here requires that.",
      { italics: true },
    ),
    new Paragraph({ children: [], pageBreakBefore: true }),
  ];
}

/**
 * Bifold: one landscape sheet, two columns, folded down the middle. Column one
 * is the back cover and column two is the front cover on sheet one, which is
 * the imposition families get wrong most often when they build this themselves.
 */
export async function createBifoldProgramDocx(): Promise<Buffer> {
  const doc = new Document({
    creator: "TributeReady",
    title: "Funeral Program Template (Bifold)",
    description:
      "Free editable bifold funeral program template for Microsoft Word.",
    sections: [
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.PORTRAIT },
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        footers: { default: guidanceFooter() },
        children: instructionPage("How to use this bifold program template", [
          "This is a bifold: one sheet of 8.5 x 11 paper printed on both sides and folded once down the middle, giving four panels.",
          "Print double-sided, flipping on the SHORT edge. Flipping on the long edge will print the inside upside down.",
          "Print one copy first and fold it before printing the rest. This catches almost every mistake.",
          "Panel order is already handled below. Sheet one holds the back cover on the left and the front cover on the right, which looks wrong on screen and correct once folded.",
          "A common count is one program per two attendees, plus twenty spare. People take them home.",
        ]),
      },
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.LANDSCAPE },
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
          column: { count: 2, space: 720, equalWidth: true },
        },
        footers: { default: guidanceFooter() },
        children: [
          // Panel 4 - back cover
          centered("Acknowledgment", { size: 26 }),
          rule(),
          body(
            "The family of [Full Name] wishes to thank you for your kindness, " +
              "your prayers, and your presence today. Your support has meant more " +
              "than we are able to say.",
          ),
          body(""),
          centered("[Optional: closing verse, poem, or prayer]", {
            italics: true,
          }),
          body(""),
          centered("Reception to follow at", { italics: true }),
          centered("[Venue name]"),
          centered("[Street address]"),
          body(""),
          centered("[Funeral home name]", { italics: true }),
          centered("[City, State]", { italics: true }),
          new Paragraph({ children: [], pageBreakBefore: false }),

          // Panel 1 - front cover
          new Paragraph({
            children: [new TextRun({ text: "", break: 1 })],
          }),
          centered("In Loving Memory of", { italics: true, size: 24 }),
          heading("[Full Name]", 40),
          centered("[Month Day, Year] — [Month Day, Year]", { size: 24 }),
          body(""),
          centered("[Insert photograph here:", { italics: true }),
          centered("Insert > Pictures, then right-click and choose", {
            italics: true,
          }),
          centered("Wrap Text > In Line with Text]", { italics: true }),
          body(""),
          body(""),
          centered("[Service name, for example", { italics: true }),
          centered("A Celebration of Life]", { italics: true }),
          body(""),
          centered("[Day, Month Day, Year]"),
          centered("[Time]"),
          centered("[Place of service]"),
          centered("[City, State]"),
        ],
      },
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.LANDSCAPE },
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
          column: { count: 2, space: 720, equalWidth: true },
        },
        footers: { default: guidanceFooter() },
        children: [
          // Panel 2 - order of service
          centered("Order of Service", { size: 26 }),
          rule(),
          stepLine("Prelude", "[Musician or recording]"),
          stepLine("Welcome", "[Officiant name]"),
          stepLine("Opening Prayer", "[Name]"),
          stepLine("Hymn", "[Title]"),
          stepLine("Scripture Reading", "[Passage — Reader]"),
          stepLine("Reflection", "[Name]"),
          stepLine("Eulogy", "[Name]"),
          stepLine("Musical Selection", "[Title — Performer]"),
          stepLine("Remarks from Family", "[Name]"),
          stepLine("Closing Prayer", "[Name]"),
          stepLine("Recessional", "[Title]"),
          body(""),
          centered("Interment", { size: 24 }),
          centered("[Cemetery name]"),
          centered("[City, State]"),
          body(""),
          centered("Pallbearers", { size: 24 }),
          centered("[Name] · [Name] · [Name]"),
          centered("[Name] · [Name] · [Name]"),
          body(""),
          centered("Honorary Pallbearers", { size: 24 }),
          centered("[Name] · [Name] · [Name]"),

          // Panel 3 - life / obituary
          centered("Life of [First Name]", { size: 26 }),
          rule(),
          body(
            "[First Name] was born on [date] in [place] to [parents' names]. " +
              "[One or two sentences on childhood, family, and where they grew up.]",
          ),
          body(
            "[Education, military service, working life, and the things they were " +
              "known for. Name the specific job, the specific years, and the specific " +
              "place — this is what people remember.]",
          ),
          body(
            "[Marriage, children, grandchildren. Include dates and full names, " +
              "including maiden names, since this page is often kept for genealogy.]",
          ),
          body(
            "[The part only your family can write: what they were like in a room, " +
              "what they always said, what they did every Sunday. One concrete habit " +
              "is worth more than five adjectives.]",
          ),
          body(
            "[First Name] is survived by [names and relationships]. They were " +
              "preceded in death by [names and relationships].",
          ),
          body(""),
          centered("[Optional: favorite verse, poem, or saying]", {
            italics: true,
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

/**
 * Single-sheet order of service, one page, no folding. This is what people
 * actually need when the service is tomorrow morning.
 */
export async function createSingleSheetProgramDocx(): Promise<Buffer> {
  const doc = new Document({
    creator: "TributeReady",
    title: "Funeral Order of Service Template (Single Sheet)",
    description:
      "Free editable single-sheet funeral order of service template for Microsoft Word.",
    sections: [
      {
        properties: {
          page: { margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } },
        },
        footers: { default: guidanceFooter() },
        children: [
          ...instructionPage("How to use this single-sheet template", [
            "This is one page, printed on one side. No folding and no double-sided printing, which makes it the safest choice when the service is tomorrow.",
            "Print on slightly heavier paper if you can — 28lb or a light card stock feels considerably better in the hand than standard copier paper and costs very little more.",
            "If you want a photograph, put it directly under the name: Insert > Pictures, then right-click, Wrap Text, In Line with Text.",
          ]),
          centered("In Loving Memory of", { italics: true, size: 24 }),
          heading("[Full Name]", 44),
          centered("[Month Day, Year] — [Month Day, Year]", { size: 24 }),
          rule(),
          centered("[Service name, for example A Celebration of Life]", {
            italics: true,
          }),
          centered("[Day, Month Day, Year] at [Time]"),
          centered("[Place of service] · [City, State]"),
          body(""),
          heading("Order of Service", 28),
          stepLine("Prelude", "[Musician or recording]"),
          stepLine("Welcome", "[Officiant name]"),
          stepLine("Opening Prayer", "[Name]"),
          stepLine("Hymn", "[Title]"),
          stepLine("Scripture Reading", "[Passage — Reader]"),
          stepLine("Eulogy", "[Name]"),
          stepLine("Musical Selection", "[Title — Performer]"),
          stepLine("Remarks from Family and Friends", ""),
          stepLine("Closing Prayer", "[Name]"),
          stepLine("Recessional", "[Title]"),
          body(""),
          heading("Pallbearers", 26),
          centered("[Name] · [Name] · [Name] · [Name] · [Name] · [Name]"),
          body(""),
          heading("Interment", 26),
          centered("[Cemetery name] · [City, State]"),
          body(""),
          rule(),
          body(
            "The family of [Full Name] thanks you for your kindness, your prayers, " +
              "and your presence today.",
            { italics: true },
          ),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

/**
 * Tradition-specific order of service, generated from the same verified step
 * sequences the site publishes as HTML, so the Word file and the web page can
 * never drift apart.
 */
export async function createTraditionProgramDocx(
  template: OrderOfServiceTemplate,
): Promise<Buffer> {
  const doc = new Document({
    creator: "TributeReady",
    title: `${template.title} (Word)`,
    description: template.description,
    sections: [
      {
        properties: {
          page: { margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } },
        },
        footers: { default: guidanceFooter() },
        children: [
          ...instructionPage(`How to use the ${template.shortTitle} template`, [
            `Typical length: ${template.duration}.`,
            "Confirm the order with your officiant, parish, or funeral director before printing. Traditions vary between congregations and this template cannot know yours.",
            ...template.notes.slice(0, 3),
          ]),
          centered("In Loving Memory of", { italics: true, size: 24 }),
          heading("[Full Name]", 40),
          centered("[Month Day, Year] — [Month Day, Year]", { size: 24 }),
          rule(),
          centered(template.shortTitle, { italics: true }),
          centered("[Day, Month Day, Year] at [Time]"),
          centered("[Place of service] · [City, State]"),
          body(""),
          heading("Order of Service", 28),
          ...template.steps.map((step) =>
            stepLine(step.name, step.minutes ? `${step.minutes}` : ""),
          ),
          body(""),
          heading("Notes for the family", 26),
          ...template.steps
            .filter((s) => s.detail)
            .map((s) =>
              body(`${s.name}: ${s.detail}`, { italics: true }),
            ),
          body(""),
          rule(),
          body(
            "The family of [Full Name] thanks you for your kindness, your prayers, " +
              "and your presence today.",
            { italics: true },
          ),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

export function findTraditionTemplate(slug: string) {
  return orderOfServiceTemplates.find((t) => t.slug === slug);
}
