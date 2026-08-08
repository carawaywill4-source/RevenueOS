import type { Metadata } from "next";
import Link from "next/link";
import { Leaf } from "lucide-react";
import {
  decodeEmailParam,
  suppressEmail,
  suppressionIsConfigured,
  verifyUnsubscribe,
} from "@/lib/outreach-suppression";

export const metadata: Metadata = {
  title: "Unsubscribe | TributeReady",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; t?: string }>;
}) {
  const { e, t } = await searchParams;
  const email = decodeEmailParam(e ?? null);

  // Erring toward not sending: the link acts on load rather than asking the
  // recipient to confirm that they meant it.
  let state: "done" | "invalid" | "failed" = "invalid";
  if (suppressionIsConfigured() && email && t && verifyUnsubscribe(email, t)) {
    state = (await suppressEmail(email)) ? "done" : "failed";
  }

  return (
    <main className="grid min-h-screen place-items-center bg-cream px-5 py-20">
      <div className="paper-shadow w-full max-w-lg rounded-[2rem] border border-forest/10 bg-paper p-9 text-center">
        <span className="mx-auto grid size-11 place-items-center rounded-full bg-forest text-white">
          <Leaf size={18} />
        </span>
        {state === "done" ? (
          <>
            <h1 className="mt-6 font-display text-4xl font-semibold text-forest">
              You will not hear from us again.
            </h1>
            <p className="mt-4 text-base leading-8 text-forest/65">
              <span className="font-bold text-forest">{email}</span> has been
              removed. No further messages will be sent to this address, and you
              do not need to do anything else.
            </p>
          </>
        ) : state === "failed" ? (
          <>
            <h1 className="mt-6 font-display text-4xl font-semibold text-forest">
              That did not go through.
            </h1>
            <p className="mt-4 text-base leading-8 text-forest/65">
              Something on our side failed. Please reply to the email you
              received with the word &ldquo;unsubscribe&rdquo; and we will remove
              you by hand.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-6 font-display text-4xl font-semibold text-forest">
              This link is not valid.
            </h1>
            <p className="mt-4 text-base leading-8 text-forest/65">
              It may have been altered in transit. Reply to the email you
              received with the word &ldquo;unsubscribe&rdquo; and we will remove
              you by hand.
            </p>
          </>
        )}
        <Link
          href="/"
          className="mt-8 inline-flex rounded-full border border-forest/15 px-5 py-3 text-sm font-bold text-forest transition hover:border-sage"
        >
          Return to TributeReady
        </Link>
      </div>
    </main>
  );
}
