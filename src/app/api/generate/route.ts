import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  MEMORIAL_EDITOR_INSTRUCTIONS,
  createLocalDraft,
  polishMemorialDraft,
} from "@/lib/memorial-writing";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// Drafting has been observed between 20s and 50s. The model call is capped
// below this so the local-draft fallback always has room to run.
export const maxDuration = 60;

const requestSchema = z.object({
  name: z.string().trim().min(2).max(100),
  birthYear: z.string().trim().max(4),
  passingYear: z.string().trim().max(4),
  relationship: z.string().trim().max(40),
  qualities: z.string().trim().max(300),
  memories: z.string().trim().min(15).max(3000),
  saying: z.string().trim().max(300),
  serviceDetails: z.string().trim().max(1500),
  programFormat: z.enum(["bifold", "keepsake"]).optional(),
  serviceTitle: z.string().trim().max(120).optional(),
  serviceDate: z.string().trim().max(120).optional(),
  serviceLocation: z.string().trim().max(180).optional(),
  orderOfService: z.string().trim().max(2000).optional(),
  readingOrPoem: z.string().trim().max(1200).optional(),
  acknowledgments: z.string().trim().max(600).optional(),
  theme: z.enum(["garden", "classic", "sky"]),
});

const tributeSchema = z.object({
  heading: z.string().min(5).max(90),
  obituary: z.string().min(80).max(1800),
  remembrance: z.string().min(40).max(700),
  closing: z.string().min(5).max(120),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please add a name and at least one meaningful memory." },
      { status: 400 },
    );
  }

  const rateLimit = await checkRateLimit(request);
  if (rateLimit === "blocked") {
    return NextResponse.json(
      {
        error:
          "You have created several previews recently. Please wait ten minutes before trying again.",
      },
      { status: 429 },
    );
  }
  if (rateLimit === "unavailable") {
    return NextResponse.json(
      { error: "Preview generation is temporarily unavailable." },
      { status: 503 },
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ draft: createLocalDraft(parsed.data) });
  }

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 45_000,
      maxRetries: 0,
    });
    const response = await openai.responses.parse({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      store: false,
      instructions: MEMORIAL_EDITOR_INSTRUCTIONS,
      input: JSON.stringify(parsed.data),
      text: {
        format: zodTextFormat(tributeSchema, "memorial_tribute"),
      },
    });

    if (!response.output_parsed) {
      throw new Error("No structured tribute returned");
    }

    return NextResponse.json({
      draft: polishMemorialDraft(response.output_parsed, parsed.data),
    });
  } catch (error) {
    console.error("Tribute generation failed", error);
    return NextResponse.json({ draft: createLocalDraft(parsed.data) });
  }
}

async function checkRateLimit(request: Request) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return "allowed" as const;
  }

  try {
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || "unknown";
    const salt =
      process.env.RATE_LIMIT_SALT ||
      process.env.STRIPE_WEBHOOK_SECRET ||
      "local-development";
    const key = createHash("sha256").update(`${salt}:${ip}`).digest("hex");
    const { data, error } = await getSupabaseAdmin().rpc(
      "check_generation_limit",
      { p_key: key, p_limit: 5 },
    );
    if (error) return "unavailable" as const;
    return data ? ("allowed" as const) : ("blocked" as const);
  } catch {
    return "unavailable" as const;
  }
}
