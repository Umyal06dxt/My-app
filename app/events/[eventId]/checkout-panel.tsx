"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { rupees } from "@/lib/format";
import { checkoutStore, type SavedCheckout } from "@/lib/checkout-store";
import { checkoutStatus } from "@/app/actions";
import { requestOtp, verifyOtp } from "./otp-actions";
import { Countdown } from "./countdown";

type Props = {
  checkout: SavedCheckout;
  /** Hide the pop-up. The checkout stays saved and can be resumed. */
  onClose: () => void;
  /** The session can no longer be paid (timed out or cancelled). */
  onGone: (message: string) => void;
};

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

export function CheckoutPanel({ checkout, onClose, onGone }: Props) {
  const { sessionId, url, amountPaise, expiresAt, step, token, buyerName, eventTitle, lines } = checkout;
  const [identifier, setIdentifier] = useState(checkout.identifier ?? "");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(
    step === "code" && checkout.identifier ? `We sent a code to ${checkout.identifier} 💌` : null,
  );
  const [cooldown, setCooldown] = useState(0);
  const [frameHeight, setFrameHeight] = useState(330);
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [paying, setPaying] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const tunytOrigin = new URL(url).origin; // e.g. https://www.tunyt.com
  const thanks = `/thanks?session_id=${encodeURIComponent(sessionId)}`;

  // When the pop-up (re)opens, make sure the session is still payable.
  useEffect(() => {
    let alive = true;
    checkoutStatus(sessionId).then((status) => {
      if (!alive) return;
      if (status === "PAID") {
        checkoutStore.clear();
        router.push(thanks);
      } else if (status !== "OPEN") {
        onGone("That checkout timed out. Pick your tickets again and you're good to go 🌷");
      }
    });
    return () => {
      alive = false;
    };
  }, [sessionId, thanks, router, onGone]);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    const id = normalise(identifier);
    if (!looksValid(id)) return setError("Enter a mobile number or an email address.");
    setBusy(true);
    setError(null);
    try {
      // Sent from our server (no browser CORS); Tunyt checks it comes from this site's origin.
      const r = await requestOtp(sessionId, id);
      if (!r.ok) throw new Error(r.message);
      setIdentifier(id);
      setNote(`We sent a code to ${id} 💌`);
      setCooldown(30);
      checkoutStore.update({ step: "code", identifier: id });
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
      const r = await verifyOtp(sessionId, identifier, otp.trim());
      if (!r.ok) throw new Error(r.message);
      setNote(null);
      // Saved, so closing the pop-up or reloading goes straight back to the payment step.
      checkoutStore.update({ step: "pay", token: r.checkoutToken, buyerName: r.buyerName ?? null });
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

  const goToTickets = useCallback(() => {
    checkoutStore.clear();
    router.push(thanks);
  }, [router, thanks]);

  // The payment frame tells us how it went. "paid" is only a hint: /thanks double-checks with Tunyt.
  useEffect(() => {
    const fromTunyt = (origin: string) =>
      origin === tunytOrigin || /^https:\/\/([a-z0-9-]+\.)*tunyt\.com$/.test(origin);
    function onMessage(e: MessageEvent) {
      if (!fromTunyt(e.origin)) return;
      let data = e.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          data = { type: data };
        }
      }
      const type = String(data?.type ?? data?.event ?? data?.status ?? "").toLowerCase();
      if (process.env.NODE_ENV !== "production") console.debug("[checkout] frame message", e.origin, e.data);
      if (typeof data?.height === "number" && data.height > 120 && data.height < 1200) setFrameHeight(data.height);
      if (type.includes("paid") || type.includes("success") || type.includes("complete")) {
        setPaying(true);
        goToTickets();
      } else if (type.includes("dismiss") || type.includes("close") || type.includes("cancel")) {
        setNote("Payment window closed. Tap Pay again whenever you're ready 🌷");
      } else if (type.includes("error") || type.includes("fail")) {
        setError("The payment couldn't start here. You can finish on Tunyt instead (link below).");
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [tunytOrigin, goToTickets]);

  // Don't rely on the frame's message alone: while paying, ask our server every few seconds.
  useEffect(() => {
    if (step !== "pay") return;
    let alive = true;
    const check = async () => {
      const status = await checkoutStatus(sessionId).catch(() => "OPEN" as const);
      if (!alive) return;
      if (status === "PAID") {
        setPaying(true);
        goToTickets();
      } else if (status === "EXPIRED" || status === "GONE") {
        onGone("That checkout timed out. Pick your tickets again and you're good to go 🌷");
      }
    };
    const id = setInterval(check, 3000);
    window.addEventListener("focus", check);
    return () => {
      alive = false;
      clearInterval(id);
      window.removeEventListener("focus", check);
    };
  }, [step, sessionId, goToTickets, onGone]);

  // Escape hides the pop-up, focus moves into it, page behind doesn't scroll.
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
          aria-label="Hide checkout (you can come back to it)"
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-pink-soft font-bold hover:bg-pink hover:text-white"
        >
          ✕
        </button>

        <div className="mb-5 flex gap-2 pr-12" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className={`h-2 flex-1 rounded-full ${i <= stepIndex ? "bg-pink" : "bg-pink-soft"}`} />
          ))}
        </div>

        <p className="flex justify-between text-xs font-extrabold uppercase tracking-widest text-cocoa-soft">
          <span>{step === "pay" ? "secure checkout" : `total ${rupees(amountPaise)}`}</span>
          <span>
            ⏳ <Countdown to={expiresAt} />
          </span>
        </p>

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
              <button
                type="button"
                onClick={() => {
                  setOtp("");
                  setNote(null);
                  setError(null);
                  checkoutStore.update({ step: "identify" });
                }}
                className="hover:text-pink"
              >
                ← change
              </button>
              <button type="button" disabled={cooldown > 0 || busy} onClick={() => sendCode()} className="hover:text-pink disabled:opacity-50">
                {cooldown > 0 ? `resend in ${cooldown}s` : "resend code"}
              </button>
            </div>
          </form>
        )}

        {step === "pay" && token && (
          <div className="mt-1 flex flex-col gap-4">
            <h2 id="checkout-title" className="font-display text-2xl font-bold">
              {buyerName ? `hi ${buyerName.split(" ")[0]}! ` : "almost there! "}🎟️
            </h2>

            {/* order summary */}
            <div className="rounded-2xl bg-pink-soft p-4">
              {eventTitle && <p className="font-display text-lg font-semibold leading-tight">{eventTitle}</p>}
              <ul className="mt-1 text-sm font-bold text-cocoa-soft">
                {(lines ?? []).map((l) => (
                  <li key={l.name}>
                    {l.quantity}× {l.name}
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-end justify-between border-t-2 border-dashed border-cocoa/20 pt-3">
                <span className="text-sm font-bold">to pay</span>
                <span className="font-display text-2xl font-bold">{rupees(amountPaise)}</span>
              </div>
            </div>

            {/* Tunyt's secure payment frame */}
            <div className="relative overflow-hidden rounded-2xl bg-white shadow-[0_0_0_2px_var(--cocoa)]">
              {!frameLoaded && (
                <div className="absolute inset-0 grid place-items-center bg-paper">
                  <p className="animate-pulse font-display font-semibold text-cocoa-soft">opening secure payment… 🔒</p>
                </div>
              )}
              <iframe
                title="Secure payment by Tunyt"
                src={`${tunytOrigin}/embed/checkout/${encodeURIComponent(sessionId)}#t=${encodeURIComponent(token)}`}
                onLoad={() => setFrameLoaded(true)}
                style={{ height: frameHeight }}
                className="block w-full border-0 bg-white"
                allow="payment"
              />
            </div>

            <p className="flex items-center justify-center gap-2 text-sm font-bold text-cocoa-soft" role="status">
              <span className="live-dot inline-block h-2 w-2 rounded-full bg-mint" aria-hidden />
              {paying ? "payment received! getting your tickets… 🎉" : "we'll take you to your tickets as soon as you've paid"}
            </p>
          </div>
        )}

        {note && <p role="status" className="mt-4 rounded-2xl bg-mint-soft p-3 text-sm font-bold">{note}</p>}
        {error && <p role="alert" className="mt-4 rounded-2xl bg-pink-soft p-3 text-sm font-bold">🙈 {error}</p>}

        <p className="mt-5 text-center text-xs font-semibold text-cocoa-soft">
          🔒 secured by Tunyt ·{" "}
          <a href={url} className="underline decoration-pink decoration-wavy underline-offset-2 hover:text-pink">
            {step === "pay" ? "trouble paying? finish on tunyt.com" : "pay on tunyt.com instead"}
          </a>
        </p>
      </div>
    </div>,
    document.body,
  );
}
