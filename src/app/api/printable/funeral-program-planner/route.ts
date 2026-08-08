import { createProgramPlannerPdf } from "@/lib/printables-pdf";

export async function GET() {
  const pdf = await createProgramPlannerPdf();
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Cache-Control": "public, max-age=86400",
      "Content-Disposition":
        'attachment; filename="tributeready-funeral-program-planner.pdf"',
      "Content-Type": "application/pdf",
    },
  });
}
