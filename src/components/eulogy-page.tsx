import { ArrowRight, Clock } from "lucide-react";
import Link from "next/link";
import { CopyTextButton } from "@/components/copy-text-button";
import { ResourceFooter, ResourceHeader } from "@/components/resource-guide";
import {
  EULOGY_STRUCTURE,
  getEulogyTemplate,
  type EulogyTemplate,
} from "@/lib/eulogy-templates";

export function EulogyPage({ template }: { template: EulogyTemplate }) {
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
              <Link href="/eulogy-examples" className="hover:text-forest">
                Eulogy examples
              </Link>
            </nav>
            <p className="mt-10 text-[10px] font-bold uppercase tracking-[0.24em] text-gold">
              Full example · free to use
            </p>
            <h1 className="mt-4 max-w-3xl font-display text-5xl font-semibold leading-[0.95] tracking-[-0.02em] text-forest sm:text-6xl">
              {template.title}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-forest/65 sm:text-lg">
              {template.description}
            </p>
            <p className="mt-8 inline-flex items-center gap-2 text-xs font-semibold text-forest/50">
              <Clock size={14} /> {template.example.minutes} spoken
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8 lg:py-16">
          <div className="space-y-5 text-[17px] leading-8 text-forest/75">
            {template.intro.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          <section id="example" className="mt-14 scroll-mt-8">
            <h2 className="font-display text-4xl font-semibold leading-tight text-forest">
              A complete example
            </h2>
            <p className="mt-4 text-base leading-8 text-forest/70">
              This is fictional and written to be delivered aloud. Read it for
              shape and rhythm rather than for wording to borrow. The details
              are the part that has to be yours.
            </p>
            <figure className="mt-7 rounded-3xl border border-forest/10 bg-paper p-6 shadow-[0_18px_50px_rgba(23,62,53,0.06)] sm:p-8">
              <figcaption className="flex flex-wrap items-baseline justify-between gap-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
                  {template.example.label}
                </span>
                <span className="text-xs font-semibold text-forest/45">
                  {template.example.words}
                </span>
              </figcaption>
              <blockquote className="mt-5 space-y-4 text-[17px] leading-9 text-forest/85">
                {template.example.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </blockquote>
              <div className="mt-6 border-t border-forest/10 pt-5">
                <CopyTextButton
                  text={template.example.paragraphs.join("\n\n")}
                  label="Copy this example"
                />
              </div>
            </figure>
          </section>

          <section id="openings" className="mt-14 scroll-mt-8">
            <h2 className="font-display text-4xl font-semibold leading-tight text-forest">
              Four ways to open
            </h2>
            <p className="mt-4 text-base leading-8 text-forest/70">
              Do not begin with &ldquo;I have been asked to say a few words.&rdquo;
              Start inside a scene. Each of these drops the room straight into a
              specific moment.
            </p>
            <div className="mt-7 space-y-4">
              {template.openings.map((opening) => (
                <div
                  key={opening.label}
                  className="rounded-2xl border border-forest/10 bg-paper p-6"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
                    {opening.label}
                  </p>
                  <p className="mt-3 font-display text-2xl leading-9 text-forest">
                    {opening.text}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section id="structure" className="mt-14 scroll-mt-8">
            <h2 className="font-display text-4xl font-semibold leading-tight text-forest">
              The five-part structure
            </h2>
            <p className="mt-4 text-base leading-8 text-forest/70">
              Almost every eulogy that works follows this shape, whether or not
              the person writing it knew that.
            </p>
            <ol className="mt-7 space-y-4">
              {EULOGY_STRUCTURE.map((part, index) => (
                <li
                  key={part.part}
                  className="rounded-2xl border border-forest/10 bg-paper p-6"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <p className="font-display text-2xl font-semibold text-forest">
                      <span className="mr-3 text-base font-bold text-gold">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {part.part}
                    </p>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-forest/45">
                      {part.seconds}
                    </p>
                  </div>
                  <p className="mt-3 text-base leading-7 text-forest/70">
                    {part.detail}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <section id="delivery" className="mt-14 scroll-mt-8">
            <h2 className="font-display text-4xl font-semibold leading-tight text-forest">
              {template.guidance.heading}
            </h2>
            <ul className="mt-6 space-y-3">
              {template.guidance.lines.map((line) => (
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

          <section className="mt-16 rounded-[2rem] bg-forest p-8 text-white sm:p-10">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#d8c08e]">
              For the printed service
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold">
              The program that goes with the eulogy
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-white/65">
              Everything here stays free. If you also need the printed pieces,
              TributeReady drafts the tribute wording with you, lets you edit
              every line, and produces a print-ready funeral program, memorial
              keepsake, and thank-you card for a one-time $34.99.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/#create"
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-forest"
              >
                Start a draft for free <ArrowRight size={15} />
              </Link>
              <Link
                href="/order-of-service-templates"
                className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3.5 text-sm font-bold text-white"
              >
                Order of service templates
              </Link>
            </div>
          </section>

          <section id="faq" className="mt-14 scroll-mt-8">
            <h2 className="font-display text-4xl font-semibold leading-tight text-forest">
              Questions people ask
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
              More eulogy examples
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {template.related.map((slug) => {
                const related = getEulogyTemplate(slug);
                if (!related) return null;
                return (
                  <Link
                    key={slug}
                    href={`/eulogy-examples/${slug}`}
                    className="rounded-2xl border border-forest/10 bg-paper p-5 text-sm font-semibold leading-6 text-forest transition hover:-translate-y-0.5 hover:border-sage"
                  >
                    {related.shortTitle}
                    <ArrowRight className="mt-3 text-gold" size={15} />
                  </Link>
                );
              })}
            </div>
            <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold text-forest/60">
              <Link href="/eulogy-examples" className="hover:text-forest">
                All eulogy examples
              </Link>
              <Link href="/obituary-templates" className="hover:text-forest">
                Obituary templates
              </Link>
              <Link href="/funeral-readings" className="hover:text-forest">
                Funeral readings
              </Link>
            </div>
          </section>

          <section className="mt-12 rounded-2xl border border-forest/10 bg-paper p-6 text-sm leading-6 text-forest/60">
            <h2 className="font-semibold text-forest">Editorial note</h2>
            <p className="mt-2">
              Every example on this page is fictional and does not describe a
              real person. Timings are approximate and assume a spoken pace of
              roughly one hundred and thirty words a minute. Ask the officiant
              how long you have before you write, because services with several
              speakers are usually tightly scheduled.
            </p>
          </section>
        </div>
      </article>
      <ResourceFooter />
    </main>
  );
}
