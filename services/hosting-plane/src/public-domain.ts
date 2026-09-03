/**
 * Canonical public hostname for native Azure portfolio sites.
 * Uses sslip.io against the VM public IP so TLS works without external DNS.
 */

export function nativePublicBaseHost(): string {
  return (
    process.env.HOSTING_PUBLIC_BASE_HOST ||
    process.env.REVENUEOS_PUBLIC_BASE_HOST ||
    "130.131.15.68.sslip.io"
  );
}

export function nativeSiteDomain(siteId: string): string {
  const base = nativePublicBaseHost().replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `${siteId}.${base}`;
}

export function nativeSiteUrl(siteId: string): string {
  return `https://${nativeSiteDomain(siteId)}`;
}
