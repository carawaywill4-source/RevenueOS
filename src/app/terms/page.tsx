import { Leaf } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-cream px-5 py-12 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="flex items-center gap-2 text-forest">
          <Leaf size={17} className="text-sage" />
          <span className="font-display text-2xl font-semibold">
            TributeReady
          </span>
        </Link>
        <article className="mt-12 rounded-[2rem] border border-forest/8 bg-paper p-7 paper-shadow sm:p-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gold">
            Last updated August 6, 2026
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold text-forest sm:text-6xl">
            Terms of use
          </h1>
          <div className="mt-8 space-y-5 text-sm leading-7 text-forest/60 [&_a]:font-semibold [&_a]:text-forest [&_h2]:pt-3 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-forest">
            <p>
              TributeReady provides assisted writing and design tools. You are
              responsible for reviewing names, dates, facts, rights to uploaded
              photographs, and all wording before publishing or printing.
            </p>
            <h2>Your content</h2>
            <p>
              You retain ownership of the memories, photographs, and original
              material you submit. You give TributeReady a limited permission
              to process that material solely to provide the requested service.
            </p>
            <h2>Respectful and lawful use</h2>
            <p>
              Do not submit content you lack permission to use, impersonate
              another person, harass living relatives, or create deceptive
              memorials. We may refuse or remove unlawful or abusive content.
            </p>
            <h2>Purchases and corrections</h2>
            <p>
              The complete collection is a one-time purchase of $34.99 USD,
              shown again in Stripe Checkout before payment. There is no
              subscription. Digital collections are customized and delivered
              after payment.
            </p>
            <p>
              Because each collection is a customized digital product,
              purchases are generally non-refundable after delivery. Contact{" "}
              <a href="mailto:care@tributeready.org">
                care@tributeready.org
              </a>{" "}
              if a technical defect prevents access or a generated file does
              not match the approved preview; we will correct the affected
              files. Nothing here limits mandatory consumer rights in your
              country.
            </p>
            <h2>No professional advice</h2>
            <p>
              TributeReady is not a funeral home, clergy service, legal
              advisor, grief counselor, or emergency service.
            </p>
          </div>
        </article>
      </div>
    </main>
  );
}
