/**
 * Canonical buy URL. Gumroad is the public store. sslip.io is the backup checkout.
 */

export const GUMROAD_LIVE: Record<string, string> = {
  buildgrid: "https://willowdreams682.gumroad.com/l/dlfcqr",
  invoicechaser: "https://willowdreams682.gumroad.com/l/huwimk",
  listinglift: "https://willowdreams682.gumroad.com/l/ofsnxz",
  quotecraft: "https://willowdreams682.gumroad.com/l/nkala",
  guestlane: "https://willowdreams682.gumroad.com/l/yocqcb",
  raiseready: "https://willowdreams682.gumroad.com/l/pofmua",
  launchcopy: "https://willowdreams682.gumroad.com/l/outjhn",
  locallaunch: "https://willowdreams682.gumroad.com/l/lprjbs",
  depositproof: "https://willowdreams682.gumroad.com/l/qiptax",
  resumeforge: "https://willowdreams682.gumroad.com/l/xuqyim",
};

export function buyUrlFor(businessId: string, fallback?: string): string {
  return (
    GUMROAD_LIVE[businessId] ||
    fallback ||
    `https://${businessId}.${process.env.HOSTING_PUBLIC_BASE_HOST || "130.131.15.68.sslip.io"}/`
  );
}

export function trackedBuyUrl(
  businessId: string,
  sourceHost: string,
  fallback?: string,
): string {
  const base = buyUrlFor(businessId, fallback);
  try {
    const u = new URL(base);
    u.searchParams.set("utm_source", utmKeyForHost(sourceHost));
    u.searchParams.set("utm_medium", "channel");
    u.searchParams.set("utm_campaign", businessId);
    return u.toString();
  } catch {
    return base;
  }
}

export function utmKeyForHost(host: string): string {
  return host
    .replace(/^www\./, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export function isGumroadLive(businessId: string): boolean {
  return Boolean(GUMROAD_LIVE[businessId]);
}
