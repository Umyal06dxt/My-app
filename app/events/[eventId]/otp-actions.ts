"use server";

import { embeddedCheckout, TunytError } from "@/lib/tunyt";

export type OtpResult =
  | { ok: true; checkoutToken?: string; buyerName?: string | null }
  | { ok: false; message: string };

const SESSION = /^[A-Za-z0-9_-]{1,100}$/;
const IDENTIFIER = /^(\+\d{8,15}|[^\s@]{1,100}@[^\s@]{1,100}\.[^\s@]{1,50})$/;

function fail(e: unknown): OtpResult {
  if (e instanceof TunytError) {
    if (e.status === 429) return { ok: false, message: "Too many tries. Please wait a minute and try again." };
    return { ok: false, message: e.message + (e.requestId ? ` (ref ${e.requestId})` : "") };
  }
  console.error(e);
  return { ok: false, message: "Something went wrong. Please try again." };
}

export async function requestOtp(sessionId: string, identifier: string): Promise<OtpResult> {
  if (!SESSION.test(sessionId) || !IDENTIFIER.test(identifier)) {
    return { ok: false, message: "Enter a mobile number or an email address." };
  }
  try {
    await embeddedCheckout(sessionId, "/otp/request", { identifier });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function verifyOtp(sessionId: string, identifier: string, otp: string): Promise<OtpResult> {
  if (!SESSION.test(sessionId) || !IDENTIFIER.test(identifier) || !/^\d{4,8}$/.test(otp)) {
    return { ok: false, message: "Enter the code from the message." };
  }
  try {
    const data = await embeddedCheckout<Record<string, unknown>>(sessionId, "/otp/verify", { identifier, otp });
    const token = typeof data.checkoutToken === "string" ? data.checkoutToken : undefined;
    if (!token) return { ok: false, message: "Couldn't sign you in. Please try again." };
    const buyer = (data.buyer ?? data.user ?? data) as Record<string, unknown>;
    const name = typeof buyer?.name === "string" ? buyer.name : typeof buyer?.firstName === "string" ? buyer.firstName : null;
    return { ok: true, checkoutToken: token, buyerName: name };
  } catch (e) {
    return fail(e);
  }
}
