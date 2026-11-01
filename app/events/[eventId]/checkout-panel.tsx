"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { rupees } from "@/lib/format";
import { requestOtp, verifyOtp } from "./otp-actions";

type Props = {
  session: { sessionId: string; url: string; amountPaise: number };
  onClose: () => void;
};

type Step = "identify" | "code" | "pay";

/** Turns "98765 43210" into "+919876543210"; emails pass through. */
function normalise(raw: string) {
  const v = raw.trim();
  if (v.includes("@")) return v.toLowerCase();
  const digits = v.replace(/[^\d+]/g, "");
  if (/^\d{10}$/.test(digits)) return "+91" + digits;
  if (/^91\d{10}$/.test(digits)) return "+" + digits;
  return digits;
}

function looksValid(id: string) {
  return id.includes("@") ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id) : /^\+\d{8,15}$/.test(id);
}

export function CheckoutPanel({ session, onClose }: Props) {
  const [step, setStep] = useState<Step>("identify");
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [buyerName, setBuyerName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const dialog = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const tunytOrigin = new URL(session.url).origin; // e.g. https://www.tunyt.com
  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    const id = normalise(identifier);
    if (!looksValid(id)) return setError("Enter a mobile number or an email address.");
    setBusy(true);
    setError(null);
    try {
      // Sent from our server (no browser CORS); Tunyt checks it comes from this site's origin.
      const r = await requestOtp(session.sessionId, id);
      if (!r.ok) throw new Error(r.message);
      setIdentifier(id);
      setStep("code");
      setNote(`We sent a code to ${id} 💌`);
      setCooldown(30);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4,8}$/.test(otp.trim())) return setError("Enter the code from the message.");
    setBusy(true);
    setError(null);
    try {
      const r = await verifyOtp(session.sessionId, identifier, otp.trim());
      if (!r.ok) throw new Error(r.message);
      setBuyerName(r.buyerName ?? null);
      setToken(r.checkoutToken!);
      setStep("pay");
      setNote(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Resend cooldown.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // The payment frame tells us how it went. "paid" is only a hint: /thanks double-checks with Tunyt.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== tunytOrigin) return;
      if (e.data?.source !== "tunyt-checkout") return;
      if (e.data.type === "paid") {
        setNote("Payment received! Getting your tickets… 🎉");
        router.push(`/thanks?session_id=${encodeURIComponent(session.sessionId)}`);
      } else if (e.data.type === "dismissed") {
        setNote("Payment window closed. Tap Pay again whenever you're ready 🌷");
      } else if (e.data.type === "error") {
        setError("The payment couldn't start here. You can finish on Tunyt instead (link below).");
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [tunytOrigin, session.sessionId, router]);

  // Escape closes, focus moves into the dialog, page behind doesn't scroll.
  useEffect(() => {
    dialog.current?.querySelector<HTMLElement>("input,button")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose, step]);

  const stepIndex = { identify: 0, code: 1, pay: 2 }[step];

  // Portal to <body>: a transformed/animated ancestor would otherwise trap the fixed overlay.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-cocoa/40 p-3 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-title"
        onClick={(e) => e.stopPropagation()}
        className="sticker pop-in relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-[2rem] bg-paper p-6 hover:!transform-none sm:p-7"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close checkout"
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-pink-soft font-bold hover:bg-pink hover:text-white"
        >
          ✕
        </button>

        <div className="mb-5 flex gap-2 pr-12" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className={`h-2 flex-1 rounded-full ${i <= stepIndex ? "bg-pink" : "bg-pink-soft"}`} />
          ))}
        </div>

        <p className="text-xs font-extrabold uppercase tracking-widest text-cocoa-soft">total {rupees(session.amountPaise)}</p>

        {step === "identify" && (
          <form onSubmit={sendCode} className="mt-1 flex flex-col gap-3">
            <h2 id="checkout-title" className="font-display text-2xl font-bold">who&apos;s coming? 💖</h2>
            <p className="text-sm font-semibold text-cocoa-soft">
              Enter your mobile number or email. We&apos;ll send a quick code, and your tickets go there too.
            </p>
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              inputMode="email"
              autoComplete="tel email"
              placeholder="98765 43210 or you@email.com"
              className="rounded-2xl border-2 border-cocoa bg-cream px-4 py-3 text-lg font-semibold outline-none focus:ring-4 focus:ring-pink/40"
            />
            <button disabled={busy} className="sticker rounded-full bg-pink px-6 py-3.5 font-display text-lg font-semibold text-white">
              {busy ? "sending… 💫" : "send me a code ✨"}
            </button>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={verify} className="mt-1 flex flex-col gap-3">
            <h2 id="checkout-title" className="font-display text-2xl font-bold">check your messages 📱</h2>
            <input
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="• • • • • •"
              aria-label="Code"
              className="rounded-2xl border-2 border-cocoa bg-cream px-4 py-3 text-center font-display text-3xl font-semibold tracking-[0.4em] outline-none focus:ring-4 focus:ring-pink/40"
            />
            <button disabled={busy} className="sticker rounded-full bg-pink px-6 py-3.5 font-display text-lg font-semibold text-white">
              {busy ? "checking… 💫" : "continue 💖"}
            </button>
            <div className="flex justify-between text-sm font-bold text-cocoa-soft">
              <button type="button" onClick={() => { setStep("identify"); setOtp(""); setNote(null); setError(null); }} className="hover:text-pink">
                ← change
              </button>
              <button type="button" disabled={cooldown > 0 || busy} onClick={() => sendCode()} className="hover:text-pink disabled:opacity-50">
                {cooldown > 0 ? `resend in ${cooldown}s` : "resend code"}
              </button>
            </div>
          </form>
        )}

        {step === "pay" && token && (
          <div className="mt-1 flex flex-col gap-3">
            <h2 id="checkout-title" className="font-display text-2xl font-bold">
              {buyerName ? `hi ${buyerName.split(" ")[0]}! ` : "almost there! "}🎟️
            </h2>
            <p className="text-sm font-semibold text-cocoa-soft">Pay securely with UPI, cards and more.</p>
            <div className="overflow-hidden rounded-2xl border-2 border-cocoa bg-cream">
              <iframe
                title="Secure payment by Tunyt"
                src={`${tunytOrigin}/embed/checkout/${encodeURIComponent(session.sessionId)}#t=${encodeURIComponent(token)}`}
                className="block h-[280px] w-full border-0"
                allow="payment"
              />
            </div>
          </div>
        )}

        {note && <p role="status" className="mt-4 rounded-2xl bg-mint-soft p-3 text-sm font-bold">{note}</p>}
        {error && <p role="alert" className="mt-4 rounded-2xl bg-pink-soft p-3 text-sm font-bold">🙈 {error}</p>}

        <p className="mt-5 text-center text-xs font-semibold text-cocoa-soft">
          🔒 secured by Tunyt ·{" "}
          <a href={session.url} className="underline decoration-pink decoration-wavy underline-offset-2 hover:text-pink">
            pay on tunyt.com instead
          </a>
        </p>
      </div>
    </div>,
    document.body,
  );
}
