"use client";

import { useSyncExternalStore } from "react";

/**
 * The buyer's in-progress checkout, kept in localStorage so closing the pop-up, reloading or
 * coming back within the session's 30 minutes picks up where they left off.
 */
export type SavedCheckout = {
  eventId: string;
  sessionId: string;
  url: string;
  amountPaise: number;
  expiresAt: string;
  items: { ticketTypeId: string; quantity: number }[];
  /** For the order summary in the pop-up. */
  eventTitle?: string;
  lines?: { name: string; quantity: number }[];
  open: boolean;
  step: "identify" | "code" | "pay";
  identifier?: string;
  token?: string;
  buyerName?: string | null;
};

const KEY = "tunyt-checkout-v1";
let memory: string | null = null; // fallback when storage is blocked
const listeners = new Set<() => void>();

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return memory;
  }
}

function writeRaw(v: string | null) {
  memory = v;
  try {
    if (v == null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, v);
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => e.key === KEY && cb();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function parseCheckout(raw: string | null): SavedCheckout | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as SavedCheckout;
    if (!c?.sessionId || !c.expiresAt) return null;
    if (new Date(c.expiresAt).getTime() <= Date.now()) return null; // timed out
    return c;
  } catch {
    return null;
  }
}

export const checkoutStore = {
  save(c: SavedCheckout) {
    writeRaw(JSON.stringify(c));
  },
  update(patch: Partial<SavedCheckout>) {
    const c = parseCheckout(readRaw());
    if (c) writeRaw(JSON.stringify({ ...c, ...patch }));
  },
  clear() {
    writeRaw(null);
  },
  current() {
    return parseCheckout(readRaw());
  },
};

/** Raw string snapshot (stable between renders); parse it with parseCheckout. */
export function useSavedCheckoutRaw() {
  return useSyncExternalStore(subscribe, readRaw, () => null);
}

export function sameItems(a: SavedCheckout["items"], b: SavedCheckout["items"]) {
  const key = (x: SavedCheckout["items"]) =>
    x.filter((i) => i.quantity > 0).map((i) => `${i.ticketTypeId}:${i.quantity}`).sort().join(",");
  return key(a) === key(b);
}
