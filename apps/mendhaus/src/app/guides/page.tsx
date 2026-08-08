import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Guides",
  description: "Honest buying guides for small home upgrades.",
};

const GUIDES = [
  {
    href: "/guides/renter-friendly-upgrades",
    title: "Renter-friendly upgrades",
    body: "No-drill, over-the-door, tension, and film — without fake deposit promises.",
  },
  {
    href: "/guides/under-sink-organizer",
    title: "Under-sink organizers",
    body: "Measure the P-trap. Buy a drip tray. Ignore lifestyle photos.",
  },
  {
    href: "/guides/pet-hair-hardwood",
    title: "Pet hair on hardwood",
    body: "Rubber brooms and washable rollers. No miracle shed claims.",
  },
  {
    href: "/guides/small-desk-setup",
    title: "Small desk setup",
    body: "Riser, cables, drawer. Weight ratings over gadget piles.",
  },
];

export default function GuidesIndexPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-4xl text-ink">Guides</h1>
      <p className="mt-3 text-ink/70">Useful pages first. Keywords second.</p>
      <ul className="mt-10 space-y-6">
        {GUIDES.map((guide) => (
          <li key={guide.href}>
            <Link href={guide.href} className="font-display text-2xl text-ink hover:text-clay">
              {guide.title}
            </Link>
            <p className="mt-1 text-sm text-ink/70">{guide.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
