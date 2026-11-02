"use client";

import { useActionState, useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { cancelCheckout, startCheckout } from "@/app/actions";
import { checkoutStore, parseCheckout, sameItems, useSavedCheckoutRaw } from "@/lib/checkout-store";
import { Countdown } from "./countdown";
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

export function TicketPicker({ event }: { event: TunytEvent }) {
  const now = useSyncExternalStore(subscribe, nowSnapshot, serverSnapshot);
  const raw = useSavedCheckoutRaw();
  const saved = useMemo(() => {
    const c = parseCheckout(raw);
    return c && c.eventId === event.eventId ? c : null;
  }, [raw, event.eventId]);

  // Quantities: what the buyer picked, or (after a reload) the ones in their saved checkout.
  const [picked, setQty] = useState<Record<string, number> | null>(null);
  const qty = picked ?? Object.fromEntries((saved?.items ?? []).map((i) => [i.ticketTypeId, i.quantity]));
  const [gone, setGone] = useState<string | null>(null);

  const [state, action, pending] = useActionState<{ error: string | null }, FormData>(async (_prev, form) => {
    setGone(null);
    const items = [...form.entries()]
      .filter(([k]) => k.startsWith("qty:"))
      .map(([k, v]) => ({ ticketTypeId: k.slice(4), quantity: Number(v) }))
      .filter((i) => i.quantity > 0);

    // Same tickets as the saved checkout: just reopen it (same session, same login).
    const current = checkoutStore.current();
    if (current && current.eventId === event.eventId && sameItems(current.items, items)) {
      checkoutStore.update({ open: true });
      return { error: null };
    }
    // Different tickets: cancel the old session and start a new one.
    if (current) {
      checkoutStore.clear();
      void cancelCheckout(current.sessionId);
    }

    const r = await startCheckout({ error: null }, form);
    if (r.session) {
      checkoutStore.save({
        eventId: event.eventId,
        sessionId: r.session.sessionId,
        url: r.session.url,
        amountPaise: r.session.amountPaise,
        expiresAt: r.session.expiresAt,
        items,
        eventTitle: event.title,
        lines: items.map((i) => ({
          name: event.ticketTypes?.find((t) => t.ticketTypeId === i.ticketTypeId)?.name ?? "Ticket",
          quantity: i.quantity,
        })),
        open: true,
        step: "identify",
      });
    }
    return { error: r.error };
  }, { error: null });

  const hide = useCallback(() => checkoutStore.update({ open: false }), []);
  const onGone = useCallback((message: string) => {
    checkoutStore.clear();
    setGone(message);
  }, []);
  const timedOut = useCallback(
    () => onGone("Your checkout timed out after 30 minutes. Pick your tickets again 🌷"),
    [onGone],
  );
  const startOver = () => {
    if (saved) void cancelCheckout(saved.sessionId);
    checkoutStore.clear();
    setQty({});
  };

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
    setQty({ ...qty, [id]: Math.max(0, Math.min(max, n)) });

  return (
    <>
    {saved?.open && <CheckoutPanel key={saved.sessionId} checkout={saved} onClose={hide} onGone={onGone} />}
    <form action={action} className="sticker rounded-[2rem] bg-paper p-6 hover:!transform-none">
      <input type="hidden" name="eventId" value={event.eventId} />
      <h2 className="mb-1 font-display text-2xl font-semibold">pick your tickets 🎟️</h2>
      <p className="mb-5 text-sm font-semibold text-cocoa-soft">choose how many, then off to checkout!</p>

      {saved && !saved.open && (
        <div className="pop-in mb-5 rounded-2xl border-2 border-cocoa bg-mint-soft p-4">
          <p className="font-display text-lg font-semibold">your checkout is waiting 🧺</p>
          <p className="text-sm font-bold text-cocoa-soft">
            {rupees(saved.amountPaise)} · ⏳ <Countdown to={saved.expiresAt} onDone={timedOut} />
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => checkoutStore.update({ open: true })}
              className="sticker whitespace-nowrap rounded-full bg-pink px-5 py-2 font-display font-semibold text-white"
            >
              continue checkout 💖
            </button>
            <button type="button" onClick={startOver} className="whitespace-nowrap text-sm font-bold text-cocoa-soft hover:text-pink">
              start over
            </button>
          </div>
        </div>
      )}
      {gone && <p role="status" className="mb-5 rounded-2xl bg-butter-soft p-3 text-sm font-bold">{gone}</p>}

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
            {pending
              ? "getting your tickets ready… 💫"
              : count === 0
                ? "pick a ticket above ☝️"
                : saved && sameItems(saved.items, lines.filter((l) => l.n > 0).map((l) => ({ ticketTypeId: l.t.ticketTypeId, quantity: l.n })))
                  ? "continue checkout 💖"
                  : "checkout 💖"}
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
