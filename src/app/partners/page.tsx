import type { Metadata } from "next";
import { ArrowRight, Check, Download, Leaf, Mail } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Memorial Program Resource for Care Professionals",
  description:
    "A simple family handoff for funeral homes, celebrants, hospices, churches, and local print shops.",
  alternates: { canonical: "/partners" },
};

export default function PartnersPage() {
  return (
    <main className="min-h-screen bg-cream text-forest">
      <header className="border-b border-forest/10 bg-paper">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-full bg-forest text-white">
              <Leaf size={16} />
            </span>
            <span className="font-display text-2xl font-semibold">TributeReady</span>
          </Link>
          <Link href="/#create" className="text-xs font-bold">
            Create a free preview
          </Link>
        </div>
      </header>

      <section className="botanical-glow soft-grid px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-gold">
              A practical family resource
            </p>
            <h1 className="mt-5 max-w-3xl font-display text-5xl font-semibold leading-[0.95] sm:text-7xl">
              A thoughtful handoff when a family needs words and print files.
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-8 text-forest/60">
              TributeReady helps a family turn confirmed memories into an
              editable obituary, bifold program, memorial card, thank-you card,
              and private page. They preview first and pay us directly only if
              they choose the finished collection.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="/api/partner-guide"
                className="inline-flex items-center gap-2 rounded-full bg-forest px-6 py-4 text-sm font-bold text-white"
              >
                <Download size={16} />
                Download the one-page guide
              </a>
              <a
                href="mailto:care@tributeready.org?subject=TributeReady%20resource%20question"
                className="inline-flex items-center gap-2 rounded-full border border-forest/15 bg-paper px-6 py-4 text-sm font-bold"
              >
                <Mail size={16} />
                Ask a question
              </a>
            </div>
          </div>
          <div className="rounded-[2rem] border border-forest/10 bg-paper p-8 paper-shadow">
            <h2 className="font-display text-3xl font-semibold">What the handoff includes</h2>
            <div className="mt-6 space-y-4">
              {[
                "No account, contract, inventory, or software training",
                "The family controls every fact and every word",
                "A complete preview before the one-time $34.99 purchase",
                "Print guidance for home or local professional printing",
                "Private-by-default memorial sharing",
                "Support through care@tributeready.org",
              ].map((item) => (
                <p key={item} className="flex gap-3 text-sm leading-6 text-forest/65">
                  <Check className="mt-1 shrink-0 text-sage" size={15} />
                  {item}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-forest/10 bg-paper px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center font-display text-4xl font-semibold sm:text-5xl">
            A clear boundary for professional care
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              ["You keep the relationship", "We do not replace funeral directors, celebrants, clergy, writers, or printers."],
              ["The family keeps control", "Nothing is published automatically, and the family reviews the full tribute before checkout."],
              ["No aggressive selling", "The resource is a quiet option for families who want help—not a required add-on or hidden upsell."],
            ].map(([title, copy]) => (
              <article key={title} className="rounded-3xl border border-forest/10 p-7">
                <h3 className="font-display text-2xl font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-forest/55">{copy}</p>
              </article>
            ))}
          </div>
          <div className="mt-12 text-center">
            <Link
              href="/funeral-program-maker"
              className="inline-flex items-center gap-2 text-sm font-bold"
            >
              See the family experience <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
