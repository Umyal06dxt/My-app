"use server";

import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { ADMIN_COOKIE, adminEnabled, adminToken, requireAdmin, safeEqual } from "@/lib/admin";
import { refundBooking, resendTicket, TunytError } from "@/lib/tunyt";
import { rupees } from "@/lib/format";

export type ActionState = { ok: boolean; message: string } | null;

const ID = /^[A-Za-z0-9_-]{1,100}$/;
const REASONS = ["Attendee request", "Duplicate", "Event issue", "Other"];

function explain(e: unknown) {
  if (e instanceof TunytError) {
    const friendly: Record<string, string> = {
      refund_window_closed: "The refund window for this event has closed.",
      "No paid tickets to refund on this booking": "There's nothing left to refund on this booking.",
    };
    return (friendly[e.message] ?? e.message) + (e.requestId ? ` (ref ${e.requestId})` : "");
  }
  console.error(e);
  return "Something went wrong. Please try again.";
}

export async function login(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!adminEnabled()) return { ok: false, message: "Set ADMIN_PASSWORD (8+ characters) on the server first." };
  const password = String(form.get("password") ?? "");
  if (!safeEqual(password, process.env.ADMIN_PASSWORD!)) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return { ok: false, message: "That password isn't right." };
  }
  (await cookies()).set(ADMIN_COOKIE, adminToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  redirect("/admin");
}

export async function logout() {
  (await cookies()).delete(ADMIN_COOKIE);
  redirect("/admin/login");
}

export async function refund(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();

  const bookingId = String(form.get("bookingId") ?? "");
  const ticketIds = form.getAll("ticketId").map(String);
  const reasonPreset = String(form.get("reason") ?? "Attendee request");
  const additionalDetails = String(form.get("details") ?? "").trim().slice(0, 1000);
  if (!ID.test(bookingId) || ticketIds.some((t) => !ID.test(t)) || ticketIds.length > 50) {
    return { ok: false, message: "Invalid booking or ticket." };
  }
  if (!REASONS.includes(reasonPreset)) return { ok: false, message: "Pick a reason." };

  // Same booking + same tickets = same key, so a double click or retry never refunds twice.
  const scope = ticketIds.length ? [...ticketIds].sort().join(",") : "all";
  const key = `refund-${bookingId}-${crypto.createHash("sha256").update(scope).digest("hex").slice(0, 24)}`;

  try {
    const result = await refundBooking(
      bookingId,
      {
        ...(ticketIds.length ? { ticketIds } : {}),
        reasonPreset,
        ...(additionalDetails ? { additionalDetails } : {}),
      },
      key,
    );
    refresh();
    const total = result.refunds.reduce((s, r) => s + r.amountPaise, 0);
    const parts = [];
    if (result.refunds.length) {
      parts.push(`Refund of ${rupees(total)} requested for ${result.refunds.length} ticket(s). It goes back to the buyer's original payment method.`);
    }
    if (result.failed.length) {
      parts.push(`${result.failed.length} couldn't be refunded: ${result.failed.map((f) => f.reason ?? f.message ?? "unknown reason").join(", ")}.`);
    }
    return { ok: result.failed.length === 0, message: parts.join(" ") || "Nothing was refunded." };
  } catch (e) {
    return { ok: false, message: explain(e) };
  }
}

export async function resend(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const ticketId = String(form.get("ticketId") ?? "");
  if (!ID.test(ticketId)) return { ok: false, message: "Invalid ticket." };
  try {
    // One resend per ticket per minute: protects against double clicks, still allows sending again later.
    await resendTicket(ticketId, `resend-${ticketId}-${Math.floor(Date.now() / 60_000)}`);
    return { ok: true, message: "Ticket emailed to the buyer again 💌" };
  } catch (e) {
    return { ok: false, message: explain(e) };
  }
}
