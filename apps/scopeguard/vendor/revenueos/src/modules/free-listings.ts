/**
 * Zero-cost local / visual listing limbs.
 *
 * These are NOT spend-match "free ad credits". They are genuinely free
 * promotional surfaces (GBP posts, Bing Places, Apple Business Connect,
 * Nextdoor Business, Yelp owner posts, YouTube Shorts) that appear in ranked
 * feeds and local search.
 *
 * Default mode is DRAFT — LLM-authored copy saved for owner paste or for the
 * browser sidecar. Never throws. Never requires a card on file.
 */

import { callOpenAI, hasOpenAIKey } from "./openai-client";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type FreeListingResult =
  | {
      ok: true;
      status: "drafted" | "executed";
      detail: string;
      url?: string;
      draftPath?: string;
    }
  | { ok: false; reason: string };

export type FreeListingDraftInput = {
  rootDir: string;
  siteId: string;
  productName: string;
  productUrl: string;
  productDescription?: string;
  brandVoice?: string;
  audience?: string;
  locationHint?: string;
};

function dataDir(rootDir: string, platform: string): string {
  if (process.env.VERCEL || process.env.REVENUEOS_DATA_DIR) {
    const base = process.env.REVENUEOS_DATA_DIR || "/tmp/revenueos";
    return path.join(base, "free-listings", platform);
  }
  return path.join(rootDir, ".data", "free-listings", platform);
}

async function saveDraft(
  rootDir: string,
  platform: string,
  siteId: string,
  draft: Record<string, unknown>,
): Promise<string> {
  const dir = dataDir(rootDir, platform);
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${siteId}-${Date.now()}.json`);
  await writeFile(file, JSON.stringify({ ...draft, savedAt: new Date().toISOString() }, null, 2));
  return file;
}

async function draftCopy(input: {
  platform: string;
  productName: string;
  productUrl: string;
  productDescription?: string;
  brandVoice?: string;
  audience?: string;
  locationHint?: string;
  format: string;
}): Promise<{ title: string; body: string } | { error: string }> {
  if (!hasOpenAIKey()) {
    return {
      title: `${input.productName} — free update`,
      body: `${input.productDescription ?? input.productName}\n\n${input.productUrl}`,
    };
  }
  const res = await callOpenAI<{ title: string; body: string }>({
    messages: [
      {
        role: "system",
        content:
          "You write short, truthful, non-spammy posts for free business listing surfaces. No fake urgency, no purchased-ad claims, no misleading offers. Soft product mention only if relevant. Keep under 120 words unless format says Shorts script.",
      },
      {
        role: "user",
        content: JSON.stringify({
          platform: input.platform,
          format: input.format,
          product: {
            name: input.productName,
            url: input.productUrl,
            description: input.productDescription ?? "",
          },
          brandVoice: input.brandVoice ?? "clear, practical",
          audience: input.audience ?? "target buyers",
          locationHint: input.locationHint ?? null,
        }),
      },
    ],
    jsonSchema: {
      type: "object",
      additionalProperties: false,
      required: ["title", "body"],
      properties: {
        title: { type: "string", minLength: 4, maxLength: 80 },
        body: { type: "string", minLength: 20, maxLength: 2000 },
      },
    },
    timeoutMs: 25_000,
  });
  if (!res.ok || !res.data) {
    return {
      title: `${input.productName} — update`,
      body: `${input.productDescription ?? input.productName}\n\n${input.productUrl}`,
    };
  }
  return res.data;
}

function envPresent(key: string): boolean {
  const v = process.env[key];
  return typeof v === "string" && v.trim().length > 0;
}

export function hasGbpWriteCreds(): boolean {
  return envPresent("GOOGLE_SERVICE_ACCOUNT_JSON");
}

export function hasBingPlacesCreds(): boolean {
  return envPresent("BING_PLACES_TOKEN") || envPresent("BING_WEBMASTER_API_KEY");
}

export function hasAppleBusinessCreds(): boolean {
  return (
    envPresent("APPLE_BUSINESS_TEAM_ID") &&
    envPresent("APPLE_BUSINESS_KEY_ID") &&
    envPresent("APPLE_BUSINESS_PRIVATE_KEY")
  );
}

export function hasNextdoorSession(): boolean {
  return envPresent("NEXTDOOR_SESSION_COOKIE");
}

export function hasYelpApiKey(): boolean {
  return envPresent("YELP_API_KEY");
}

function hasShortsOauthToken(): boolean {
  return envPresent("YOUTUBE_OAUTH_TOKEN");
}

/** Google Business Profile post — draft by default; SA write when location access exists. */
export async function executeGbpPost(
  input: FreeListingDraftInput,
): Promise<FreeListingResult> {
  try {
    const copy = await draftCopy({
      platform: "google_business_profile",
      format: "GBP UPDATE/OFFER post",
      productName: input.productName,
      productUrl: input.productUrl,
      productDescription: input.productDescription,
      brandVoice: input.brandVoice,
      audience: input.audience,
      locationHint: input.locationHint,
    });
    if ("error" in copy) return { ok: false, reason: copy.error };
    const draftPath = await saveDraft(input.rootDir, "gbp", input.siteId, {
      action: "gbp_post",
      pasteAt: "https://business.google.com/locations",
      ...copy,
      productUrl: input.productUrl,
    });
    if (!hasGbpWriteCreds()) {
      return {
        ok: true,
        status: "drafted",
        detail: `gbp_post drafted for owner paste at Google Business Profile (${draftPath})`,
        draftPath,
        url: "https://business.google.com/locations",
      };
    }
    // Live GBP API posts require location-scoped Manager access on the SA —
    // keep draft until that is confirmed; do not pretend we posted.
    return {
      ok: true,
      status: "drafted",
      detail:
        "gbp_post drafted — GOOGLE_SERVICE_ACCOUNT_JSON present but location Manager grant not verified; owner paste required",
      draftPath,
      url: "https://business.google.com/locations",
    };
  } catch (err) {
    return { ok: false, reason: (err as Error).message.slice(0, 160) };
  }
}

export async function executeGbpQaAnswer(
  input: FreeListingDraftInput & { question?: string },
): Promise<FreeListingResult> {
  try {
    const copy = await draftCopy({
      platform: "google_business_profile",
      format: "GBP Q&A helpful answer",
      productName: input.productName,
      productUrl: input.productUrl,
      productDescription: input.question
        ? `Q: ${input.question}`
        : input.productDescription,
      brandVoice: input.brandVoice,
      audience: input.audience,
      locationHint: input.locationHint,
    });
    if ("error" in copy) return { ok: false, reason: copy.error };
    const draftPath = await saveDraft(input.rootDir, "gbp-qa", input.siteId, {
      action: "gbp_qa_answer",
      pasteAt: "https://business.google.com/locations",
      question: input.question ?? null,
      ...copy,
    });
    return {
      ok: true,
      status: "drafted",
      detail: `gbp_qa_answer drafted (${draftPath})`,
      draftPath,
      url: "https://business.google.com/locations",
    };
  } catch (err) {
    return { ok: false, reason: (err as Error).message.slice(0, 160) };
  }
}

export async function executeBingPlacesPost(
  input: FreeListingDraftInput,
): Promise<FreeListingResult> {
  try {
    const copy = await draftCopy({
      platform: "bing_places",
      format: "Bing Places business update",
      productName: input.productName,
      productUrl: input.productUrl,
      productDescription: input.productDescription,
      brandVoice: input.brandVoice,
      audience: input.audience,
      locationHint: input.locationHint,
    });
    if ("error" in copy) return { ok: false, reason: copy.error };
    const draftPath = await saveDraft(input.rootDir, "bing-places", input.siteId, {
      action: "bing_places_post",
      pasteAt: "https://www.bingplaces.com/",
      hasToken: hasBingPlacesCreds(),
      ...copy,
    });
    return {
      ok: true,
      status: "drafted",
      detail: hasBingPlacesCreds()
        ? `bing_places_post drafted (token present; Places write API still owner-paste) (${draftPath})`
        : `bing_places_post drafted — set BING_PLACES_TOKEN for write attempts (${draftPath})`,
      draftPath,
      url: "https://www.bingplaces.com/",
    };
  } catch (err) {
    return { ok: false, reason: (err as Error).message.slice(0, 160) };
  }
}

export async function executeAppleBusinessShowcase(
  input: FreeListingDraftInput,
): Promise<FreeListingResult> {
  try {
    const copy = await draftCopy({
      platform: "apple_business_connect",
      format: "Apple Business Connect showcase update",
      productName: input.productName,
      productUrl: input.productUrl,
      productDescription: input.productDescription,
      brandVoice: input.brandVoice,
      audience: input.audience,
      locationHint: input.locationHint,
    });
    if ("error" in copy) return { ok: false, reason: copy.error };
    const draftPath = await saveDraft(input.rootDir, "apple-business", input.siteId, {
      action: "apple_business_showcase",
      pasteAt: "https://businessconnect.apple.com/",
      hasCreds: hasAppleBusinessCreds(),
      ...copy,
    });
    return {
      ok: true,
      status: "drafted",
      detail: `apple_business_showcase drafted for Apple Business Connect (${draftPath})`,
      draftPath,
      url: "https://businessconnect.apple.com/",
    };
  } catch (err) {
    return { ok: false, reason: (err as Error).message.slice(0, 160) };
  }
}

export async function executeNextdoorBusinessPost(
  input: FreeListingDraftInput,
): Promise<FreeListingResult> {
  try {
    const copy = await draftCopy({
      platform: "nextdoor",
      format: "Nextdoor Business Page neighborhood post",
      productName: input.productName,
      productUrl: input.productUrl,
      productDescription: input.productDescription,
      brandVoice: input.brandVoice,
      audience: input.audience,
      locationHint: input.locationHint,
    });
    if ("error" in copy) return { ok: false, reason: copy.error };
    const draftPath = await saveDraft(input.rootDir, "nextdoor", input.siteId, {
      action: "nextdoor_business_post",
      pasteAt: "https://nextdoor.com/business-login/",
      hasSession: hasNextdoorSession(),
      ...copy,
    });
    // Sidecar path (optional): if SIDECAR_URL + NEXTDOOR_SESSION_COOKIE set.
    if (
      hasNextdoorSession() &&
      envPresent("SIDECAR_URL") &&
      envPresent("SIDECAR_TOKEN")
    ) {
      try {
        const res = await fetch(
          `${process.env.SIDECAR_URL!.replace(/\/$/, "")}/post/nextdoor`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Sidecar-Token": process.env.SIDECAR_TOKEN!,
            },
            body: JSON.stringify({
              title: copy.title,
              body: copy.body,
              productUrl: input.productUrl,
            }),
            signal: AbortSignal.timeout(45_000),
          },
        );
        if (res.ok) {
          const body = (await res.json().catch(() => ({}))) as { url?: string };
          return {
            ok: true,
            status: "executed",
            detail: "nextdoor_business_post executed via browser sidecar",
            url: body.url,
            draftPath,
          };
        }
      } catch {
        // fall through to draft
      }
    }
    return {
      ok: true,
      status: "drafted",
      detail: `nextdoor_business_post drafted for owner/sidecar paste (${draftPath})`,
      draftPath,
      url: "https://nextdoor.com/business-login/",
    };
  } catch (err) {
    return { ok: false, reason: (err as Error).message.slice(0, 160) };
  }
}

export async function executeYelpBusinessPost(
  input: FreeListingDraftInput,
): Promise<FreeListingResult> {
  try {
    const copy = await draftCopy({
      platform: "yelp",
      format: "Yelp for Business free owner post",
      productName: input.productName,
      productUrl: input.productUrl,
      productDescription: input.productDescription,
      brandVoice: input.brandVoice,
      audience: input.audience,
      locationHint: input.locationHint,
    });
    if ("error" in copy) return { ok: false, reason: copy.error };
    const draftPath = await saveDraft(input.rootDir, "yelp", input.siteId, {
      action: "yelp_business_post",
      pasteAt: "https://biz.yelp.com/",
      hasApiKey: hasYelpApiKey(),
      ...copy,
    });
    return {
      ok: true,
      status: "drafted",
      detail: `yelp_business_post drafted (${draftPath})`,
      draftPath,
      url: "https://biz.yelp.com/",
    };
  } catch (err) {
    return { ok: false, reason: (err as Error).message.slice(0, 160) };
  }
}

export async function executeYelpReviewResponse(
  input: FreeListingDraftInput & { reviewText?: string },
): Promise<FreeListingResult> {
  try {
    const copy = await draftCopy({
      platform: "yelp",
      format: "Yelp owner review response",
      productName: input.productName,
      productUrl: input.productUrl,
      productDescription: input.reviewText
        ? `Review: ${input.reviewText}`
        : input.productDescription,
      brandVoice: input.brandVoice,
      audience: input.audience,
    });
    if ("error" in copy) return { ok: false, reason: copy.error };
    const draftPath = await saveDraft(input.rootDir, "yelp-review", input.siteId, {
      action: "yelp_review_response",
      pasteAt: "https://biz.yelp.com/",
      reviewText: input.reviewText ?? null,
      ...copy,
    });
    return {
      ok: true,
      status: "drafted",
      detail: `yelp_review_response drafted (${draftPath})`,
      draftPath,
      url: "https://biz.yelp.com/",
    };
  } catch (err) {
    return { ok: false, reason: (err as Error).message.slice(0, 160) };
  }
}

export async function executeYoutubeShortsPublish(
  input: FreeListingDraftInput,
): Promise<FreeListingResult> {
  try {
    const copy = await draftCopy({
      platform: "youtube_shorts",
      format: "YouTube Shorts script (hook → value → soft CTA, ~45s spoken)",
      productName: input.productName,
      productUrl: input.productUrl,
      productDescription: input.productDescription,
      brandVoice: input.brandVoice,
      audience: input.audience,
    });
    if ("error" in copy) return { ok: false, reason: copy.error };
    const draftPath = await saveDraft(input.rootDir, "youtube-shorts", input.siteId, {
      action: "youtube_shorts_publish",
      pasteAt: "https://studio.youtube.com/",
      hasOauth: hasShortsOauthToken(),
      ...copy,
    });
    return {
      ok: true,
      status: "drafted",
      detail: hasShortsOauthToken()
        ? `youtube_shorts_publish script drafted — upload via Studio or OAuth upload not auto-wired yet (${draftPath})`
        : `youtube_shorts_publish script drafted — set YOUTUBE_OAUTH_TOKEN for upload attempts (${draftPath})`,
      draftPath,
      url: "https://studio.youtube.com/",
    };
  } catch (err) {
    return { ok: false, reason: (err as Error).message.slice(0, 160) };
  }
}

/** Test helper: load last draft for a platform/site if present. */
export async function __loadLatestDraft(
  rootDir: string,
  platform: string,
  siteId: string,
): Promise<Record<string, unknown> | null> {
  try {
    const dir = dataDir(rootDir, platform);
    const { readdir } = await import("node:fs/promises");
    const files = (await readdir(dir))
      .filter((f) => f.startsWith(`${siteId}-`) && f.endsWith(".json"))
      .sort();
    const last = files[files.length - 1];
    if (!last) return null;
    return JSON.parse(await readFile(path.join(dir, last), "utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}
