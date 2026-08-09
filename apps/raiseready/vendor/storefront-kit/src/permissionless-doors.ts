import type { BrandConfig } from "./types";

export type IntentDoor = {
  slug: string;
  title: string;
  intentQuery: string;
  body: string;
  kind: "static" | "programmatic" | "free_resource" | "comparison" | "howto";
};

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
}

/** Deterministic long-tail + free-resource doors — no account, no owner. */
export function expandPermissionlessDoors(brand: BrandConfig): IntentDoor[] {
  const doors: IntentDoor[] = brand.discoveryDoors.map((d) => ({
    ...d,
    kind: "static" as const,
  }));

  const product = brand.product.name;
  const price = brand.product.priceUsd;
  const audience = brand.product.audience;

  for (const kw of brand.product.intentKeywords) {
    const slug = slugify(kw);
    if (doors.some((d) => d.slug === slug)) continue;
    doors.push({
      slug,
      title: `${kw[0]?.toUpperCase()}${kw.slice(1)}`,
      intentQuery: kw,
      body: `A practical page for people searching “${kw}”. ${product} ($${price}) is built for ${audience} who need this solved today — not a course, not a waitlist.`,
      kind: "programmatic",
    });
  }

  const freeSlug = slugify(`free-${brand.product.slug}-checklist`);
  if (!doors.some((d) => d.slug === freeSlug)) {
    doors.push({
      slug: freeSlug,
      title: `Free ${product} starter checklist`,
      intentQuery: `free ${brand.product.intentKeywords[0] ?? brand.product.slug}`,
      body: `A free, usable starter checklist for ${audience}. Use it as-is — when you want the full pack with scripts and worksheets, get ${product} for $${price}.`,
      kind: "free_resource",
    });
  }

  const compareSlug = slugify(`${brand.product.slug}-vs-doing-it-yourself`);
  if (!doors.some((d) => d.slug === compareSlug)) {
    doors.push({
      slug: compareSlug,
      title: `${product} vs doing it yourself`,
      intentQuery: `${brand.product.intentKeywords[0] ?? product} template vs diy`,
      body: `DIY works if you have hours. ${product} is the shortcut: copy-paste assets for $${price}, built for ${audience}.`,
      kind: "comparison",
    });
  }

  const howtoSlug = slugify(`how-to-${brand.product.slug}-in-one-evening`);
  if (!doors.some((d) => d.slug === howtoSlug)) {
    doors.push({
      slug: howtoSlug,
      title: `How to use ${product} in one evening`,
      intentQuery: `how to ${brand.product.intentKeywords[0] ?? brand.product.slug}`,
      body: `Step-by-step: open the kit, pick the script that matches your situation, fill the blanks, send. Designed for ${audience}.`,
      kind: "howto",
    });
  }

  return doors;
}

export function doorBySlug(brand: BrandConfig, slug: string): IntentDoor | undefined {
  return expandPermissionlessDoors(brand).find((d) => d.slug === slug);
}
