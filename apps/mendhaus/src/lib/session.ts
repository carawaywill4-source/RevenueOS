const KEY = "mh_session";

export function getOrCreateSessionId() {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(KEY, id);
  }
  return id;
}

export function readAttributionCookie() {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )mh_attr=([^;]*)/);
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}
