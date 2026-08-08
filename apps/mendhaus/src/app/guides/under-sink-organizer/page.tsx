import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How to choose an under-sink organizer that actually fits",
  description:
    "Measure width, P-trap height, and drip trays before you buy an under-sink caddy. Honest fit notes for apartment kitchens.",
};

export default function UnderSinkGuidePage() {
  return (
    <article className="mx-auto max-w-2xl px-4 py-12 text-sm leading-7 text-ink/80">
      <p className="text-xs uppercase tracking-wide text-moss">Guide</p>
      <h1 className="mt-2 font-display text-4xl text-ink">
        How to choose an under-sink organizer that actually fits
      </h1>
      <p className="mt-4">
        Most under-sink caddies fail for one reason: the pipes. A garbage disposal or a low P-trap
        steals the space a two-tier rack was photographed in. Measure before you order.
      </p>
      <ol className="mt-4 list-decimal space-y-3 pl-5">
        <li>Interior cabinet width at the narrowest point (usually behind the door frame).</li>
        <li>Clear height under the P-trap or disposal.</li>
        <li>Whether you need an L-shaped or split tier to go around the drain.</li>
        <li>A removable drip tray. Bottles leak. A molded one-piece tub is harder to clean.</li>
      </ol>
      <p className="mt-6">
        The{" "}
        <Link className="text-moss underline" href="/product/under-sink-caddy">
          Basin Rail Under-Sink Caddy
        </Link>{" "}
        is the SKU we start with: two tiers, drip tray, US warehouse shipping. Pair it with the{" "}
        <Link className="text-moss underline" href="/product/sink-sponge-caddy">
          sink sponge caddy
        </Link>{" "}
        if the daily mess is on the counter, not only under the sink.
      </p>
      <p className="mt-4">
        An organizer does not stop leaks. It keeps bottles out of standing water so you notice a
        drip sooner.
      </p>
    </article>
  );
}
