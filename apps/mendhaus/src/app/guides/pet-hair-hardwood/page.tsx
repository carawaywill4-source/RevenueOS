import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pet hair on hardwood: what actually works",
  description:
    "Rubber brooms, washable rollers, and floor type. No miracle shed claims — just tools that pick up what you can see.",
};

export default function PetHairGuidePage() {
  return (
    <article className="mx-auto max-w-2xl px-4 py-12 text-sm leading-7 text-ink/80">
      <p className="text-xs uppercase tracking-wide text-moss">Guide</p>
      <h1 className="mt-2 font-display text-4xl text-ink">Pet hair on hardwood: what actually works</h1>
      <p className="mt-4">
        Nothing stops shedding. The useful question is whether you can reset the floor in a few
        minutes without buying a refill every week.
      </p>
      <h2 className="mt-8 font-display text-2xl text-ink">Hardwood and vinyl</h2>
      <p>
        A rubber broom pulls hair into a pile you can dump. It does not replace a vacuum on rugs.
        Check that the head is washable. See the{" "}
        <Link className="text-moss underline" href="/product/rubber-pet-broom">
          rubber pet broom
        </Link>
        .
      </p>
      <h2 className="mt-8 font-display text-2xl text-ink">Upholstery</h2>
      <p>
        A{" "}
        <Link className="text-moss underline" href="/product/washable-lint-roller">
          washable lint roller
        </Link>{" "}
        is slower than disposable sheets and cheaper over a year if you actually rinse it.
      </p>
      <p className="mt-6">
        We will not claim allergy relief, odor elimination, or a coat that “stops shedding.” Floor
        type matters; carpet needs a different tool.
      </p>
    </article>
  );
}
