import { createPartnerGuidePdf } from "@/lib/partner-guide-pdf";

export async function GET() {
  const pdf = await createPartnerGuidePdf();
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Disposition":
        'attachment; filename="tributeready-family-resource-guide.pdf"',
      "Content-Type": "application/pdf",
    },
  });
}
