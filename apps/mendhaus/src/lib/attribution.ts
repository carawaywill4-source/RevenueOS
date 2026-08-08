export type Attribution = {
  channel: string;
  persona: string;
  angleIndex: number;
  landingPath: string;
  referrerHost?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  experimentId?: string;
  patternKey: string;
  capturedAt: string;
};

const COOKIE = "mh_attr";

export function patternKey(a: Pick<Attribution, "channel" | "persona" | "angleIndex">) {
  return `acq:${a.channel}:${a.persona}:a${a.angleIndex}`;
}

export function parseAttribution(raw: string | undefined | null): Attribution | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Attribution;
    if (!value.channel || !value.persona) return null;
    return value;
  } catch {
    return null;
  }
}

export function attributionFromSearch(
  search: URLSearchParams,
  landingPath: string,
  referrerHost?: string,
): Attribution {
  const channel =
    search.get("utm_medium") ||
    search.get("channel") ||
    (referrerHost ? "referral" : "direct");
  const persona = search.get("persona") || "renter";
  const angleIndex = Math.max(0, Number(search.get("a") ?? "0") || 0);
  const attr: Attribution = {
    channel: sanitize(channel),
    persona: sanitize(persona),
    angleIndex,
    landingPath,
    referrerHost,
    utmSource: search.get("utm_source") ?? undefined,
    utmMedium: search.get("utm_medium") ?? undefined,
    utmCampaign: search.get("utm_campaign") ?? undefined,
    experimentId: search.get("exp") ?? undefined,
    patternKey: "",
    capturedAt: new Date().toISOString(),
  };
  attr.patternKey = patternKey(attr);
  return attr;
}

function sanitize(value: string) {
  return value.replace(/[^a-zA-Z0-9._~-]/g, "").slice(0, 64) || "direct";
}

export { COOKIE as ATTRIBUTION_COOKIE };
