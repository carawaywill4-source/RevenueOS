import { createObituaryWorksheetPdf } from "@/lib/printables-pdf";

export async function GET() {
  const pdf = await createObituaryWorksheetPdf();
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Cache-Control": "public, max-age=86400",
      "Content-Disposition":
        'attachment; filename="tributeready-obituary-worksheet.pdf"',
      "Content-Type": "application/pdf",
    },
  });
}
