import { createSingleSheetProgramDocx } from "@/lib/program-docx";

export async function GET() {
  const file = await createSingleSheetProgramDocx();
  return new Response(new Uint8Array(file), {
    headers: {
      "Cache-Control": "public, max-age=86400",
      "Content-Disposition":
        'attachment; filename="funeral-order-of-service-template.docx"',
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
  });
}
