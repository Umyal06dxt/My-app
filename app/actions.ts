"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createCheckoutSession, siteUrl, TunytError } from "@/lib/tunyt";
import { MAX_PER_LINE } from "@/lib/tickets";

export type CheckoutState = { error: string | null };

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
  let url: string;
  try {
    const session = await createCheckoutSession({
      orderId,
      eventId,
      items,
      successUrl: `${base}/thanks`,
      cancelUrl: `${base}/events/${encodeURIComponent(eventId)}?cancelled=1`,
    });
    url = session.url;
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

  // Remember which order this browser started, so /thanks can match the session to it.
  (await cookies()).set("tunyt_order", orderId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 2,
  });

  redirect(url); // buyer signs in and pays on tunyt.com, then returns to /thanks
}
