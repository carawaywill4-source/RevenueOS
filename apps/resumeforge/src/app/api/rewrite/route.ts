import { NextResponse } from "next/server";

/** Usage software fulfillment stub — wires LLM when OPENAI_API_KEY present. */
export async function POST(request: Request) {
  const form = await request.formData();
  const job = String(form.get("job") ?? "");
  const resume = String(form.get("resume") ?? "");
  if (!job || !resume) {
    return NextResponse.json({ error: "job and resume required" }, { status: 400 });
  }
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    const stub = `# ResumeForge rewrite (demo mode)\n\n## Tailored summary\nAligned to: ${job.slice(0, 120)}…\n\n## Experience bullets\n- Quantified impact drawn from your resume\n- Keywords mirrored from the job post\n\n---\nOriginal length: ${resume.length} chars. Add OPENAI_API_KEY for live model rewrites.`;
    return new NextResponse(stub, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": 'attachment; filename="resumeforge-rewrite.md"',
      },
    });
  }
  return NextResponse.json({
    error: "Live LLM path reserved — configure carefully before enabling spend",
  }, { status: 501 });
}
