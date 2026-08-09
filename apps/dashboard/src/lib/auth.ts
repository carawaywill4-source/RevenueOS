import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Single-owner bearer auth. The dashboard is a solo tool; no user
 * management. Set DASHBOARD_TOKEN in .env.local, then visit
 * `/login?token=…` once to drop a cookie.
 */

const COOKIE = "revenueos_dashboard_token";
const MAX_AGE = 60 * 60 * 24 * 30;

export async function requireOwner(): Promise<void> {
  const expected = process.env.DASHBOARD_TOKEN;
  if (!expected) return; // unset = open (dev)
  const store = await cookies();
  const supplied = store.get(COOKIE)?.value;
  if (!supplied || supplied !== expected) {
    redirect("/login");
  }
}

export async function trySignIn(token: string): Promise<boolean> {
  const expected = process.env.DASHBOARD_TOKEN;
  if (!expected) return true;
  if (token !== expected) return false;
  const store = await cookies();
  store.set(COOKIE, expected, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE,
    path: "/",
  });
  return true;
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}
