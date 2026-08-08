import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "A small desk setup: riser, cables, drawer",
  description:
    "Raise the screen, clip the cables, keep a small home-office desk usable. Weight ratings and adhesive notes — no medical claims.",
};

export default function DeskGuidePage() {
  return (
    <article className="mx-auto max-w-2xl px-4 py-12 text-sm leading-7 text-ink/80">
      <p className="text-xs uppercase tracking-wide text-moss">Guide</p>
      <h1 className="mt-2 font-display text-4xl text-ink">A small desk setup that stays usable</h1>
      <p className="mt-4">
        Most “WFH aesthetic” photos hide a 72-inch desk. If you have 40 inches, you need height,
        cable routing, and a place for pens — not another gadget.
      </p>
      <ol className="mt-4 list-decimal space-y-3 pl-5">
        <li>
          Measure desk depth. A riser that hangs off the back will dump a monitor.
        </li>
        <li>
          Check weight ratings. The{" "}
          <Link className="text-moss underline" href="/product/aluminum-laptop-riser">
            aluminum laptop riser
          </Link>{" "}
          and{" "}
          <Link className="text-moss underline" href="/product/monitor-stand-drawer">
            monitor stand with drawer
          </Link>{" "}
          are the two we stock first.
        </li>
        <li>
          Route cables with{" "}
          <Link className="text-moss underline" href="/product/desk-cable-clips">
            under-desk cable clips
          </Link>{" "}
          or a{" "}
          <Link className="text-moss underline" href="/product/cable-sleeve-kit">
            cable sleeve kit
          </Link>
          . Use adhesive only if you accept possible finish marks.
        </li>
        <li>
          If your chair leaves your lower back unsupported by afternoon, a{" "}
          <Link className="text-moss underline" href="/product/lumbar-pillow">
            desk lumbar pillow
          </Link>{" "}
          is cheaper than a new chair — and not a medical device.
        </li>
      </ol>
      <p className="mt-6">
        None of this is medical advice. A higher screen often feels better by mid-afternoon. It is
        not a treatment for neck injury.
      </p>
    </article>
  );
}
