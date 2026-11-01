import type { TicketType, TunytEvent } from "./tunyt";

/** The price a buyer pays right now (early-bird price while it lasts). Tunyt still decides the final total. */
export function currentPrice(t: TicketType) {
  const earlyBird =
    t.discountedPricePaise != null && (t.discountQuantity == null || t.sold < t.discountQuantity);
  return { price: earlyBird ? t.discountedPricePaise! : t.pricePaise, earlyBird };
}

export function remaining(t: TicketType) {
  return t.quantity == null ? null : Math.max(0, t.quantity - t.sold);
}

const past = (iso: string | null, now: number) => iso != null && new Date(iso).getTime() <= now;
const future = (iso: string | null, now: number) => iso != null && new Date(iso).getTime() > now;

/** Why a ticket type can't be bought right now, or null if it can. */
export function ticketBlocker(t: TicketType, now: number): string | null {
  if (t.paused) return "Paused";
  if (remaining(t) === 0) return "Sold out";
  if (future(t.salesOpensAt, now)) return "Not on sale yet";
  if (past(t.salesClosesAt, now) || past(t.salesCutoff, now)) return "Sales closed";
  return null;
}

/** Why the whole event can't be bought right now, or null if it can. */
export function eventBlocker(e: TunytEvent, now: number): string | null {
  // Only block on statuses that clearly can't sell. Anything else, Tunyt decides at checkout.
  const status = String(e.status ?? "").toUpperCase();
  if (status === "CANCELLED" || status === "CANCELLATION_REQUESTED") return "This event was cancelled";
  if (status === "REJECTED") return "Tickets aren't available for this event";
  if (status === "POSTPONED") return "This event has been postponed";
  if (e.canBuy === false) return "Tickets aren't available for this event";
  if (e.salesPaused) return "Sales are paused right now";
  if (future(e.saleStartsAt, now)) return "Sales haven't opened yet";
  if (past(e.saleEndsAt, now)) return "Sales have ended";
  if (past(e.endsAt ?? e.time, now)) return "This event has ended";
  return null;
}

export const MAX_PER_LINE = 20;
