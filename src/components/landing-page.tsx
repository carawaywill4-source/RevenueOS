import {
  ArrowRight,
  BookHeart,
  Check,
  ChevronDown,
  Feather,
  Heart,
  Leaf,
  LockKeyhole,
  Mail,
  Printer,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { MemorialBuilder } from "@/components/memorial-builder";
import { ReviewsSection } from "@/components/reviews-section";
import { GrowthPageView } from "@/components/growth-page-view";

const keepsakes = [
  [BookHeart, "Private memorial page"],
  [Printer, "Print-ready program"],
  [Leaf, "Memorial card"],
  [Mail, "Matching thank-you card"],
  [Sparkles, "Guided obituary draft"],
  [ShieldCheck, "30-day private storage"],
] as const;

export function LandingPage() {
  return (
    <main className="overflow-hidden">
      <GrowthPageView page="home" />
      <Header />
      <Hero />
      <ForEveryChapter />
      <HowItWorks />
      <MemorialBuilder />
      <Collection />
      <PurchaseClarity />
      <ReviewsSection />
      <FreeResources />
      <PrivacyPromise />
      <Questions />
      <FinalCall />
      <Footer />
    </main>
  );
}

function Header() {
  return (
    <header className="absolute inset-x-0 top-0 z-40 border-b border-white/15">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2 text-white">
          <span className="grid size-9 place-items-center rounded-full border border-white/25 bg-white/10">
            <Leaf size={17} />
          </span>
          <span className="font-display text-2xl font-semibold tracking-tight">
            TributeReady
          </span>
        </Link>
        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-8 text-xs font-semibold text-white/75 md:flex"
        >
          <a className="transition hover:text-white" href="#how-it-works">
            How it works
          </a>
          <a className="transition hover:text-white" href="#collection">
            What you receive
          </a>
          <a className="transition hover:text-white" href="#questions">
            Questions
          </a>
        </nav>
        <a
          href="#create"
          className="rounded-full bg-white px-4 py-2.5 text-xs font-bold text-forest transition hover:bg-cream sm:px-5"
        >
          Create a tribute
        </a>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative min-h-[820px] bg-forest px-5 pb-24 pt-36 text-white sm:px-8 lg:min-h-[900px] lg:pt-44">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -right-32 -top-40 size-[620px] rounded-full border border-white/8" />
        <div className="absolute -right-10 -top-16 size-[430px] rounded-full border border-white/8" />
        <div className="absolute -bottom-64 -left-28 size-[520px] rounded-full bg-[#2a584c]/45 blur-3xl" />
        <BotanicalLine />
      </div>

      <div className="relative mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="max-w-3xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">
            <Heart size={12} className="text-[#d8c08e]" />
            Made for memories that matter
          </div>
          <h1 className="font-display text-[4.2rem] font-medium leading-[0.9] tracking-[-0.035em] sm:text-[6.2rem] lg:text-[7.2rem]">
            A life,
            <br />
            <span className="italic text-[#d8c9a8]">beautifully</span>
            <br />
            remembered.
          </h1>
          <p className="mt-8 max-w-xl text-base leading-7 text-white/65 sm:text-lg sm:leading-8">
            Turn the memories you carry into a lasting memorial page and a
            complete collection of print-ready keepsakes—gently guided, easy to
            edit, and ready when you are.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a
              href="#create"
              className="flex items-center justify-center gap-2 rounded-full bg-[#f6f0e3] px-6 py-4 text-sm font-bold text-forest transition hover:bg-white"
            >
              Begin their tribute <ArrowRight size={17} />
            </a>
            <a
              href="#how-it-works"
              className="flex items-center justify-center rounded-full border border-white/20 px-6 py-4 text-sm font-bold text-white transition hover:bg-white/8"
            >
              See how it works
            </a>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-[11px] font-semibold text-white/45">
            {["Preview before paying", "No subscription", "Private by default"].map(
              (item) => (
                <span key={item} className="flex items-center gap-2">
                  <Check size={13} /> {item}
                </span>
              ),
            )}
          </div>
          <a
            href="/api/sample"
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-white/70 underline decoration-white/25 underline-offset-4"
          >
            <Printer size={14} />
            View a clearly fictional sample PDF
          </a>
        </div>
        <HeroKeepsake />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-20 rounded-t-[50%] bg-cream sm:h-28" />
    </section>
  );
}

function BotanicalLine() {
  return (
    <svg
      viewBox="0 0 400 600"
      aria-hidden="true"
      className="absolute -right-16 bottom-0 hidden h-[75%] w-auto text-white/[0.055] lg:block"
    >
      <path
        d="M205 600C190 465 210 322 305 100M236 430c-80-42-126-102-145-180m163 116c72-51 110-112 121-182M279 248c-45-48-58-97-53-148m66 104c45-35 69-76 77-123M194 507c-67-29-109-74-132-135"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {[
        [78, 230, -32],
        [115, 290, -18],
        [64, 363, -28],
        [225, 86, 8],
        [265, 142, -4],
        [323, 91, 28],
        [366, 169, 22],
        [344, 258, 35],
        [287, 323, 24],
        [149, 416, -38],
      ].map(([cx, cy, rotate], index) => (
        <ellipse
          key={index}
          cx={cx}
          cy={cy}
          rx="20"
          ry="47"
          fill="currentColor"
          transform={`rotate(${rotate} ${cx} ${cy})`}
        />
      ))}
    </svg>
  );
}

function HeroKeepsake() {
  return (
    <div className="relative mx-auto hidden w-full max-w-md lg:block">
      <div className="drift absolute -left-16 top-16 z-20 w-48 rotate-[-7deg] rounded-sm bg-[#ebe2d3] p-4 text-forest paper-shadow">
        <p className="text-[8px] font-bold uppercase tracking-[0.24em] text-gold">
          A favorite memory
        </p>
        <p className="mt-3 font-display text-lg italic leading-5">
          “She made every kitchen table feel like home.”
        </p>
        <div className="mt-4 flex items-center gap-2">
          <span className="h-px flex-1 bg-forest/15" />
          <Leaf size={11} className="text-sage" />
        </div>
      </div>
      <article className="paper-shadow relative ml-auto aspect-[0.7] w-[84%] rotate-[3deg] overflow-hidden bg-[#fffdf8] p-9 text-center text-forest">
        <div className="absolute inset-x-0 top-0 h-2 bg-sage" />
        <div className="mx-auto mt-6 grid size-32 place-items-center rounded-full border-[5px] border-white bg-[#dce5df] shadow-md">
          <span className="font-display text-4xl text-forest/35">EB</span>
        </div>
        <p className="mt-7 text-[8px] font-bold uppercase tracking-[0.3em] text-gold">
          In loving memory
        </p>
        <h2 className="mt-3 font-display text-4xl font-semibold leading-none">
          Eleanor
          <br />
          Bennett
        </h2>
        <p className="mt-3 text-[9px] tracking-[0.18em] text-forest/40">
          1942 — 2025
        </p>
        <div className="mx-auto my-7 h-px w-14 bg-gold/50" />
        <p className="font-display text-lg italic text-forest/70">
          Loved beyond words.
          <br />
          Remembered beyond measure.
        </p>
        <Leaf className="absolute inset-x-0 bottom-8 mx-auto text-sage/60" size={18} />
      </article>
      <p className="mt-5 max-w-[62%] text-[10px] leading-4 text-white/45">
        A sample design. Eleanor Bennett is invented, and the quotation is an
        example of a family&apos;s wording rather than a customer review.
      </p>
      <div className="absolute -bottom-8 -right-4 z-20 rounded-2xl border border-white/30 bg-white/10 p-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-white text-forest">
            <ShieldCheck size={17} />
          </span>
          <div>
            <p className="text-xs font-bold text-white">Yours to review</p>
            <p className="mt-0.5 text-[9px] text-white/55">
              Nothing publishes without you
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ForEveryChapter() {
  const cards = [
    [Feather, "For a service", "Create a polished program and matching cards when time feels short."],
    [BookHeart, "For their legacy", "Gather the stories and details you never want your family to lose."],
    [Heart, "For yourself", "Make a quiet, private place to return to whenever you miss them."],
  ] as const;
  return (
    <section className="bg-cream px-5 py-16 sm:px-8 lg:py-24">
      <div className="mx-auto max-w-5xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-gold">
          For every chapter of remembrance
        </p>
        <h2 className="mx-auto mt-4 max-w-3xl font-display text-3xl font-semibold leading-tight text-forest sm:text-5xl">
          Whether the loss was yesterday or years ago, their story still
          belongs somewhere beautiful.
        </h2>
        <div className="mt-12 grid gap-4 text-left md:grid-cols-3">
          {cards.map(([Icon, title, copy]) => (
            <div key={title} className="rounded-3xl border border-forest/8 bg-paper p-7">
              <span className="grid size-11 place-items-center rounded-full bg-mist text-forest">
                <Icon size={19} />
              </span>
              <h3 className="mt-5 font-display text-2xl font-semibold text-forest">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-forest/55">{copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    ["01", "Share what feels right", "A name, a photo, a few qualities, and one meaningful memory are enough to begin."],
    ["02", "Read and make it yours", "Receive a carefully structured first draft. Change any word until it sounds like them."],
    ["03", "Keep, share, or print", "Download coordinated files for home or professional printing, plus a private memorial page."],
  ];
  return (
    <section id="how-it-works" className="border-y border-forest/8 bg-paper px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.22em] text-gold">
            Gentle guidance
          </span>
          <h2 className="mt-4 font-display text-5xl font-semibold leading-[0.95] text-forest sm:text-6xl">
            You bring the memories.
            <br />
            <span className="italic text-sage">We help shape them.</span>
          </h2>
          <p className="mt-6 max-w-md text-sm leading-7 text-forest/55">
            No blank page. No design software. Just thoughtful prompts that help
            you remember the details that make a tribute feel personal and true.
          </p>
        </div>
        <div className="grid gap-3">
          {steps.map(([number, title, copy]) => (
            <div key={number} className="flex gap-5 rounded-2xl border border-forest/8 p-5 transition hover:border-sage/50 hover:bg-cream/60 sm:p-6">
              <span className="font-display text-2xl italic text-gold">{number}</span>
              <div>
                <h3 className="font-display text-2xl font-semibold text-forest">{title}</h3>
                <p className="mt-1 max-w-lg text-sm leading-6 text-forest/50">{copy}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Collection() {
  return (
    <section id="collection" className="relative overflow-hidden bg-[#e6ece7] px-5 py-20 sm:px-8 lg:py-28">
      <div className="absolute -right-32 top-10 size-96 rounded-full border border-forest/8" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-2">
        <KeepsakeStack />
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.22em] text-gold">
            One story, thoughtfully coordinated
          </span>
          <h2 className="mt-4 font-display text-5xl font-semibold leading-[0.95] text-forest sm:text-6xl">
            Everything you need,
            <br />
            <span className="italic text-sage">beautifully together.</span>
          </h2>
          <p className="mt-6 max-w-lg text-sm leading-7 text-forest/55">
            Enter their story once. TributeReady carries it across a complete
            collection with consistent wording, typography, and design.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {keepsakes.map(([Icon, text]) => (
              <div key={text} className="flex items-center gap-3 text-sm font-semibold text-forest/75">
                <span className="grid size-8 place-items-center rounded-full bg-white/70 text-forest">
                  <Icon size={14} />
                </span>
                {text}
              </div>
            ))}
          </div>
          <a href="#create" className="mt-9 inline-flex items-center gap-2 rounded-full bg-forest px-6 py-4 text-sm font-bold text-white transition hover:bg-[#235448]">
            Create the collection <ArrowRight size={16} />
          </a>
        </div>
      </div>
    </section>
  );
}

function KeepsakeStack() {
  return (
    <div className="relative min-h-[470px] sm:min-h-[600px]">
      <div className="paper-shadow absolute left-[5%] top-[12%] aspect-[0.72] w-[55%] -rotate-6 bg-paper p-6 text-center">
        <div className="h-1.5 bg-sage" />
        <p className="mt-10 text-[7px] font-bold uppercase tracking-[0.25em] text-gold">In loving memory</p>
        <p className="mt-3 font-display text-2xl font-semibold text-forest">Eleanor Bennett</p>
        <p className="mt-2 text-[8px] text-forest/35">1942 — 2025</p>
        <div className="mx-auto my-5 size-20 rounded-full bg-mist" />
        {[3, 2, 3].map((width, index) => (
          <div key={index} className={`mx-auto mt-2 h-1.5 rounded bg-forest/8 ${width === 2 ? "w-2/3" : "w-3/4"}`} />
        ))}
      </div>
      <div className="paper-shadow absolute right-[5%] top-[5%] aspect-[0.72] w-[55%] rotate-6 bg-[#183f36] p-6 text-center text-white">
        <div className="mx-auto mt-8 size-20 rounded-full border border-white/20 bg-white/10" />
        <p className="mt-7 font-display text-2xl font-semibold">A life of<br />quiet kindness</p>
        <div className="mx-auto my-6 h-px w-10 bg-[#d7bf8d]" />
        <p className="font-display text-sm italic text-white/65">
          “Always leave things a little better than you found them.”
        </p>
      </div>
      <div className="paper-shadow absolute bottom-[7%] right-[18%] z-10 aspect-[1.55] w-[54%] rotate-[-2deg] bg-[#f6efe1] p-6 text-forest">
        <Leaf size={15} className="text-sage" />
        <p className="mt-3 font-display text-xl font-semibold">With heartfelt thanks</p>
        <p className="mt-2 text-[8px] leading-4 text-forest/45">
          Your kindness and support have meant more than words can say.
        </p>
      </div>
    </div>
  );
}

function PurchaseClarity() {
  const details = [
    [
      Check,
      "Preview before purchase",
      "Create and edit the tribute first. Payment is only requested when you choose to download the collection.",
    ],
    [
      LockKeyhole,
      "Checkout handled by Stripe",
      "Stripe processes the payment securely. TributeReady never receives or stores your card number.",
    ],
    [
      Mail,
      "Delivered to your email",
      "After payment, the files and private memorial link are sent to the email entered at checkout.",
    ],
  ] as const;

  return (
    <section className="border-y border-forest/10 bg-paper px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid items-end gap-8 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-gold">
              Clear from the start
            </p>
            <h2 className="mt-4 font-display text-4xl font-semibold text-forest sm:text-5xl">
              One purchase. No subscription or surprise charges.
            </h2>
          </div>
          <div className="rounded-2xl border border-forest/10 bg-cream px-6 py-5 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-forest/45">
              Complete collection
            </p>
            <p className="mt-1 font-display text-4xl font-semibold text-forest">
              $34.99 <span className="text-sm">USD</span>
            </p>
            <p className="mt-1 text-[10px] text-forest/45">One-time payment</p>
          </div>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {details.map(([Icon, title, copy]) => (
            <div key={title} className="rounded-2xl border border-forest/10 p-6">
              <Icon size={19} className="text-sage" />
              <h3 className="mt-4 text-sm font-bold text-forest">{title}</h3>
              <p className="mt-2 text-xs leading-6 text-forest/55">{copy}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-xs leading-6 text-forest/50">
          Questions before purchasing? Email{" "}
          <a
            className="font-bold text-forest underline underline-offset-4"
            href="mailto:care@tributeready.org"
          >
            care@tributeready.org
          </a>
          .
        </p>
      </div>
    </section>
  );
}

function FreeResources() {
  const items = [
    {
      href: "/obituary-templates",
      title: "Obituary templates",
      copy: "Fill-in-the-blank wording for a mother, father, grandparent, spouse, child, or sibling, each with two worked examples.",
    },
    {
      href: "/order-of-service-templates",
      title: "Order of service templates",
      copy: "Complete service outlines with realistic timing for Catholic, Baptist, military, graveside, memorial, and celebration of life services.",
    },
    {
      href: "/eulogy-examples",
      title: "Eulogy examples",
      copy: "Full eulogies written to be said out loud, timed for delivery, with the structure underneath them made explicit.",
    },
    {
      href: "/funeral-readings",
      title: "Funeral poems and readings",
      copy: "Public-domain poems and scripture in full, with the copyright status of each one stated plainly.",
    },
    {
      href: "/funeral-program-template-word",
      title: "Editable Word templates",
      copy: "Bifold and single-sheet funeral programs as .docx files you can open in Word, Google Docs, or Pages and type straight into.",
    },
    {
      href: "/where-to-print-funeral-programs",
      title: "Where to print a program",
      copy: "Same-day print counters with their published cutoffs, which product to ask for, what file to bring, and which paper to choose.",
    },
    {
      href: "/funeral-program-cost",
      title: "Funeral program cost",
      copy: "What drives the bill — design, copies, paper, rush, and funeral-home stationery — without invented retail prices.",
    },
    {
      href: "/funeral-program-examples",
      title: "Funeral program examples",
      copy: "Annotated panel layouts and three common service shapes, plus a fictional sample PDF.",
    },
  ];

  return (
    <section className="border-t border-forest/10 bg-cream px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-gold">
          Free, no sign-up
        </p>
        <h2 className="mt-5 max-w-3xl font-display text-4xl font-semibold leading-[0.95] text-forest sm:text-6xl">
          Use what you need,
          <br />
          <span className="italic text-sage">whether you buy anything or not.</span>
        </h2>
        <p className="mt-6 max-w-2xl text-base leading-8 text-forest/65">
          These libraries are free to copy and print. No account, no email
          address, nothing held back behind a form.
        </p>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {items.map((item) => (
            <article
              key={item.href}
              className="group relative flex flex-col rounded-[2rem] border border-forest/10 bg-paper p-7 shadow-[0_18px_50px_rgba(23,62,53,0.05)] transition hover:-translate-y-1 hover:border-sage"
            >
              <h3 className="font-display text-3xl font-semibold leading-none text-forest">
                <Link href={item.href}>
                  <span className="absolute inset-0" aria-hidden="true" />
                  {item.title}
                </Link>
              </h3>
              <p className="mt-4 text-sm leading-7 text-forest/60">
                {item.copy}
              </p>
              <ArrowRight
                size={18}
                className="mt-auto pt-7 text-gold transition group-hover:translate-x-1"
              />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PrivacyPromise() {
  return (
    <section className="bg-forest px-5 py-20 text-white sm:px-8 lg:py-28">
      <div className="mx-auto max-w-5xl text-center">
        <LockKeyhole className="mx-auto text-[#d8c08e]" size={24} />
        <h2 className="mx-auto mt-5 max-w-3xl font-display text-4xl font-semibold sm:text-6xl">
          Their memories are personal.
          <br />
          <span className="italic text-[#d8c9a8]">We treat them that way.</span>
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-white/55">
          Drafts remain private and nothing is shared until you choose to share
          it. Source files are scheduled for deletion after 30 days.
        </p>
        <div className="mx-auto mt-10 grid max-w-3xl gap-3 sm:grid-cols-3">
          {["Private by default", "You approve every word", "30-day source deletion"].map((item) => (
            <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-xs font-bold text-white/75">
              <Check className="mx-auto mb-2 text-[#d8c08e]" size={15} />
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Questions() {
  const items = [
    ["Will it sound generic or computer-written?", "The draft is shaped from the specific memories, qualities, and phrases you provide. You remain the editor, and every word can be changed before purchase or sharing."],
    ["Can I make a tribute for someone who passed years ago?", "Yes. TributeReady is equally suited to an upcoming service, an anniversary of remembrance, or preserving a family story from long ago."],
    ["What do I receive for $34.99?", "A private memorial page plus coordinated, high-resolution files for a funeral or celebration-of-life program, memorial card, and thank-you card. There is no recurring fee."],
    ["What if there is a problem with my order?", "Email care@tributeready.org. We will correct technical defects or files that do not match the approved preview. Customized digital purchases are otherwise generally non-refundable after delivery, subject to applicable consumer law."],
    ["Do I need design or writing experience?", "No. The guided questions, editable draft, and ready-made layouts handle the structure while keeping you in control of the meaning."],
  ];
  return (
    <section id="questions" className="bg-paper px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-[0.7fr_1.3fr]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-gold">Questions</p>
          <h2 className="mt-4 font-display text-5xl font-semibold leading-none text-forest">Take all the time you need.</h2>
          <p className="mt-5 text-sm leading-7 text-forest/50">
            Begin for free. See and edit the tribute before deciding whether to purchase.
          </p>
        </div>
        <div className="divide-y divide-forest/10 border-y border-forest/10">
          {items.map(([question, answer]) => (
            <details key={question} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-sm font-bold text-forest">
                {question}
                <ChevronDown size={16} className="shrink-0 transition group-open:rotate-180" />
              </summary>
              <p className="max-w-2xl pt-4 text-sm leading-7 text-forest/50">{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCall() {
  return (
    <section className="bg-[#e9eee9] px-5 py-20 text-center sm:px-8">
      <Leaf className="mx-auto text-sage" size={24} />
      <h2 className="mx-auto mt-5 max-w-3xl font-display text-5xl font-semibold leading-[0.95] text-forest sm:text-7xl">
        Their story deserves
        <br />
        <span className="italic text-sage">to be remembered.</span>
      </h2>
      <p className="mx-auto mt-6 max-w-lg text-sm leading-7 text-forest/50">
        Start with a name and one memory. We will help you take it from there.
      </p>
      <a href="#create" className="mt-8 inline-flex items-center gap-2 rounded-full bg-forest px-7 py-4 text-sm font-bold text-white transition hover:bg-[#235448]">
        Begin a tribute <ArrowRight size={16} />
      </a>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-[#102f28] px-5 py-10 text-white sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 sm:flex-row">
        <Link href="/" className="flex items-center gap-2">
          <Leaf size={16} className="text-[#d8c08e]" />
          <span className="font-display text-xl font-semibold">TributeReady</span>
        </Link>
        <p className="text-center text-[10px] leading-5 text-white/35 sm:text-left">
          Thoughtful tools for remembering a life. Not affiliated with any funeral home.
        </p>
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-[10px] font-semibold text-white/50">
          <Link href="/funeral-program-maker" className="transition hover:text-white">Program maker</Link>
          <Link href="/obituary-writer" className="transition hover:text-white">Obituary writer</Link>
          <Link href="/resources" className="transition hover:text-white">Resources</Link>
          <Link href="/obituary-templates" className="transition hover:text-white">Obituary templates</Link>
          <Link href="/order-of-service-templates" className="transition hover:text-white">Order of service</Link>
          <Link href="/eulogy-examples" className="transition hover:text-white">Eulogy examples</Link>
          <Link href="/funeral-readings" className="transition hover:text-white">Funeral readings</Link>
          <Link href="/funeral-program-template-word" className="transition hover:text-white">Word templates</Link>
          <Link href="/where-to-print-funeral-programs" className="transition hover:text-white">Where to print</Link>
          <Link href="/funeral-program-cost" className="transition hover:text-white">Program cost</Link>
          <Link href="/funeral-program-examples" className="transition hover:text-white">Program examples</Link>
          <Link href="/partners" className="transition hover:text-white">For professionals</Link>
          <Link href="/privacy" className="transition hover:text-white">Privacy</Link>
          <Link href="/terms" className="transition hover:text-white">Terms</Link>
          <a href="mailto:care@tributeready.org" className="transition hover:text-white">care@tributeready.org</a>
        </div>
      </div>
    </footer>
  );
}
