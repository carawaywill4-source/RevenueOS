import assert from "node:assert/strict";
import test from "node:test";
import {
  customerFeedbackSchema,
  growthEventSchema,
} from "../src/lib/growth";
import { eulogyTemplates } from "../src/lib/eulogy-templates";
import {
  funeralReadings,
  permissionNeeded,
} from "../src/lib/funeral-readings";
import { createMemorialPdf } from "../src/lib/memorial-pdf";
import { createLocalDraft } from "../src/lib/memorial-writing";
import { obituaryTemplates } from "../src/lib/obituary-templates";
import { orderOfServiceTemplates } from "../src/lib/order-of-service-templates";
import { resourceGuides } from "../src/lib/resources";

test("growth events accept only categorical allowlisted metadata", () => {
  const sessionId = "5a67bb0d-297d-45a6-b613-0358c2ef9902";
  assert.equal(
    growthEventSchema.safeParse({
      sessionId,
      name: "landing_view",
      metadata: {
        page: "home",
        source: "curlship",
        medium: "referral",
        referrerHost: "curlship.com",
      },
    }).success,
    true,
  );
  assert.equal(
    growthEventSchema.safeParse({
      sessionId,
      name: "landing_view",
      metadata: {
        page: "home",
        referrerHost: "https://example.com/private/path",
      },
    }).success,
    false,
  );
  assert.equal(
    growthEventSchema.safeParse({
      sessionId,
      name: "checkout_started",
      metadata: { theme: "garden", hasPhoto: true },
    }).success,
    true,
  );
  assert.equal(
    growthEventSchema.safeParse({
      sessionId,
      name: "checkout_started",
      metadata: {
        theme: "garden",
        hasPhoto: true,
        memorialName: "Private name",
      },
    }).success,
    false,
  );
});

test("customer feedback rejects free text", () => {
  const result = customerFeedbackSchema.safeParse({
    sessionId: "5a67bb0d-297d-45a6-b613-0358c2ef9902",
    type: "cancellation",
    reason: "too_expensive",
    comment: "private detail",
  });
  assert.equal(result.success, false);
});

test("local memorial fallback is grounded in supplied details", () => {
  const draft = createLocalDraft({
    name: "Eleanor Bennett",
    relationship: "Grandparent",
    qualities: "Warm, observant",
    memories: "She placed the first spring rose in a blue glass.",
    saying: "There is room for one more.",
  });
  const text = Object.values(draft).join(" ");
  assert.match(text, /Eleanor Bennett|first spring rose|room for one more/i);
  assert.doesNotMatch(text, /surrounded by family|gained their wings/i);
});

test("the resource library contains nine unique substantial guides", () => {
  assert.equal(resourceGuides.length, 9);
  assert.equal(new Set(resourceGuides.map((guide) => guide.slug)).size, 9);
  for (const guide of resourceGuides) {
    assert.ok(guide.sections.length >= 3);
  }
});

test("template libraries are unique and substantial", () => {
  assert.equal(
    new Set(obituaryTemplates.map((template) => template.slug)).size,
    obituaryTemplates.length,
  );
  const exampleBodies = new Set<string>();
  for (const template of obituaryTemplates) {
    assert.ok(template.fillIn.length >= 5);
    assert.equal(template.examples.length, 2);
    assert.ok(template.faqs.length >= 3);
    for (const example of template.examples) {
      const body = example.paragraphs.join(" ");
      assert.equal(exampleBodies.has(body), false);
      exampleBodies.add(body);
    }
  }

  assert.equal(
    new Set(orderOfServiceTemplates.map((template) => template.slug)).size,
    orderOfServiceTemplates.length,
  );
  for (const template of orderOfServiceTemplates) {
    assert.ok(template.steps.length >= 6);
    assert.ok(template.wording.lines.length >= 4);
  }
});

test("eulogy examples are distinct and delivery-length", () => {
  assert.equal(
    new Set(eulogyTemplates.map((template) => template.slug)).size,
    eulogyTemplates.length,
  );
  const bodies = new Set<string>();
  for (const template of eulogyTemplates) {
    const body = template.example.paragraphs.join(" ");
    assert.equal(bodies.has(body), false);
    bodies.add(body);
    const words = body.split(/\s+/).length;
    assert.ok(words >= 300 && words <= 800, `${template.slug}: ${words} words`);
    const claimed = Number(template.example.words.replace(/\D+/g, "").slice(0, 3));
    assert.ok(
      Math.abs(claimed - words) <= 15,
      `${template.slug}: label claims ${claimed}, actual ${words}`,
    );
    assert.equal(template.openings.length, 4);
    assert.ok(template.faqs.length >= 3);
  }
});

test("every published reading names a source and a rights basis", () => {
  assert.equal(
    new Set(funeralReadings.map((reading) => reading.id)).size,
    funeralReadings.length,
  );
  for (const reading of funeralReadings) {
    assert.ok(reading.lines.length >= 3);
    assert.match(reading.rights, /public domain/i);
    assert.match(reading.source.url, /^https:\/\//);
  }
  const published = new Set(
    funeralReadings.map((reading) => reading.title.toLowerCase()),
  );
  for (const restricted of permissionNeeded) {
    assert.equal(published.has(restricted.title.toLowerCase()), false);
  }
});

test("fictional bifold collection renders as a PDF", async () => {
  const pdf = await createMemorialPdf(
    "Eleanor Bennett",
    {
      heading: "Sunday roses by the kitchen window",
      obituary:
        "Eleanor made room for people at her table. Her family remembers Sunday dinners, handwritten recipes, and the roses she tended beside the kitchen window.",
      remembrance:
        "Each spring, the first rose went into a small blue glass beside the sink.",
      closing: "Keep a place for kindness",
    },
    {
      name: "Eleanor Bennett",
      birthYear: "1942",
      passingYear: "2026",
      relationship: "Grandparent",
      qualities: "Warm, observant",
      memories: "Sunday dinners and spring roses.",
      saying: "There is room for one more.",
      serviceDetails: "",
      programFormat: "bifold",
      serviceTitle: "A celebration of life",
      serviceDate: "September 12 at 11:00 a.m.",
      serviceLocation: "Willow Garden Hall",
      orderOfService: "Welcome\nReading\nWords of remembrance\nClosing music",
      readingOrPoem: "May ordinary kindness continue to call her to mind.",
      acknowledgments: "Thank you for every kindness shared.",
      theme: "garden",
    },
  );
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  assert.ok(pdf.byteLength > 5_000);
});

test("word program templates are valid, editable .docx files", async () => {
  const {
    createBifoldProgramDocx,
    createSingleSheetProgramDocx,
    createTraditionProgramDocx,
    findTraditionTemplate,
  } = await import("../src/lib/program-docx");

  const catholic = findTraditionTemplate("catholic-funeral-mass");
  assert.ok(catholic, "expected the catholic template to exist");

  const files = [
    await createBifoldProgramDocx(),
    await createSingleSheetProgramDocx(),
    await createTraditionProgramDocx(catholic),
  ];

  for (const file of files) {
    // A .docx is a zip archive; every one starts with the PK local file header.
    assert.equal(file.subarray(0, 2).toString(), "PK");
    assert.ok(file.byteLength > 3_000);
    // The word/document.xml entry name is stored uncompressed in the archive
    // directory, so it is findable in the raw bytes of a valid package.
    assert.ok(
      file.includes(Buffer.from("word/document.xml")),
      "expected a word/document.xml part",
    );
    assert.ok(
      file.includes(Buffer.from("[Content_Types].xml")),
      "expected a content types part",
    );
  }

  assert.ok(
    findTraditionTemplate("not-a-real-tradition") === undefined,
    "unknown slugs must not resolve",
  );
});

test("cliche scrubbing never mangles a sentence or edits the family's words", async () => {
  const { polishMemorialDraft, createLocalDraft } = await import(
    "../src/lib/memorial-writing"
  );

  // A celebration of life is a kind of service, not a cliche. Deleting the
  // phrase broke the product the /celebration-of-life-program page sells.
  const celebration = polishMemorialDraft(
    {
      heading: "A celebration of life for Mary",
      obituary: "The family will hold a celebration of life on Saturday.",
      remembrance: "She planted sweet peas along the back fence every March.",
      closing: "Well, we'll see.",
    },
    { name: "Mary" },
  );
  assert.match(celebration.heading, /celebration of life/i);
  assert.match(celebration.obituary, /celebration of life/i);

  // A banned phrase takes its whole sentence with it, leaving readable prose
  // rather than the fragments blind deletion used to produce.
  const scrubbed = polishMemorialDraft(
    {
      heading: "She kept a jar of pencils any child could take from",
      obituary:
        "Ruth taught fourth grade for thirty-one years. She will be deeply missed by her students. She retired to Galway in 1998.",
      remembrance: "The pencils were always sharpened.",
      closing: "Sharpened, always",
    },
    { name: "Ruth" },
  );
  assert.doesNotMatch(scrubbed.obituary, /deeply missed/i);
  assert.match(scrubbed.obituary, /thirty-one years/);
  assert.match(scrubbed.obituary, /Galway in 1998/);
  assert.doesNotMatch(scrubbed.obituary, /\bShe by\b/);

  // Whatever the family typed is reproduced verbatim, cliche or not.
  const memories =
    "He called home every Sunday at six. He will be deeply missed by everyone on that street.";
  const local = createLocalDraft({ name: "Tom", memories });
  assert.equal(local.remembrance, memories);
});

test("outreach cannot be sent without an opt-out and a postal address", async () => {
  const { outreachIsConfigured, buildFooter, sendOutreach } = await import(
    "../src/lib/outreach"
  );

  const original = process.env.OUTREACH_POSTAL_ADDRESS;
  process.env.RESEND_API_KEY ||= "test";
  process.env.RESEND_FROM_EMAIL ||= "delivery@tributeready.org";
  process.env.RESEND_SUPPRESSION_AUDIENCE_ID ||= "test-audience";
  process.env.OUTREACH_UNSUBSCRIBE_SECRET ||= "test-secret";

  // Missing postal address must block sending outright, not warn.
  delete process.env.OUTREACH_POSTAL_ADDRESS;
  assert.equal(outreachIsConfigured(), false);
  const blocked = await sendOutreach({
    to: "someone@example.com",
    subject: "x",
    paragraphs: ["y"],
  });
  assert.deepEqual(blocked, { sent: false, reason: "not_configured" });

  process.env.OUTREACH_POSTAL_ADDRESS = "1 Example Street, Somewhere, ST 00000";
  assert.equal(outreachIsConfigured(), true);

  // Every message carries both required elements and a signed opt-out link.
  const footer = buildFooter("someone@example.com");
  assert.match(footer.text, /1 Example Street/);
  assert.match(footer.html, /1 Example Street/);
  assert.match(footer.url, /\/unsubscribe\?e=[^&]+&t=[0-9a-f]{64}$/);

  if (original === undefined) delete process.env.OUTREACH_POSTAL_ADDRESS;
  else process.env.OUTREACH_POSTAL_ADDRESS = original;
});

test("printed documents keep their page count across the full input range", async () => {
  const { createMemorialPdf } = await import("../src/lib/memorial-pdf");
  type MemorialDetails = Parameters<typeof createMemorialPdf>[2];

  const pages = (pdf: Buffer) =>
    (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;

  // A 1x1 PNG is enough; the layout reserves a fixed box whatever the image is.
  const photo =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

  // Ceilings come from the draft schema in src/app/api/generate/route.ts.
  // Anything longer cannot reach the renderer, so this is the true worst case.
  const fill = (source: string, length: number) =>
    source.repeat(60).slice(0, length).trim();
  const maxName = fill("Bartholomew Maximilian Fitzgerald Montgomery ", 100);
  const maxDraft = {
    heading: fill("A life measured in small kindnesses nobody wrote down ", 90),
    obituary: fill("She taught fourth grade for thirty-one years in one room. ", 1800),
    remembrance: fill("The pencils in the jar were always sharpened for anyone. ", 700),
    closing: fill("Loved beyond the telling of it and remembered every day. ", 120),
  };

  const details: MemorialDetails = {
    name: maxName,
    birthYear: "1938",
    passingYear: "2026",
    relationship: "grandmother",
    qualities: "steady",
    memories: "Shortbread in the bottom drawer.",
    saying: "We'll see.",
    serviceDetails: "St Anne's",
    serviceTitle: "A Service of Thanksgiving and Remembrance",
    serviceDate: "Saturday 15 August 2026, 11:00am",
    serviceLocation:
      "The Cathedral Church of Saint Anne and All the Blessed Martyrs, Lower Bridgetown",
    orderOfService: Array.from({ length: 16 }, (_, i) => `Order item ${i + 1}`).join("\n"),
    readingOrPoem: "Psalm 23, read by her eldest granddaughter",
    acknowledgments: "The family thanks everyone who cared for her. ".repeat(8),
    theme: "garden",
    programFormat: "bifold",
  };

  // A bifold folds into four panels. Five pages cannot be folded at all.
  for (const theme of ["garden", "classic", "sky"] as const) {
    const pdf = await createMemorialPdf(
      maxName,
      maxDraft,
      { ...details, theme },
      photo,
    );
    assert.equal(pages(pdf), 4, `bifold overflowed on the ${theme} theme`);
  }

  // The keepsake format is sold as a single sheet, plus the two cards.
  const keepsake = await createMemorialPdf(
    maxName,
    maxDraft,
    { ...details, programFormat: "keepsake" },
    photo,
  );
  assert.equal(pages(keepsake), 3, "keepsake ran onto a second sheet");

  // A three-part name and a heading over fifty characters are both ordinary,
  // and each used to add a page on its own.
  const ordinary = await createMemorialPdf(
    "Christopher Alexander Wainwright",
    {
      heading: "A life measured in small kindnesses that nobody wrote down",
      obituary: "He taught fourth grade for thirty-one years.",
      remembrance: "The pencils were always sharpened.",
      closing: "With love.",
    },
    { ...details, name: "Christopher Alexander Wainwright" },
    photo,
  );
  assert.equal(pages(ordinary), 4);

  // The floor: almost nothing supplied, and no photograph.
  const minimal = await createMemorialPdf(
    "Jo",
    {
      heading: "Jo Ann",
      obituary: "x".repeat(80),
      remembrance: "y".repeat(40),
      closing: "Love.",
    },
    { ...details, name: "Jo", programFormat: "bifold" },
  );
  assert.equal(pages(minimal), 4);
});
