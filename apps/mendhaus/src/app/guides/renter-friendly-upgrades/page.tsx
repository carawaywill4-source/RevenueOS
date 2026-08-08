import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Renter-friendly upgrades that do not require a drill",
  description:
    "Over-the-door, tension, and freestanding upgrades for apartments. Honest about paint, leases, and what comes with you when you move.",
};

export default function RenterGuidePage() {
  return (
    <article className="mx-auto max-w-2xl px-4 py-12 text-sm leading-7 text-ink/80">
      <p className="text-xs uppercase tracking-wide text-moss">Guide</p>
      <h1 className="mt-2 font-display text-4xl text-ink">
        Renter-friendly upgrades that do not require a drill
      </h1>
      <p className="mt-4">
        A better apartment usually fails on small annoyances: nowhere to hang a coat, a steamy
        bathroom with no storage, shoes piled by the door. You do not need permission for every
        small fix — but you do need to know what leaves marks.
      </p>
      <h2 className="mt-8 font-display text-2xl text-ink">Start with gravity and tension</h2>
      <p>
        Over-the-door hooks and shoe organizers use the door, not the wall. Tension shower caddies
        use spring pressure. Freestanding coat trees leave the drywall alone. They come down when
        the lease does. Measure door thickness and shower width before you buy.
      </p>
      <ul className="mt-4 list-disc space-y-2 pl-5">
        <li>
          <Link className="text-moss underline" href="/product/over-door-hook-rack">
            Over-door hook rack
          </Link>
        </li>
        <li>
          <Link className="text-moss underline" href="/product/tension-shower-caddy">
            Tension shower caddy
          </Link>
        </li>
        <li>
          <Link className="text-moss underline" href="/product/over-door-shoe-organizer">
            Over-door shoe organizer
          </Link>
        </li>
        <li>
          <Link className="text-moss underline" href="/product/freestanding-coat-tree">
            Freestanding coat tree
          </Link>
        </li>
        <li>
          <Link className="text-moss underline" href="/product/shower-squeegee">
            Shower glass squeegee
          </Link>
        </li>
      </ul>
      <h2 className="mt-8 font-display text-2xl text-ink">What we will not claim</h2>
      <p>
        Adhesive results depend on paint, humidity, and how you remove them. We will never promise
        that a product is “landlord approved” or that your deposit is safe. Read your lease. If a
        listing requires screws into tile, skip it.
      </p>
    </article>
  );
}
