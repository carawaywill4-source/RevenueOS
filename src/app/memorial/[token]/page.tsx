import { Download, Heart, Leaf, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getSupabaseAdmin,
  type MemorialDetails,
  type MemorialDraft,
} from "@/lib/supabase-admin";
import { resolveMemorialTheme } from "@/lib/memorial-themes";
import { MemorialShareActions } from "@/components/memorial-share-actions";
import { recordServerGrowthEvent } from "@/lib/growth";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "A private memorial",
  robots: { index: false, follow: false },
};

export default async function MemorialPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();

  let memorial:
    | {
        memorial_name: string;
        details: MemorialDetails;
        draft: MemorialDraft;
        photo_path: string | null;
        pdf_path: string | null;
        review_token: string;
        growth_session_id: string | null;
        status: string;
      }
    | null = null;
  let photoUrl: string | null = null;

  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from("orders")
      .select("memorial_name, details, draft, photo_path, pdf_path, review_token, growth_session_id, status")
      .eq("access_token", token)
      .eq("status", "fulfilled")
      .single();
    memorial = data;
    if (memorial?.photo_path) {
      const { data: signedPhoto } = await supabase.storage
        .from("memorial-photos")
        .createSignedUrl(memorial.photo_path, 60 * 60);
      photoUrl = signedPhoto?.signedUrl || null;
    }
  } catch {
    notFound();
  }

  if (!memorial) notFound();
  await recordServerGrowthEvent(memorial.growth_session_id, {
    name: "memorial_viewed",
  });
  const theme = resolveMemorialTheme(memorial.details.theme);
  const years = [memorial.details.birthYear, memorial.details.passingYear]
    .filter(Boolean)
    .join(" — ");

  return (
    <main className="botanical-glow soft-grid min-h-screen px-5 py-12 sm:px-8">
      <article
        className="paper-shadow relative mx-auto max-w-3xl overflow-hidden rounded-sm px-7 py-14 text-center sm:px-16 sm:py-20"
        style={{
          backgroundColor: theme.paper,
          color: theme.ink,
          borderTop: `8px solid ${theme.rule}`,
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-5 rounded-[2px] border"
          style={{ borderColor: theme.frame }}
        />
        <Leaf className="mx-auto" size={24} style={{ color: theme.accent }} />
        <p
          className="mt-7 text-[10px] font-bold uppercase tracking-[0.3em]"
          style={{ color: theme.gold }}
        >
          In loving memory
        </p>
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt={`Portrait of ${memorial.memorial_name}`}
            className="mx-auto mt-6 size-32 rounded-full border-4 object-cover shadow-lg sm:size-40"
            style={{ borderColor: theme.portraitRing }}
          />
        ) : null}
        <h1
          className="mt-5 font-display text-5xl font-semibold leading-none sm:text-7xl"
          style={{ color: theme.ink }}
        >
          {memorial.memorial_name}
        </h1>
        {years ? (
          <p
            className="mt-3 text-[10px] font-semibold tracking-[0.2em]"
            style={{ color: theme.inkMuted }}
          >
            {years}
          </p>
        ) : null}
        <p
          className="mx-auto mt-6 max-w-xl font-display text-2xl italic leading-8"
          style={{ color: theme.ink }}
        >
          “{memorial.draft.heading}”
        </p>
        <div
          className="mx-auto my-10 h-px w-16"
          style={{ backgroundColor: `${theme.gold}88` }}
        />
        <div
          className="mx-auto max-w-xl space-y-8 text-left text-sm leading-7 sm:text-base sm:leading-8"
          style={{ color: theme.inkMuted }}
        >
          <section>
            <h2
              className="mb-3 text-center text-[9px] font-bold uppercase tracking-[0.24em]"
              style={{ color: theme.gold }}
            >
              Their story
            </h2>
            <p>{memorial.draft.obituary}</p>
          </section>
          <section
            className="rounded-2xl p-6 text-center"
            style={{ backgroundColor: `${theme.accent}18` }}
          >
            <Heart className="mx-auto mb-3" size={17} style={{ color: theme.accent }} />
            <p
              className="font-display text-xl italic leading-7"
              style={{ color: theme.ink }}
            >
              {memorial.draft.remembrance}
            </p>
          </section>
        </div>
        <p
          className="mt-10 font-display text-2xl italic"
          style={{ color: theme.ink }}
        >
          {memorial.draft.closing}
        </p>
        {memorial.pdf_path ? (
          <a
            href={`/api/memorial/${token}/download`}
            className="mt-9 inline-flex items-center gap-2 rounded-full bg-forest px-5 py-3 text-xs font-bold text-white transition hover:bg-[#235448]"
          >
            <Download size={14} />
            Download memorial collection
          </a>
        ) : (
          <p className="mx-auto mt-9 max-w-md text-xs leading-6 text-forest/50">
            The downloadable source file has completed its 30-day retention
            period. Your delivered email attachment remains your copy.
          </p>
        )}
        <MemorialShareActions
          memorialPath={`/memorial/${token}`}
          qrPath={`/api/memorial/${token}/qr`}
        />
        <div className="mx-auto mt-8 max-w-md border-t border-forest/10 pt-6 text-xs leading-6 text-forest/50">
          <a
            href={`/review/${memorial.review_token}`}
            className="font-bold text-forest underline underline-offset-4"
          >
            Share an honest verified review
          </a>
          <span className="mx-2">·</span>
          <Link href="/#create" className="font-bold text-forest">
            Create another tribute
          </Link>
        </div>
        <div className="mt-14 flex items-center justify-center gap-2 text-[9px] font-bold uppercase tracking-[0.18em] text-forest/30">
          <LockKeyhole size={11} />
          Private memorial by TributeReady
        </div>
      </article>
    </main>
  );
}
