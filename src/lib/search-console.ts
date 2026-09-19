/**
 * Optional Search Console / Bing Search Analytics sensor.
 *
 * Until GOOGLE_SEARCH_CONSOLE_* (or Bing) credentials are connected, every
 * field stays null — governor uses on-site proxies only. This module is the
 * single host choke point so wiring OAuth later does not require brain changes.
 */

export type SearchConsoleDoorMetrics = {
  indexed: boolean | null;
  impressions: number | null;
  clicks: number | null;
};

export type SearchConsoleCoverage = {
  indexedUrls: number | null;
  configured: boolean;
};

export function searchConsoleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL &&
      (process.env.GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN ||
        process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
  );
}

export async function readSearchConsoleDoorMetrics(
  _pageUrl: string,
): Promise<SearchConsoleDoorMetrics> {
  if (!searchConsoleConfigured()) {
    return { indexed: null, impressions: null, clicks: null };
  }
  // Credentials present but API client not yet implemented — stay honest.
  // Do not invent SERP numbers from IndexNow or sitemap pings.
  return { indexed: null, impressions: null, clicks: null };
}

export async function readSearchConsoleCoverage(): Promise<SearchConsoleCoverage> {
  if (!searchConsoleConfigured()) {
    return { indexedUrls: null, configured: false };
  }
  return { indexedUrls: null, configured: true };
}
