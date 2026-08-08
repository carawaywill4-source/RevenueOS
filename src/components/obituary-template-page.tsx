import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { CopyTextButton } from "@/components/copy-text-button";
import { ResourceFooter, ResourceHeader } from "@/components/resource-guide";
import {
  getObituaryTemplate,
  TEMPLATE_UPDATED,
  type ObituaryTemplate,
} from "@/lib/obituary-templates";

export function ObituaryTemplatePage({
  template,
}: {
  template: ObituaryTemplate;
}) {
  const updated = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${TEMPLATE_UPDATED}T00:00:00Z`));

  const plainTemplate = template.fillIn.join("\n\n");

  return (
    <main className="min-h-screen bg-cream">
      <ResourceHeader />
      <article>
        <header className="botanical-glow soft-grid border-b border-forest/10 px-5 py-16 sm:px-8 lg:py-20">
          <div className="mx-auto max-w-4xl">
            <nav
              aria-label="Breadcrumb"
              className="text-xs font-semibold text-forest/50"
            >
              <Link href="/" className="hover:text-forest">
                Home
              </Link>
              <span aria-hidden="true" className="mx-2">
                /
              </span>
              <Link href="/obituary-templates" className="hover:text-forest">
                Obituary templates
              </Link>
            </nav>
            <p className="mt-10 text-[10px] font-bold uppercase tracking-[0.24em] text-gold">
              Free obituary template
            </p>
            <h1 className="mt-4 max-w-3xl font-display text-5xl font-semibold leading-[0.95] tracking-[-0.02em] text-forest sm:text-6xl">
              {template.title.replace(" (Free, Fill-in-the-Blank)", "")}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-forest/65 sm:text-lg">
              {template.description}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-forest/50">
              <span>Free to copy and use</span>
              <span>No sign-up</span>
              <span>Updated {updated}</span>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8 lg:py-16">
          <div className="space-y-5 text-[17px] leading-8 text-forest/75">
            {template.intro.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          <section id="template" className="mt-14 scroll-mt-8">
            <h2 className="font-display text-4xl font-semibold leading-tight text-forest">
              Fill-in-the-blank template
            </h2>
            <p className="mt-4 text-base leading-8 text-forest/70">
              Replace every bracketed prompt with your own details. Delete any
              line that does not apply. Nothing here is required.
            </p>
            <div className="mt-6 rounded-3xl border border-forest/10 bg-paper p-6 shadow-[0_18px_50px_rgba(23,62,53,0.06)] sm:p-8">
              <div className="space-y-4 text-[15px] leading-7 text-forest/80">
                {template.fillIn.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
              <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-forest/10 pt-6">
                <CopyTextButton text={plainTemplate} />
                <span className="text-xs text-forest/50">
                  Copies as plain text you can paste anywhere.
                </span>
              </div>
            </div>
          </section>

          <section id="include" className="mt-14 scroll-mt-8">
            <h2 className="font-display text-4xl font-semibold leading-tight text-forest">
              What to include
            </h2>
            <ul className="mt-6 space-y-3">
              {template.include.map((item) => (
                <li
                  key={item}
                  className="flex gap-3 text-base leading-7 text-forest/70"
                >
                  <span
                    aria-hidden="true"
                    className="mt-2.5 size-1.5 shrink-0 rounded-full bg-gold"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section id="examples" className="mt-14 scroll-mt-8">
            <h2 className="font-display text-4xl font-semibold leading-tight text-forest">
              Completed examples
            </h2>
            <p className="mt-4 text-base leading-8 text-forest/70">
              Both examples below are fictional. They do not describe real
              people, and they are written to show length and structure rather
              than to be copied word for word.
            </p>
            <div className="mt-7 space-y-6">
              {template.examples.map((example) => (
                <figure
                  key={example.label}
                  className="rounded-3xl border border-forest/10 bg-paper p-6 shadow-[0_18px_50px_rgba(23,62,53,0.06)] sm:p-8"
                >
                  <figcaption className="flex flex-wrap items-baseline justify-between gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
                      {example.label}
                    </span>
                    <span className="text-xs font-semibold text-forest/45">
                      {example.words} · fictional
                    </span>
                  </figcaption>
                  <blockquote className="mt-5 space-y-4 text-base leading-8 text-forest/80">
                    {example.paragraphs.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </blockquote>
                  <div className="mt-6 border-t border-forest/10 pt-5">
                    <CopyTextButton
                      text={example.paragraphs.join("\n\n")}
                      label="Copy this example"
                    />
                  </div>
                </figure>
              ))}
            </div>
          </section>

          <section id="wording" className="mt-14 scroll-mt-8">
            <h2 className="font-display text-4xl font-semibold leading-tight text-forest">
              {template.wording.heading}
            </h2>
            <ul className="mt-6 space-y-3">
              {template.wording.lines.map((line) => (
                <li
                  key={line}
                  className="flex gap-3 text-base leading-7 text-forest/70"
                >
                  <span
                    aria-hidden="true"
                    className="mt-2.5 size-1.5 shrink-0 rounded-full bg-sage"
                  />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </section>

          <section id="pitfalls" className="mt-14 scroll-mt-8">
            <h2 className="font-display text-4xl font-semibold leading-tight text-forest">
              Mistakes worth avoiding
            </h2>
            <ul className="mt-6 space-y-3">
              {template.pitfalls.map((item) => (
                <li
                  key={item}
                  className="flex gap-3 text-base leading-7 text-forest/70"
                >
                  <span
                    aria-hidden="true"
                    className="mt-2.5 size-1.5 shrink-0 rounded-full bg-gold"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-16 rounded-[2rem] bg-forest p-8 text-white sm:p-10">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#d8c08e]">
              When you are ready
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold">
              Turn the finished wording into a printable program
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-white/65">
              The template above is free and always will be. If you also need a
              printed funeral program, memorial keepsake, and thank-you card,
              TributeReady drafts the wording with you, lets you edit every
              line, and produces print-ready files for a one-time $34.99. You
              can write and review the full draft before deciding.
            </p>
            <Link
              href="/#create"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-forest"
            >
              Start a draft for free <ArrowRight size={15} />
            </Link>
          </section>

          <section id="faq" className="mt-14 scroll-mt-8">
            <h2 className="font-display text-4xl font-semibold leading-tight text-forest">
              Questions families ask
            </h2>
            <dl className="mt-7 space-y-6">
              {template.faqs.map((faq) => (
                <div
                  key={faq.question}
                  className="rounded-2xl border border-forest/10 bg-paper p-6"
                >
                  <dt className="font-display text-2xl font-semibold text-forest">
                    {faq.question}
                  </dt>
                  <dd className="mt-3 text-base leading-8 text-forest/70">
                    {faq.answer}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="mt-14 border-t border-forest/10 pt-10">
            <h2 className="font-display text-3xl font-semibold text-forest">
              More templates
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {template.related.map((slug) => {
                const related = getObituaryTemplate(slug);
                if (!related) return null;
                return (
                  <Link
                    key={slug}
                    href={`/obituary-templates/${slug}`}
                    className="rounded-2xl border border-forest/10 bg-paper p-5 text-sm font-semibold leading-6 text-forest transition hover:-translate-y-0.5 hover:border-sage"
                  >
                    {related.shortTitle}
                    <ArrowRight className="mt-3 text-gold" size={15} />
                  </Link>
                );
              })}
            </div>
            <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold text-forest/60">
              <Link href="/obituary-templates" className="hover:text-forest">
                All obituary templates
              </Link>
              <Link
                href="/resources/how-to-write-an-obituary"
                className="hover:text-forest"
              >
                How to write an obituary
              </Link>
              <Link
                href="/order-of-service-templates"
                className="hover:text-forest"
              >
                Order of service templates
              </Link>
            </div>
          </section>

          <section className="mt-12 rounded-2xl border border-forest/10 bg-paper p-6 text-sm leading-6 text-forest/60">
            <h2 className="font-semibold text-forest">Editorial note</h2>
            <p className="mt-2">
              TributeReady writes and reviews these templates for clarity,
              accuracy, and practical usefulness. Customs vary by family, faith
              community, newspaper, and funeral home, so confirm submission
              deadlines and word limits with whoever will publish the notice.
              All examples are fictional.
            </p>
          </section>
        </div>
      </article>
      <ResourceFooter />
    </main>
  );
}
