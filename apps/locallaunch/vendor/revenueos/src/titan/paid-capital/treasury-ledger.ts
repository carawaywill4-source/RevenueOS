/**
 * Double-entry-style internal capital ledger.
 * Never infer available cash merely from a Stripe balance.
 */

import { newId } from "../../ledger/store";
import type { CapitalState, LedgerEntry, PaidPlatform } from "./types";

export type Reservation = {
  reservation_id: string;
  authorization_id: string;
  business_id: string;
  campaign_id: string;
  platform: PaidPlatform;
  amount_usd: number;
  created_at: string;
  expires_at: string;
  state: "ACTIVE" | "COMMITTED" | "RELEASED" | "EXPIRED";
};

export type TreasuryLedger = {
  entries: LedgerEntry[];
  reservations: Reservation[];
  /** Day key YYYY-MM-DD for day-boundary accounting. */
  day_key: string;
};

export function createTreasuryLedger(now = new Date()): TreasuryLedger {
  return {
    entries: [],
    reservations: [],
    day_key: dayKey(now),
  };
}

export function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Roll ledger day — releases expired reservations; does not invent cash. */
export function ensureLedgerDay(ledger: TreasuryLedger, now = new Date()): TreasuryLedger {
  const key = dayKey(now);
  if (ledger.day_key === key) {
    return expireReservations(ledger, now);
  }
  return expireReservations(
    {
      ...ledger,
      day_key: key,
      // Day boundary: committed/spent history stays in entries; active auths do not carry.
      reservations: ledger.reservations.map((r) =>
        r.state === "ACTIVE" ? { ...r, state: "EXPIRED" as const } : r,
      ),
    },
    now,
  );
}

export function postEntry(
  ledger: TreasuryLedger,
  input: {
    debit: CapitalState;
    credit: CapitalState;
    amount_usd: number;
    business_id?: string;
    campaign_id?: string;
    platform?: PaidPlatform;
    memo: string;
    evidence_refs?: string[];
    at?: string;
  },
): TreasuryLedger {
  if (input.amount_usd <= 0) return ledger;
  const entry: LedgerEntry = {
    entry_id: newId("tled"),
    at: input.at ?? new Date().toISOString(),
    debit_state: input.debit,
    credit_state: input.credit,
    amount_usd: Number(input.amount_usd.toFixed(2)),
    business_id: input.business_id,
    campaign_id: input.campaign_id,
    platform: input.platform,
    memo: input.memo,
    evidence_refs: input.evidence_refs ?? [],
  };
  return { ...ledger, entries: [...ledger.entries, entry] };
}

/**
 * Atomic reservation against remaining daily allowance.
 * Concurrent agents cannot double-spend the same allowance if they share this ledger.
 */
export function reserveAuthorization(
  ledger: TreasuryLedger,
  input: {
    authorization_id: string;
    business_id: string;
    campaign_id: string;
    platform: PaidPlatform;
    amount_usd: number;
    remaining_ceiling_usd: number;
    ttl_ms?: number;
    now?: Date;
  },
): { ok: boolean; ledger: TreasuryLedger; reservation?: Reservation; reason: string } {
  const now = input.now ?? new Date();
  let next = ensureLedgerDay(ledger, now);
  next = expireReservations(next, now);

  const activeReserved = next.reservations
    .filter((r) => r.state === "ACTIVE")
    .reduce((a, r) => a + r.amount_usd, 0);

  const room = input.remaining_ceiling_usd - activeReserved;
  if (input.amount_usd <= 0) {
    return { ok: false, ledger: next, reason: "non_positive_amount" };
  }
  if (input.amount_usd > room + 1e-9) {
    return {
      ok: false,
      ledger: next,
      reason: `reservation_exceeds_remaining_ceiling:need=${input.amount_usd};room=${room.toFixed(2)}`,
    };
  }

  const reservation: Reservation = {
    reservation_id: newId("tres"),
    authorization_id: input.authorization_id,
    business_id: input.business_id,
    campaign_id: input.campaign_id,
    platform: input.platform,
    amount_usd: Number(input.amount_usd.toFixed(2)),
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + (input.ttl_ms ?? 15 * 60_000)).toISOString(),
    state: "ACTIVE",
  };

  next = {
    ...next,
    reservations: [...next.reservations, reservation],
  };
  next = postEntry(next, {
    debit: "AVAILABLE",
    credit: "AD_AUTHORIZED",
    amount_usd: reservation.amount_usd,
    business_id: input.business_id,
    campaign_id: input.campaign_id,
    platform: input.platform,
    memo: `reserve ${reservation.reservation_id}`,
    at: now.toISOString(),
  });

  return { ok: true, ledger: next, reservation, reason: "reserved" };
}

export function commitReservation(
  ledger: TreasuryLedger,
  reservationId: string,
  now = new Date(),
): TreasuryLedger {
  const r = ledger.reservations.find((x) => x.reservation_id === reservationId);
  if (!r || r.state !== "ACTIVE") return ledger;
  let next: TreasuryLedger = {
    ...ledger,
    reservations: ledger.reservations.map((x) =>
      x.reservation_id === reservationId ? { ...x, state: "COMMITTED" as const } : x,
    ),
  };
  next = postEntry(next, {
    debit: "AD_AUTHORIZED",
    credit: "AD_COMMITTED",
    amount_usd: r.amount_usd,
    business_id: r.business_id,
    campaign_id: r.campaign_id,
    platform: r.platform,
    memo: `commit ${reservationId}`,
    at: now.toISOString(),
  });
  return next;
}

export function recordSpend(
  ledger: TreasuryLedger,
  input: {
    reservation_id?: string;
    business_id: string;
    campaign_id: string;
    platform: PaidPlatform;
    amount_usd: number;
    now?: Date;
  },
): TreasuryLedger {
  const now = input.now ?? new Date();
  let next = ledger;
  if (input.reservation_id) {
    next = commitReservation(next, input.reservation_id, now);
  }
  return postEntry(next, {
    debit: "AD_COMMITTED",
    credit: "AD_SPENT",
    amount_usd: input.amount_usd,
    business_id: input.business_id,
    campaign_id: input.campaign_id,
    platform: input.platform,
    memo: "ad_spent",
    at: now.toISOString(),
  });
}

export function releaseReservation(
  ledger: TreasuryLedger,
  reservationId: string,
  now = new Date(),
): TreasuryLedger {
  const r = ledger.reservations.find((x) => x.reservation_id === reservationId);
  if (!r || r.state !== "ACTIVE") return ledger;
  let next: TreasuryLedger = {
    ...ledger,
    reservations: ledger.reservations.map((x) =>
      x.reservation_id === reservationId ? { ...x, state: "RELEASED" as const } : x,
    ),
  };
  next = postEntry(next, {
    debit: "AD_AUTHORIZED",
    credit: "AVAILABLE",
    amount_usd: r.amount_usd,
    business_id: r.business_id,
    campaign_id: r.campaign_id,
    platform: r.platform,
    memo: `release ${reservationId}`,
    at: now.toISOString(),
  });
  return next;
}

function expireReservations(ledger: TreasuryLedger, now: Date): TreasuryLedger {
  let next = ledger;
  for (const r of ledger.reservations) {
    if (r.state === "ACTIVE" && new Date(r.expires_at).getTime() <= now.getTime()) {
      next = {
        ...next,
        reservations: next.reservations.map((x) =>
          x.reservation_id === r.reservation_id ? { ...x, state: "EXPIRED" as const } : x,
        ),
      };
      next = postEntry(next, {
        debit: "AD_AUTHORIZED",
        credit: "AVAILABLE",
        amount_usd: r.amount_usd,
        business_id: r.business_id,
        campaign_id: r.campaign_id,
        platform: r.platform,
        memo: `expire ${r.reservation_id}`,
        at: now.toISOString(),
      });
    }
  }
  return next;
}

export function sumActiveReservations(ledger: TreasuryLedger): number {
  return ledger.reservations
    .filter((r) => r.state === "ACTIVE")
    .reduce((a, r) => a + r.amount_usd, 0);
}

export function sumSpentToday(ledger: TreasuryLedger): number {
  return ledger.entries
    .filter((e) => e.credit_state === "AD_SPENT" && e.at.slice(0, 10) === ledger.day_key)
    .reduce((a, e) => a + e.amount_usd, 0);
}
