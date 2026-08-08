import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Purchase = {
  id: string;
  email: string;
  productId: string;
  amountUsd: number;
  stripeSessionId: string;
  createdAt: string;
  downloadToken: string;
};

const file = () =>
  path.join(
    process.env.REVENUEOS_LEDGER_DIR ||
      (process.env.VERCEL ? "/tmp/revenueos" : ".data/revenueos"),
    "purchases.json",
  );

async function load(): Promise<Purchase[]> {
  try {
    return JSON.parse(await readFile(file(), "utf8")) as Purchase[];
  } catch {
    return [];
  }
}

async function save(rows: Purchase[]) {
  await mkdir(path.dirname(file()), { recursive: true });
  await writeFile(file(), JSON.stringify(rows, null, 2), "utf8");
}

export async function recordPurchase(p: Purchase) {
  const rows = await load();
  if (rows.some((r) => r.stripeSessionId === p.stripeSessionId)) return;
  rows.unshift(p);
  await save(rows);
}

export async function getPurchaseByToken(token: string) {
  return (await load()).find((r) => r.downloadToken === token) ?? null;
}

export async function purchaseStats() {
  const rows = await load();
  const revenue = rows.reduce((s, r) => s + r.amountUsd, 0);
  return { purchases: rows.length, revenueUsd: revenue };
}

export function newDownloadToken() {
  return `dl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
