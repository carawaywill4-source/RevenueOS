import { ArrowRight, Check, Download, Leaf } from "lucide-react";
import Link from "next/link";
import { GrowthPageView } from "@/components/growth-page-view";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://tributeready.org";

type Section = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  note?: string;
  links?: { href: string; label: string }[];
};

type Comparison = {
  heading: string;
  intro: string;
  options: {
    name: string;
    cost: string;
    bestWhen: string;
    tradeoff: string;
  }[];
  note?: string;
  downloads?: { href: string; label: string }[];
};

type IntentLandingProps = {
  eyebrow: string;
  title: string;
  accent: string;
  description: string;
  benefits: string[];
  steps: { title: string; copy: string }[];
  questions: { question: string; answer: string }[];
  page: "funeral_program" | "obituary" | "celebration";
  path: string;
  breadcrumb: string;
  sections: Section[];
  included: { title: string; copy: string }[];
  related: { href: string; title: string; copy: string }[];
  comparison?: Comparison;
};

export function IntentLanding({
  eyebrow,
  title,
  accent,
  description,
  benefits,
  steps,
  questions,
  page,
  path,
  breadcrumb,
  sections,
  included,
  related,
  comparison,
}: IntentLandingProps) {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: questions.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        {
          "@type": "ListItem",
          position: 2,
          name: breadcrumb,
          item: `${SITE_URL}${path}`,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: "TributeReady memorial collection",
      description,
      brand: { "@type": "Brand", name: "TributeReady" },
      offers: {
        "@type": "Offer",
        price: "34.99",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: `${SITE_URL}${path}`,
      },
    },
  ];

  return (
    <main className="min-h-screen bg-cream">
      <GrowthPageView page={page} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <header className="border-b border-forest/10">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2 text-forest">
            <span className="grid size-9 place-items-center rounded-full bg-forest text-white">
              <Leaf size={16} />
            </span>
            <span className="font-display text-2xl font-semibold">
              TributeReady
            </span>
          </Link>
          <div className="flex items-center gap-5">
            <Link
              href="/resources"
              className="hidden text-xs font-bold text-forest/60 transition hover:text-forest sm:block"
            >
              Resources
            </Link>
            <Link
              href="/#create"
              className="rounded-full bg-forest px-5 py-3 text-xs font-bold text-white"
            >
              Begin for free
            </Link>
          </div>
        </div>
      </header>

      <section className="botanical-glow soft-grid px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-gold">
              {eyebrow}
            </p>
            <h1 className="mt-5 font-display text-6xl font-semibold leading-[0.9] tracking-[-0.03em] text-forest sm:text-7xl">
              {title}
              <br />
              <span className="italic text-sage">{accent}</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-8 text-forest/60">
              {description}
            </p>
            <Link
              href="/#create"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-forest px-6 py-4 text-sm font-bold text-white transition hover:bg-[#235448]"
            >
              Create a free preview <ArrowRight size={16} />
            </Link>
            <p className="mt-4 text-[11px] text-forest/40">
              No account or payment required to preview.
            </p>
          </div>
          <div className="paper-shadow rounded-[2rem] border border-forest/10 bg-paper p-7 sm:p-9">
            <p className="font-display text-3xl font-semibold text-forest">
              Thoughtfully included
            </p>
            <div className="mt-6 grid gap-4">
              {benefits.map((benefit) => (
                <div
                  key={benefit}
                  className="flex items-start gap-3 text-sm leading-6 text-forest/65"
                >
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-mist text-forest">
                    <Check size={11} />
                  </span>
                  {benefit}
                </div>
              ))}
            </div>
            <div className="mt-7 border-t border-forest/10 pt-5">
              <p className="font-display text-3xl font-semibold text-forest">
                $34.99
              </p>
              <p className="mt-1 text-sm leading-6 text-forest/60">
                One payment for the whole collection. No subscription, no
                per-copy charge, and nothing due until you have read the draft
                and decided you want it.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-forest/8 bg-paper px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-3xl">
          {sections.map((section) => (
            <div key={section.heading} className="mb-14 last:mb-0">
              <h2 className="font-display text-4xl font-semibold leading-tight text-forest">
                {section.heading}
              </h2>
              <div className="mt-4 space-y-4 text-base leading-8 text-forest/70">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph.slice(0, 40)}>{paragraph}</p>
                ))}
              </div>
              {section.bullets ? (
                <ul className="mt-5 space-y-3">
                  {section.bullets.map((bullet) => (
                    <li
                      key={bullet.slice(0, 40)}
                      className="flex gap-3 text-base leading-7 text-forest/70"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-2.5 size-1.5 shrink-0 rounded-full bg-sage"
                      />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {section.note ? (
                <p className="mt-5 border-l-2 border-sage bg-mist/50 px-5 py-4 text-sm leading-6 text-forest/70">
                  {section.note}
                </p>
              ) : null}
              {section.links ? (
                <div className="mt-5 flex flex-wrap gap-3">
                  {section.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="inline-flex items-center gap-2 rounded-full border border-forest/15 bg-cream px-4 py-2.5 text-sm font-bold text-forest transition hover:border-sage"
                    >
                      {link.label} <ArrowRight size={14} />
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-display text-5xl font-semibold text-forest">
            What arrives in your inbox
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {included.map((item) => (
              <article
                key={item.title}
                className="rounded-2xl border border-forest/10 bg-paper p-6"
              >
                <h3 className="font-display text-2xl font-semibold text-forest">
                  {item.title}
                </h3>
                <p className="mt-2 text-base leading-7 text-forest/65">
                  {item.copy}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-forest/8 bg-paper px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-gold">
              A simple, guided process
            </p>
            <h2 className="mt-4 font-display text-5xl font-semibold text-forest">
              From memory to finished tribute
            </h2>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <article
                key={step.title}
                className="rounded-3xl border border-forest/8 bg-cream/60 p-7"
              >
                <p className="font-display text-2xl italic text-gold">
                  0{index + 1}
                </p>
                <h3 className="mt-4 font-display text-2xl font-semibold text-forest">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-forest/50">
                  {step.copy}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {comparison ? (
        <section className="px-5 py-20 sm:px-8">
          <div className="mx-auto max-w-5xl">
            <h2 className="font-display text-5xl font-semibold leading-tight text-forest">
              {comparison.heading}
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-8 text-forest/65">
              {comparison.intro}
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {comparison.options.map((option) => (
                <article
                  key={option.name}
                  className="rounded-2xl border border-forest/10 bg-paper p-6"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h3 className="font-display text-2xl font-semibold text-forest">
                      {option.name}
                    </h3>
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-gold">
                      {option.cost}
                    </span>
                  </div>
                  <p className="mt-3 text-base leading-7 text-forest/70">
                    {option.bestWhen}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-forest/55">
                    <span className="font-bold text-forest/70">
                      The trade-off.
                    </span>{" "}
                    {option.tradeoff}
                  </p>
                </article>
              ))}
            </div>
            {comparison.note ? (
              <p className="mt-6 border-l-2 border-sage bg-mist/50 px-5 py-4 text-sm leading-6 text-forest/70">
                {comparison.note}
              </p>
            ) : null}
            {comparison.downloads ? (
              <div className="mt-6 flex flex-wrap gap-3">
                {comparison.downloads.map((download) => (
                  <a
                    key={download.href}
                    href={download.href}
                    className="inline-flex items-center gap-2 rounded-full border border-forest/15 bg-paper px-4 py-2.5 text-sm font-bold text-forest transition hover:border-sage"
                  >
                    <Download size={14} /> {download.label}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="border-y border-forest/8 bg-paper px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-display text-5xl font-semibold text-forest">
            Free, whether you buy anything or not
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-8 text-forest/65">
            These are complete and free to copy, print, and share. There is no
            account, no email form, and nothing held back.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {related.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-2xl border border-forest/10 bg-cream/60 p-6 transition hover:border-sage"
              >
                <h3 className="font-display text-2xl font-semibold text-forest">
                  {item.title}
                </h3>
                <p className="mt-2 text-base leading-7 text-forest/65">
                  {item.copy}
                </p>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-forest">
                  Open <ArrowRight size={14} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center font-display text-5xl font-semibold text-forest">
            Common questions
          </h2>
          <dl className="mt-10 divide-y divide-forest/10 border-y border-forest/10">
            {questions.map((item) => (
              <div key={item.question} className="py-6">
                <dt className="font-display text-2xl font-semibold text-forest">
                  {item.question}
                </dt>
                <dd className="mt-2 text-base leading-8 text-forest/65">
                  {item.answer}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="bg-forest px-5 py-20 text-center text-white sm:px-8">
        <Leaf className="mx-auto text-[#d8c08e]" size={22} />
        <h2 className="mx-auto mt-5 max-w-3xl font-display text-5xl font-semibold leading-none sm:text-6xl">
          Begin with one memory.
          <br />
          <span className="italic text-[#d8c9a8]">
            Shape something lasting.
          </span>
        </h2>
        <Link
          href="/#create"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-4 text-sm font-bold text-forest"
        >
          Begin their tribute <ArrowRight size={16} />
        </Link>
      </section>
    </main>
  );
}
