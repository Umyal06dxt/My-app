"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import { startCheckout, type CheckoutState } from "@/app/actions";
import type { TunytEvent } from "@/lib/tunyt";
import { rupees } from "@/lib/format";
import { CheckoutPanel } from "./checkout-panel";
import { currentPrice, eventBlocker, MAX_PER_LINE, remaining, ticketBlocker } from "@/lib/tickets";

const TINTS = ["bg-pink-soft", "bg-lilac-soft", "bg-butter-soft", "bg-mint-soft"];

// "now" is only read in the browser, refreshed every 30 seconds.
const subscribe = (cb: () => void) => {
  const id = setInterval(cb, 30_000);
  return () => clearInterval(id);
};
const nowSnapshot = () => Math.floor(Date.now() / 30_000) * 30_000;
const serverSnapshot = () => null;

export function TicketPicker({ event, apiBase }: { event: TunytEvent; apiBase: string }) {
  const now = useSyncExternalStore(subscribe, nowSnapshot, serverSnapshot);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [state, action, pending] = useActionState<CheckoutState, FormData>(startCheckout, { error: null });
  // Each new session (nonce) opens the on-site checkout panel until the buyer closes it.
  const [closedNonce, setClosedNonce] = useState<string | null>(null);

  const types = event.ticketTypes ?? [];
  const blocked = now == null ? null : eventBlocker(event, now);

  const lines = types.map((t) => {
    const left = remaining(t);
    return {
      t,
      ...currentPrice(t),
      left,
      max: Math.min(MAX_PER_LINE, left ?? MAX_PER_LINE),
      blocker: now == null ? null : ticketBlocker(t, now),
      n: qty[t.ticketTypeId] ?? 0,
    };
  });
  const count = lines.reduce((s, l) => s + l.n, 0);
  const subtotal = lines.reduce((s, l) => s + l.n * l.price, 0);
  const buyerFees = lines.some((l) => l.n > 0 && l.t.feeBornBy === "USER" && l.price > 0);

  const set = (id: string, n: number, max: number) =>
    setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(max, n)) }));

  return (
    <>
    {state.session && closedNonce !== state.session.nonce && (
      <CheckoutPanel apiBase={apiBase} session={state.session} onClose={() => setClosedNonce(state.session!.nonce)} />
    )}
    <form action={action} className="sticker rounded-[2rem] bg-paper p-6 hover:!transform-none">
      <input type="hidden" name="eventId" value={event.eventId} />
      <h2 className="mb-1 font-display text-2xl font-semibold">pick your tickets 🎟️</h2>
      <p className="mb-5 text-sm font-semibold text-cocoa-soft">choose how many, then off to checkout!</p>

      {blocked ? (
        <p className="rounded-2xl bg-butter-soft p-4 text-center font-bold">{blocked} 🌙</p>
      ) : types.length === 0 ? (
        <p className="rounded-2xl bg-butter-soft p-4 text-center font-bold">No tickets yet, check back soon 🌙</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {lines.map(({ t, price, earlyBird, left, max, blocker, n }, i) => (
            <li key={t.ticketTypeId} className={`rounded-2xl border-2 border-cocoa p-4 ${TINTS[i % 4]}`}>
              <input type="hidden" name={`qty:${t.ticketTypeId}`} value={n} />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-lg font-semibold leading-tight">{t.name}</p>
                  <p className="mt-0.5 text-sm font-bold">
                    {price === 0 ? "free 🎉" : rupees(price)}
                    {earlyBird && price !== t.pricePaise && (
                      <>
                        {" "}<s className="font-semibold text-cocoa-soft">{rupees(t.pricePaise)}</s>
                        <span className="ml-1.5 inline-block whitespace-nowrap rounded-full bg-butter px-2 py-0.5 text-xs">early bird 🐣</span>
                      </>
                    )}
                  </p>
                  {t.description && <p className="mt-1 text-xs font-semibold text-cocoa-soft">{t.description}</p>}
                  {left != null && left > 0 && left <= 20 && !blocker && (
                    <p className="mt-1 text-xs font-extrabold text-pink">only {left} left!</p>
                  )}
                </div>

                {blocker ? (
                  <span className="shrink-0 rounded-full bg-paper px-3 py-1 text-xs font-extrabold">{blocker}</span>
                ) : (
                  <div className="flex shrink-0 items-center gap-1.5 rounded-full border-2 border-cocoa bg-paper p-1">
                    <Step label={`One less ${t.name}`} disabled={n === 0} onClick={() => set(t.ticketTypeId, n - 1, max)}>−</Step>
                    <span className="w-6 text-center font-display text-lg font-semibold tabular-nums" aria-live="polite">{n}</span>
                    <Step label={`One more ${t.name}`} disabled={n >= max} onClick={() => set(t.ticketTypeId, n + 1, max)}>+</Step>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!blocked && types.length > 0 && (
        <>
          <div className="mt-5 flex items-end justify-between border-t-2 border-dashed border-cocoa/25 pt-4">
            <span className="font-bold text-cocoa-soft">
              {count === 0 ? "no tickets yet" : `${count} ticket${count > 1 ? "s" : ""}`}
            </span>
            <span className="text-right">
              <span className="block font-display text-3xl font-bold">{rupees(subtotal)}</span>
              {buyerFees && <span className="text-xs font-semibold text-cocoa-soft">+ booking fees at checkout</span>}
            </span>
          </div>

          {state.error && (
            <p role="alert" className="mt-4 rounded-2xl bg-pink-soft p-3 text-sm font-bold">
              🙈 {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={count === 0 || pending}
            className="sticker mt-5 w-full rounded-full bg-pink px-6 py-4 font-display text-lg font-semibold text-white"
          >
            {pending ? "getting your tickets ready… 💫" : count === 0 ? "pick a ticket above ☝️" : "checkout 💖"}
          </button>
          <p className="mt-3 text-center text-xs font-semibold text-cocoa-soft">
            🔒 sign in with a quick code &amp; pay right here (UPI, cards &amp; more), secured by Tunyt
          </p>
        </>
      )}
    </form>
    </>
  );
}

function Step(props: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      disabled={props.disabled}
      onClick={props.onClick}
      className="grid h-9 w-9 place-items-center rounded-full bg-cocoa font-display text-xl font-bold text-white transition hover:scale-110 hover:bg-pink active:scale-95 disabled:bg-cocoa/20 disabled:hover:scale-100"
    >
      {props.children}
    </button>
  );
}
