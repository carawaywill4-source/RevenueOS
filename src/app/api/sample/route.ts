import { createMemorialPdf } from "@/lib/memorial-pdf";

export async function GET() {
  const pdf = await createMemorialPdf(
    "Eleanor Rose Bennett",
    {
      heading: "Sunday roses and a place at the table",
      obituary:
        "Eleanor Bennett made room for people. Family remembers the Sunday dinners she prepared without fuss, the roses she tended beside the kitchen window, and the way she listened before offering one clear, practical thought. Her warmth was never showy; it lived in dependable calls, handwritten recipes, and the extra chair she kept ready.\n\nShe loved old jazz records, early mornings in the garden, and any gathering that ended with coffee at the table. Those ordinary rituals became the shape of home for the people who knew her.",
      remembrance:
        "Every spring, Eleanor cut the first rose from the garden and placed it in a small blue glass by the sink. It was her quiet announcement that warmer days had returned.",
      closing: "Keep a place for kindness",
    },
    {
      name: "Eleanor Rose Bennett",
      birthYear: "1942",
      passingYear: "2026",
      relationship: "Grandparent",
      qualities: "Warm, observant, generous",
      memories: "Sunday dinners and the first rose of spring.",
      saying: "There is always room for one more.",
      serviceDetails: "",
      programFormat: "bifold",
      serviceTitle: "A celebration of Eleanor's life",
      serviceDate: "Saturday, September 12 · 11:00 a.m.",
      serviceLocation: "Willow Garden Hall",
      orderOfService:
        "Welcome and opening music\nReading by a family friend\nWords of remembrance\nPhoto reflection\nClosing gratitude",
      readingOrPoem:
        "May the ordinary things she loved—morning light, a tended garden, and a table shared—continue to call her gently to mind.",
      acknowledgments:
        "Our family is grateful for every visit, story, meal, and kindness shared with Eleanor and with us.",
      theme: "garden",
    },
  );

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Disposition":
        'inline; filename="tributeready-fictional-sample.pdf"',
      "Content-Type": "application/pdf",
    },
  });
}
