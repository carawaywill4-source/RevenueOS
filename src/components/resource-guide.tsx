import { ArrowRight, BookOpen, Leaf } from "lucide-react";
import Link from "next/link";
import {
  getResource,
  RESOURCE_UPDATED,
  type ResourceGuide as ResourceGuideType,
} from "@/lib/resources";

function ResourceHeader() {
  return (
    <header className="border-b border-forest/10 bg-paper">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2 text-forest">
          <span className="grid size-9 place-items-center rounded-full bg-forest text-white">
            <Leaf size={16} />
          </span>
          <span className="font-display text-2xl font-semibold">TributeReady</span>
        </Link>
        <nav aria-label="Main navigation" className="flex items-center gap-5">
          <Link
            href="/obituary-templates"
            className="hidden text-sm font-semibold text-forest/65 transition hover:text-forest md:block"
          >
            Templates
          </Link>
          <Link
            href="/resources"
            className="hidden text-sm font-semibold text-forest/65 transition hover:text-forest sm:block"
          >
            Resources
          </Link>
          <Link
            href="/#create"
            className="rounded-full bg-forest px-5 py-3 text-xs font-bold text-white"
          >
            Begin for free
          </Link>
        </nav>
      </div>
    </header>
  );
}

function ResourceFooter() {
  return (
    <footer className="border-t border-forest/10 bg-paper px-5 py-10 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 text-sm text-forest/55 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} TributeReady. Created with care.</p>
        <nav aria-label="Footer navigation" className="flex flex-wrap gap-5">
          <Link href="/resources" className="hover:text-forest">
            Resource library
          </Link>
          <Link href="/obituary-templates" className="hover:text-forest">
            Obituary templates
          </Link>
          <Link href="/order-of-service-templates" className="hover:text-forest">
            Order of service
          </Link>
          <Link href="/eulogy-examples" className="hover:text-forest">
            Eulogy examples
          </Link>
          <Link href="/funeral-readings" className="hover:text-forest">
            Funeral readings
          </Link>
          <Link
            href="/funeral-program-template-word"
            className="hover:text-forest"
          >
            Word templates
          </Link>
          <Link
            href="/where-to-print-funeral-programs"
            className="hover:text-forest"
          >
            Where to print
          </Link>
          <Link href="/funeral-program-cost" className="hover:text-forest">
            Program cost
          </Link>
          <Link
            href="/funeral-program-examples"
            className="hover:text-forest"
          >
            Program examples
          </Link>
          <Link
            href="/resources/obituary-family-order"
            className="hover:text-forest"
          >
            Family order in obituaries
          </Link>
          <Link href="/privacy" className="hover:text-forest">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-forest">
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  );
}

export function ResourceGuide({ guide }: { guide: ResourceGuideType }) {
  const updated = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${RESOURCE_UPDATED}T00:00:00Z`));

  return (
    <main className="min-h-screen bg-cream">
      <ResourceHeader />
      <article>
        <header className="botanical-glow soft-grid border-b border-forest/10 px-5 py-16 sm:px-8 lg:py-24">
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
              <Link href="/resources" className="hover:text-forest">
                Resources
              </Link>
            </nav>
            <p className="mt-10 text-[10px] font-bold uppercase tracking-[0.24em] text-gold">
              {guide.eyebrow}
            </p>
            <h1 className="mt-4 max-w-3xl font-display text-5xl font-semibold leading-[0.95] tracking-[-0.02em] text-forest sm:text-7xl">
              {guide.title}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-forest/65 sm:text-lg">
              {guide.description}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-forest/50">
              <span className="inline-flex items-center gap-2">
                <BookOpen size={14} /> {guide.readTime}
              </span>
              <span>Updated {updated}</span>
              <span>Editorially reviewed by TributeReady</span>
            </div>
          </div>
        </header>

        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:py-20">
          <aside className="lg:sticky lg:top-8 lg:self-start">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
              In this guide
            </p>
            <nav aria-label="Table of contents" className="mt-4">
              <ol className="space-y-3 border-l border-forest/15 pl-4">
                {guide.sections.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="text-sm leading-5 text-forest/55 transition hover:text-forest"
                    >
                      {section.heading}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>

          <div className="min-w-0 max-w-3xl">
            <div className="space-y-5 text-[17px] leading-8 text-forest/75">
              {guide.intro.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>

            <div className="mt-12 space-y-14">
              {guide.sections.map((section) => (
                <section
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-8"
                >
                  <h2 className="font-display text-4xl font-semibold leading-tight text-forest sm:text-5xl">
                    {section.heading}
                  </h2>
                  {section.paragraphs && (
                    <div className="mt-5 space-y-4 text-base leading-8 text-forest/70">
                      {section.paragraphs.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                    </div>
                  )}
                  {section.bullets && (
                    <ul className="mt-6 space-y-3">
                      {section.bullets.map((bullet) => (
                        <li
                          key={bullet}
                          className="flex gap-3 text-base leading-7 text-forest/70"
                        >
                          <span
                            aria-hidden="true"
                            className="mt-2.5 size-1.5 shrink-0 rounded-full bg-gold"
                          />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {section.example && (
                    <figure className="mt-7 rounded-3xl border border-forest/10 bg-paper p-6 shadow-[0_18px_50px_rgba(23,62,53,0.06)] sm:p-8">
                      <figcaption className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
                        {section.example.label}
                      </figcaption>
                      <blockquote className="mt-4 space-y-4 font-display text-2xl leading-8 text-forest">
                        {section.example.text.map((paragraph) => (
                          <p key={paragraph}>{paragraph}</p>
                        ))}
                      </blockquote>
                    </figure>
                  )}
                  {section.note && (
                    <p className="mt-6 border-l-2 border-sage bg-mist/60 px-5 py-4 text-sm leading-6 text-forest/65">
                      <strong className="text-forest">Note:</strong>{" "}
                      {section.note}
                    </p>
                  )}
                </section>
              ))}
            </div>

            <section className="mt-16 rounded-[2rem] bg-forest p-8 text-white sm:p-10">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#d8c08e]">
                Create with care
              </p>
              <h2 className="mt-3 font-display text-4xl font-semibold">
                {guide.cta.title}
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-7 text-white/65">
                {guide.cta.copy}
              </p>
              <Link
                href={guide.cta.href}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-forest"
              >
                {guide.cta.label} <ArrowRight size={15} />
              </Link>
            </section>

            <section className="mt-14 border-t border-forest/10 pt-10">
              <h2 className="font-display text-3xl font-semibold text-forest">
                Continue reading
              </h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {guide.related.map((slug) => {
                  const related = getResource(slug);
                  if (!related) return null;
                  return (
                    <Link
                      key={slug}
                      href={`/resources/${slug}`}
                      className="rounded-2xl border border-forest/10 bg-paper p-5 text-sm font-semibold leading-6 text-forest transition hover:-translate-y-0.5 hover:border-sage"
                    >
                      {related.shortTitle}
                      <ArrowRight className="mt-3 text-gold" size={15} />
                    </Link>
                  );
                })}
              </div>
            </section>

            <section className="mt-12 rounded-2xl border border-forest/10 bg-paper p-6 text-sm leading-6 text-forest/60">
              <h2 className="font-semibold text-forest">Editorial note</h2>
              <p className="mt-2">
                TributeReady writes and reviews its resource guides for clarity,
                compassion, and practical usefulness. Customs and requirements
                vary, so confirm service details with your venue, officiant,
                faith community, and printer. Examples identified as fictional
                do not describe real people.
              </p>
            </section>
          </div>
        </div>
      </article>
      <ResourceFooter />
    </main>
  );
}

export { ResourceFooter, ResourceHeader };
