import { createBifoldProgramDocx } from "@/lib/program-docx";

export async function GET() {
  const file = await createBifoldProgramDocx();
  return new Response(new Uint8Array(file), {
    headers: {
      "Cache-Control": "public, max-age=86400",
      "Content-Disposition":
        'attachment; filename="funeral-program-template-bifold.docx"',
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
  });
}
