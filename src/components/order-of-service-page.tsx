import { ArrowRight, Clock } from "lucide-react";
import Link from "next/link";
import { CopyTextButton } from "@/components/copy-text-button";
import { ResourceFooter, ResourceHeader } from "@/components/resource-guide";
import {
  getOrderOfServiceTemplate,
  type OrderOfServiceTemplate,
} from "@/lib/order-of-service-templates";

export function OrderOfServicePage({
  template,
}: {
  template: OrderOfServiceTemplate;
}) {
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
              <Link
                href="/order-of-service-templates"
                className="hover:text-forest"
              >
                Order of service templates
              </Link>
            </nav>
            <p className="mt-10 text-[10px] font-bold uppercase tracking-[0.24em] text-gold">
              Free order of service template
            </p>
            <h1 className="mt-4 max-w-3xl font-display text-5xl font-semibold leading-[0.95] tracking-[-0.02em] text-forest sm:text-6xl">
              {template.title}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-forest/65 sm:text-lg">
              {template.description}
            </p>
            <p className="mt-8 inline-flex items-center gap-2 text-xs font-semibold text-forest/50">
              <Clock size={14} /> {template.duration}
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8 lg:py-16">
          <div className="space-y-5 text-[17px] leading-8 text-forest/75">
            {template.intro.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          <section id="order" className="mt-14 scroll-mt-8">
            <h2 className="font-display text-4xl font-semibold leading-tight text-forest">
              The order of service
            </h2>
            <ol className="mt-7 space-y-4">
              {template.steps.map((step, index) => (
                <li
                  key={step.name}
                  className="rounded-2xl border border-forest/10 bg-paper p-6"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <p className="font-display text-2xl font-semibold text-forest">
                      <span className="mr-3 text-base font-bold text-gold">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {step.name}
                    </p>
                    {step.minutes && (
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-forest/45">
                        {step.minutes}
                      </p>
                    )}
                  </div>
                  <p className="mt-3 text-base leading-7 text-forest/70">
                    {step.detail}
                  </p>
                </li>
              ))}
            </ol>
            <div className="mt-6">
              <CopyTextButton
                text={template.steps
                  .map((step, index) => `${index + 1}. ${step.name}`)
                  .join("\n")}
                label="Copy the outline"
              />
            </div>
          </section>

          <section id="wording" className="mt-14 scroll-mt-8">
            <h2 className="font-display text-4xl font-semibold leading-tight text-forest">
              {template.wording.heading}
            </h2>
            <p className="mt-4 text-base leading-8 text-forest/70">
              Replace the bracketed prompts with your own details. Every block
              below is free to copy and use.
            </p>
            <div className="mt-7 space-y-5">
              {template.wording.lines.map((line) => (
                <figure
                  key={line.label}
                  className="rounded-3xl border border-forest/10 bg-paper p-6 shadow-[0_18px_50px_rgba(23,62,53,0.06)]"
                >
                  <figcaption className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
                    {line.label}
                  </figcaption>
                  <pre className="mt-4 whitespace-pre-wrap font-sans text-[15px] leading-7 text-forest/80">
                    {line.text}
                  </pre>
                  <div className="mt-5 border-t border-forest/10 pt-5">
                    <CopyTextButton text={line.text} label="Copy" />
                  </div>
                </figure>
              ))}
            </div>
          </section>

          <section id="layout" className="mt-14 scroll-mt-8">
            <h2 className="font-display text-4xl font-semibold leading-tight text-forest">
              How this fits on a folded program
            </h2>
            <p className="mt-4 text-base leading-8 text-forest/70">
              A standard funeral program is a single sheet folded once, giving
              four panels. Here is where each part usually goes.
            </p>
            <ul className="mt-6 space-y-3">
              {template.panels.map((panel) => (
                <li
                  key={panel}
                  className="flex gap-3 text-base leading-7 text-forest/70"
                >
                  <span
                    aria-hidden="true"
                    className="mt-2.5 size-1.5 shrink-0 rounded-full bg-gold"
                  />
                  <span>{panel}</span>
                </li>
              ))}
            </ul>
          </section>

          <section id="notes" className="mt-14 scroll-mt-8">
            <h2 className="font-display text-4xl font-semibold leading-tight text-forest">
              Practical notes
            </h2>
            <ul className="mt-6 space-y-3">
              {template.notes.map((note) => (
                <li
                  key={note}
                  className="flex gap-3 text-base leading-7 text-forest/70"
                >
                  <span
                    aria-hidden="true"
                    className="mt-2.5 size-1.5 shrink-0 rounded-full bg-sage"
                  />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-16 rounded-[2rem] bg-forest p-8 text-white sm:p-10">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#d8c08e]">
              When you are ready
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold">
              Print this as a finished program
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-white/65">
              This template is free. If you want the finished piece, TributeReady
              lays out a four-panel bifold program with your order of service,
              photograph, and tribute, and gives you print-ready files for a
              one-time $34.99. You review and edit everything first.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/#create"
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-forest"
              >
                Start a draft for free <ArrowRight size={15} />
              </Link>
              <Link
                href="/api/sample"
                className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3.5 text-sm font-bold text-white"
              >
                See a sample PDF
              </Link>
            </div>
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
              Other service types
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {template.related.map((slug) => {
                const related = getOrderOfServiceTemplate(slug);
                if (!related) return null;
                return (
                  <Link
                    key={slug}
                    href={`/order-of-service-templates/${slug}`}
                    className="rounded-2xl border border-forest/10 bg-paper p-5 text-sm font-semibold leading-6 text-forest transition hover:-translate-y-0.5 hover:border-sage"
                  >
                    {related.shortTitle}
                    <ArrowRight className="mt-3 text-gold" size={15} />
                  </Link>
                );
              })}
            </div>
            <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold text-forest/60">
              <Link
                href="/order-of-service-templates"
                className="hover:text-forest"
              >
                All order of service templates
              </Link>
              <Link href="/funeral-readings" className="hover:text-forest">
                Funeral poems and readings
              </Link>
              <Link href="/obituary-templates" className="hover:text-forest">
                Obituary templates
              </Link>
            </div>
          </section>

          <section className="mt-12 rounded-2xl border border-forest/10 bg-paper p-6 text-sm leading-6 text-forest/60">
            <h2 className="font-semibold text-forest">Editorial note</h2>
            <p className="mt-2">
              Customs and requirements vary by congregation, officiant,
              cemetery, and region. Confirm the order, the readings, the music,
              and the timing with your officiant and funeral director before
              printing anything. Names in sample wording are placeholders.
            </p>
          </section>
        </div>
      </article>
      <ResourceFooter />
    </main>
  );
}
