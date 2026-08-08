import {
  createTraditionProgramDocx,
  findTraditionTemplate,
} from "@/lib/program-docx";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const template = findTraditionTemplate(slug);
  if (!template) {
    return new Response("Not found", { status: 404 });
  }

  const file = await createTraditionProgramDocx(template);
  return new Response(new Uint8Array(file), {
    headers: {
      "Cache-Control": "public, max-age=86400",
      "Content-Disposition": `attachment; filename="${slug}-order-of-service.docx"`,
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
  });
}
