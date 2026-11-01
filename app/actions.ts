"use server";

import { redirect } from "next/navigation";
import {
  createCheckoutSession,
  expireCheckoutSession,
  getCheckoutSession,
  siteUrl,
  TunytError,
} from "@/lib/tunyt";
import { MAX_PER_LINE } from "@/lib/tickets";
import { myOrderIds, rememberOrder } from "@/lib/orders";

export type CheckoutState = {
  error: string | null;
  /** Set once a session exists: the page then runs the on-site login + payment frame. */
  session?: { sessionId: string; url: string; amountPaise: number; expiresAt: string; nonce: string };
};

const ID = /^[A-Za-z0-9_-]{1,100}$/;

const FRIENDLY: Record<string, string> = {
  event_not_published: "This event isn't open for sale yet.",
  event_has_no_tickets: "This event has no tickets on sale.",
  sales_paused: "Sales are paused right now. Please try again later.",
  sale_not_started: "Sales haven't opened yet.",
  sale_ended: "Sales for this event have ended.",
  approval_events_not_supported: "This event can't be booked from this site.",
  reserved_seating_not_supported: "This event can't be booked from this site.",
  return_url_origin_not_allowed: "Checkout isn't set up correctly for this site (return URL not allowed).",
  allowed_origins_required: "Checkout isn't set up correctly for this site (key has no allowed origins).",
};

export async function startCheckout(_prev: CheckoutState, form: FormData): Promise<CheckoutState> {
  const eventId = String(form.get("eventId") ?? "");
  if (!ID.test(eventId)) return { error: "Unknown event." };

  // Quantities arrive as qty:<ticketTypeId> = n. Prices are never taken from the browser.
  const items: { ticketTypeId: string; quantity: number }[] = [];
  for (const [name, value] of form.entries()) {
    if (!name.startsWith("qty:")) continue;
    const ticketTypeId = name.slice(4);
    const quantity = Number(value);
    if (!ID.test(ticketTypeId) || !Number.isInteger(quantity) || quantity < 0 || quantity > MAX_PER_LINE) {
      return { error: "Please check the ticket quantities." };
    }
    if (quantity > 0) items.push({ ticketTypeId, quantity });
  }
  if (items.length === 0) return { error: "Pick at least one ticket." };
  if (items.length > 10) return { error: "You can pick up to 10 ticket types at once." };

  const orderId = crypto.randomUUID();
  const base = siteUrl();
  let session;
  try {
    session = await createCheckoutSession({
      orderId,
      eventId,
      items,
      successUrl: `${base}/thanks`,
      cancelUrl: `${base}/events/${encodeURIComponent(eventId)}?cancelled=1`,
    });
  } catch (e) {
    if (e instanceof TunytError) {
      if (e.status === 429) return { error: "We're busy right now. Please try again in a few seconds." };
      const detail = e.issues?.map((i) => i.message).join(", ");
      return {
        error: FRIENDLY[e.message] ?? `Couldn't start checkout: ${detail || e.message}` +
          (e.requestId ? ` (ref ${e.requestId})` : ""),
      };
    }
    console.error(e);
    return { error: "Couldn't start checkout. Please try again." };
  }

  // Remember which orders this browser started, so /thanks shows tickets only to the buyer.
  await rememberOrder(orderId);

  // Hosted mode: send the buyer to tunyt.com. Default: stay on this site (embedded checkout).
  if (process.env.CHECKOUT_MODE === "hosted") redirect(session.url);
  return {
    error: null,
    session: {
      sessionId: session.sessionId,
      url: session.url,
      amountPaise: session.amountPaise,
      expiresAt: session.expiresAt,
      nonce: orderId,
    },
  };
}

/** Status of a checkout this browser started (used when resuming). Others read as gone. */
export async function checkoutStatus(sessionId: string): Promise<"OPEN" | "PAID" | "EXPIRED" | "GONE"> {
  if (!ID.test(sessionId)) return "GONE";
  try {
    const s = await getCheckoutSession(sessionId);
    if (!s.clientReference || !(await myOrderIds()).includes(s.clientReference)) return "GONE";
    return s.status;
  } catch (e) {
    if (e instanceof TunytError && e.status === 404) return "GONE";
    return "OPEN"; // network hiccup: let the buyer carry on, Tunyt still guards the payment
  }
}

/** Cancel an open checkout this browser started (when the buyer starts over). */
export async function cancelCheckout(sessionId: string): Promise<void> {
  if (!ID.test(sessionId)) return;
  try {
    const s = await getCheckoutSession(sessionId);
    if (s.status !== "OPEN" || !s.clientReference || !(await myOrderIds()).includes(s.clientReference)) return;
    await expireCheckoutSession(sessionId);
  } catch (e) {
    console.error("[checkout] cancel", sessionId, e);
  }
}
