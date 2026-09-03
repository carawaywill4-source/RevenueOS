/**
 * Optional Search Console / Bing Search Analytics sensor (Mendhaus host).
 * Same contract as TributeReady — null until credentials + API client exist.
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
  return { indexed: null, impressions: null, clicks: null };
}

export async function readSearchConsoleCoverage(): Promise<SearchConsoleCoverage> {
  if (!searchConsoleConfigured()) {
    return { indexedUrls: null, configured: false };
  }
  return { indexedUrls: null, configured: true };
}
