import "server-only";
import { cacheLife, cacheTag } from "next/cache";

/* ---------- Types (only the fields this site uses) ---------- */

export type TicketType = {
  ticketTypeId: string;
  name: string;
  description?: string | null;
  currency: "INR";
  pricePaise: number;
  discountedPricePaise: number | null;
  discountQuantity: number | null;
  quantity: number | null;
  sold: number;
  feeBornBy: "HOST" | "USER";
  paused: boolean;
  salesOpensAt: string | null;
  salesClosesAt: string | null;
  salesCutoff: string | null;
};

export type TunytEvent = {
  eventId: string;
  title: string;
  description?: string | null;
  status: string;
  visibility?: string;
  date: string;
  time: string;
  endsAt: string | null;
  timezoneOffsetMinutes: number;
  location: string;
  capacity?: number | null;
  canBuy: boolean;
  salesPaused: boolean;
  saleStartsAt: string | null;
  saleEndsAt: string | null;
  banner?: { horizontal?: string; vertical?: string; square?: string } | null;
  thumbnail?: string | null;
  tags?: string[] | null;
  ticketTypes?: TicketType[];
};

export type CheckoutSession = {
  sessionId: string;
  status: "OPEN" | "PAID" | "EXPIRED";
  expireReason: string | null;
  eventId: string;
  items: { ticketTypeId: string; quantity: number }[];
  amountPaise: number;
  currency: "INR";
  bookingId: string | null;
  clientReference: string | null;
  url: string;
  expiresAt: string;
};

export class TunytError extends Error {
  constructor(
    message: string,
    public status: number,
    public requestId?: string,
    public issues?: { path: string; message: string }[],
  ) {
    super(message);
  }
}

/* ---------- Low-level client ---------- */

const API = process.env.TUNYT_API_BASE ?? "https://api.tunyt.com/api/v1";

function secretKey() {
  const key = process.env.TUNYT_SECRET_KEY;
  if (!key) throw new Error("TUNYT_SECRET_KEY is not set");
  return key;
}

/**
 * Key used to read events. The checkout key usually lacks `events:read`, so a
 * separate key can be given: a publishable pk_ key or a read-only sk_ key.
 */
function eventsKey() {
  return process.env.TUNYT_EVENTS_KEY || secretKey();
}

export function siteUrl() {
  const url = process.env.SITE_URL;
  if (!url) throw new Error("SITE_URL is not set (e.g. https://shop.example.com)");
  return url.replace(/\/+$/, "");
}

async function call<T>(
  path: string,
  { key, method = "GET", body, idempotencyKey }: {
    key: string;
    method?: string;
    body?: unknown;
    idempotencyKey?: string;
  },
): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  // pk_ keys only work from their registered origins, so say which site we are.
  if (key.startsWith("pk_")) headers.Origin = siteUrl();

  // One retry on 409 request_in_progress / 429 / 5xx. Same Idempotency-Key, so it is safe.
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(API + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    const json = await res.json().catch(() => null);
    if (res.ok) return json.data as T;

    const retryable = res.status === 429 || res.status >= 500 || json?.message === "request_in_progress";
    if (retryable && attempt < 1) {
      const wait = Number(res.headers.get("Retry-After") ?? 1);
      await new Promise((r) => setTimeout(r, Math.min(wait, 3) * 1000));
      continue;
    }
    console.error("[tunyt]", method, path, res.status, json?.message, json?.requestId);
    throw new TunytError(json?.message ?? `HTTP ${res.status}`, res.status, json?.requestId, json?.issues);
  }
}

/* ---------- Events (cached for a minute) ---------- */

/** Events that are approved, buyable and have not ended, soonest first. */
export async function getLiveEvents(): Promise<TunytEvent[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("events");

  const events: TunytEvent[] = [];
  let cursor: string | null = null;
  do {
    const qs = new URLSearchParams({ status: "APPROVED", limit: "100" });
    if (cursor) qs.set("cursor", cursor);
    const page: { items: TunytEvent[]; nextCursor: string | null } = await call(
      `/partner/events?${qs}`,
      { key: eventsKey() },
    );
    events.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor && events.length < 500);

  const now = Date.now();
  return events
    .filter((e) => e.status === "APPROVED" && e.visibility !== "PRIVATE")
    .filter((e) => new Date(e.endsAt ?? e.time).getTime() > now)
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
}

export async function getEvent(eventId: string): Promise<TunytEvent | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("events", `event-${eventId}`);

  try {
    return await call<TunytEvent>(`/partner/events/${encodeURIComponent(eventId)}`, { key: eventsKey() });
  } catch (e) {
    if (e instanceof TunytError && e.status === 404) return null;
    throw e;
  }
}

/* ---------- Checkout ---------- */

export function createCheckoutSession(input: {
  orderId: string;
  eventId: string;
  items: { ticketTypeId: string; quantity: number }[];
  successUrl: string;
  cancelUrl: string;
}) {
  return call<CheckoutSession>("/partner/checkout-sessions", {
    key: secretKey(),
    method: "POST",
    idempotencyKey: `order-${input.orderId}`,
    body: {
      eventId: input.eventId,
      items: input.items,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      clientReference: input.orderId,
    },
  });
}

export function getCheckoutSession(sessionId: string) {
  return call<CheckoutSession>(`/partner/checkout-sessions/${encodeURIComponent(sessionId)}`, {
    key: secretKey(),
  });
}
