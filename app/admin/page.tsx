import { Suspense } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import {
  getBalance,
  getEventFresh,
  listAllEvents,
  listBookings,
  TunytError,
  type Booking,
  type TunytEvent,
} from "@/lib/tunyt";
import { eventDay, eventTime, rupees } from "@/lib/format";
import { logout } from "./actions";
import { RefundForm, ResendButton } from "./forms";

const STATUSES = ["PAID", "ALL", "HELD", "EXPIRED", "CANCELLED", "FAILED"];
const ID = /^[A-Za-z0-9_-]{1,100}$/;

export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-[2rem] bg-lilac-soft" />}>
      <Admin searchParams={searchParams} />
    </Suspense>
  );
}

async function Admin({ searchParams }: Pick<PageProps<"/admin">, "searchParams">) {
  await requireAdmin();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const eventId = one(sp.event) && ID.test(one(sp.event)!) ? one(sp.event) : undefined;
  const status = STATUSES.includes(one(sp.status) ?? "") ? one(sp.status)! : "PAID";
  const cursor = one(sp.cursor);

  let events: TunytEvent[] = [];
  let eventsError: string | null = null;
  try {
    events = await listAllEvents();
  } catch (e) {
    eventsError = e instanceof TunytError ? e.message : "Couldn't load events";
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-4xl font-bold">bookings 📒</h1>
        <form action={logout}>
          <button className="rounded-full border-2 border-cocoa bg-paper px-4 py-2 text-sm font-bold hover:bg-pink-soft">
            log out 👋
          </button>
        </form>
      </div>

      <Stats eventId={eventId} />

      <form className="sticker flex flex-wrap items-end gap-3 rounded-[2rem] bg-paper p-5 hover:!transform-none">
        <label className="flex min-w-0 flex-1 basis-64 flex-col gap-1 text-sm font-bold">
          event
          <select name="event" defaultValue={eventId ?? ""} className="rounded-xl border-2 border-cocoa bg-paper px-3 py-2 font-semibold">
            <option value="">all events</option>
            {events.map((e) => (
              <option key={e.eventId} value={e.eventId}>
                {e.title} · {eventDay(e.time, e.timezoneOffsetMinutes)}
                {e.status && String(e.status).toUpperCase() !== "APPROVED" ? ` (${String(e.status).toLowerCase()})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">
          status
          <select name="status" defaultValue={status} className="rounded-xl border-2 border-cocoa bg-paper px-3 py-2 font-semibold">
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.toLowerCase()}</option>
            ))}
          </select>
        </label>
        <button className="sticker rounded-full bg-pink px-6 py-2.5 font-display font-semibold text-white">show ✨</button>
        {eventsError && <p className="w-full text-sm font-bold text-pink">Couldn&apos;t load events: {eventsError}</p>}
      </form>

      <Bookings eventId={eventId} status={status} cursor={cursor} events={events} />
    </div>
  );
}

async function Stats({ eventId }: { eventId?: string }) {
  let b;
  try {
    b = await getBalance();
  } catch {
    return null; // key without payouts:read: just skip the money tiles
  }
  const ev = eventId ? b.byEvent.find((x) => x.eventId === eventId) : null;
  const tiles = ev
    ? [
        ["earned on this event", rupees(ev.earnedPaise), "bg-mint-soft"],
        ["ready for payout", rupees(ev.availablePaise), "bg-butter-soft"],
        ["payout date", ev.payoutDate ? eventDay(ev.payoutDate, 330) : "after the event", "bg-lilac-soft"],
      ]
    : [
        ["earned in total", rupees(b.earnedPaise), "bg-mint-soft"],
        ["being paid out", rupees(b.inProcessPaise), "bg-butter-soft"],
        ["next payout", b.nextPayout ? `${rupees(b.nextPayout.amountPaise)} · ${eventDay(b.nextPayout.date, 330)}` : "none yet", "bg-lilac-soft"],
      ];
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {tiles.map(([label, value, tint]) => (
        <div key={label} className={`rounded-[1.5rem] border-2 border-cocoa p-5 ${tint}`}>
          <p className="text-xs font-extrabold uppercase tracking-wider text-cocoa-soft">{label}</p>
          <p className="mt-1 font-display text-2xl font-bold">{value}</p>
        </div>
      ))}
    </div>
  );
}

async function Bookings({
  eventId,
  status,
  cursor,
  events,
}: {
  eventId?: string;
  status: string;
  cursor?: string;
  events: TunytEvent[];
}) {
  let page;
  try {
    page = await listBookings({ eventId, status: status === "ALL" ? undefined : status, cursor, limit: 25 });
  } catch (e) {
    return (
      <p className="rounded-2xl bg-pink-soft p-5 font-bold">
        🙈 Couldn&apos;t load bookings: {e instanceof TunytError ? `${e.message}${e.requestId ? ` (ref ${e.requestId})` : ""}` : "unknown error"}
      </p>
    );
  }

  // Ticket type names live on the event, so load each event on this page once.
  const ids = [...new Set(page.items.map((b) => b.eventId))];
  const details = await Promise.all(ids.map((id) => getEventFresh(id).catch(() => null)));
  const byId = new Map<string, TunytEvent>();
  for (const e of events) byId.set(e.eventId, e);
  for (const e of details) if (e) byId.set(e.eventId, { ...byId.get(e.eventId), ...e });

  const qs = (extra: Record<string, string>) =>
    "/admin?" + new URLSearchParams({ ...(eventId ? { event: eventId } : {}), status, ...extra }).toString();

  if (page.items.length === 0) {
    return (
      <div className="rounded-[2rem] border-2 border-dashed border-cocoa/30 p-10 text-center font-bold text-cocoa-soft">
        <div className="mb-2 text-5xl">🌙</div>
        no bookings here yet
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {page.items.map((b) => (
        <BookingCard key={b.bookingId} booking={b} event={byId.get(b.eventId)} showEvent={!eventId} />
      ))}
      <div className="flex justify-between">
        {cursor ? <Link href={qs({})} className="font-bold text-cocoa-soft hover:text-pink">← first page</Link> : <span />}
        {page.nextCursor && (
          <Link href={qs({ cursor: page.nextCursor })} className="sticker rounded-full bg-paper px-5 py-2 font-bold">
            next page →
          </Link>
        )}
      </div>
    </div>
  );
}

const STATUS_TINT: Record<string, string> = {
  PAID: "bg-mint",
  SUCCESS: "bg-mint",
  HELD: "bg-butter",
  PENDING: "bg-butter",
  EXPIRED: "bg-cocoa/10",
  CANCELLED: "bg-pink-soft",
  REFUNDED: "bg-lilac",
  FAILED: "bg-pink",
};

function Pill({ s }: { s: string }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${STATUS_TINT[s.toUpperCase()] ?? "bg-sky/40"}`}>
      {s.toLowerCase().replaceAll("_", " ")}
    </span>
  );
}

function BookingCard({ booking: b, event, showEvent }: { booking: Booking; event?: TunytEvent; showEvent: boolean }) {
  const typeName = (id: string) => event?.ticketTypes?.find((t) => t.ticketTypeId === id)?.name ?? "Ticket";
  const paid = b.status.toUpperCase() === "PAID";
  const refundable = b.tickets.filter((t) => t.status.toUpperCase() === "SUCCESS" && t.pricePaise > 0);
  const created = new Date(b.createdAt);

  return (
    <article className="rounded-[1.75rem] border-2 border-cocoa bg-paper p-5 shadow-[3px_4px_0_0_var(--cocoa)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-xl font-semibold">{b.buyer?.name || "Guest"}</p>
          <p className="flex flex-wrap gap-x-3 text-sm font-semibold text-cocoa-soft">
            {b.buyer?.email && <a href={`mailto:${b.buyer.email}`} className="hover:text-pink">✉️ {b.buyer.email}</a>}
            {b.buyer?.phone && <a href={`tel:${b.buyer.phone}`} className="hover:text-pink">📞 {b.buyer.phone}</a>}
          </p>
          {showEvent && event && <p className="mt-1 text-sm font-bold">🎪 {event.title}</p>}
        </div>
        <div className="text-right">
          <p className="font-display text-2xl font-bold">{rupees(b.totalPaise)}</p>
          <p className="flex items-center justify-end gap-2 text-xs font-semibold text-cocoa-soft">
            <Pill s={b.status} />
            {eventDay(b.createdAt, 330)} · {eventTime(created.toISOString(), 330)}
          </p>
        </div>
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {b.tickets.map((t) => (
          <li key={t.ticketId} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-cream px-4 py-2.5">
            <span className="font-bold">
              {t.quantity}× {typeName(t.ticketTypeId)}
            </span>
            <span className="text-sm font-semibold text-cocoa-soft">{rupees(t.pricePaise)}</span>
            <Pill s={t.status} />
            {t.checkedIn && <span className="text-xs font-extrabold">✅ checked in</span>}
            <span className="ml-auto flex flex-wrap items-start gap-2">
              {paid && t.status.toUpperCase() === "SUCCESS" && <ResendButton ticketId={t.ticketId} />}
              {paid && (
                <RefundForm
                  bookingId={b.bookingId}
                  ticketIds={[t.ticketId]}
                  label="refund this 💸"
                  available={refundable.length > 1 && refundable.some((r) => r.ticketId === t.ticketId)}
                />
              )}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-2 text-xs font-semibold text-cocoa-soft">
        <span>
          booking <code className="rounded bg-cream px-1.5 py-0.5">{b.bookingId}</code>
          {b.feesBornBy === "USER" && b.platformFeePaise + b.gatewayFeePaise + b.gstPaise > 0 &&
            ` · incl. ${rupees(b.platformFeePaise + b.gatewayFeePaise + b.gstPaise)} fees`}
        </span>
        {paid && (
          <RefundForm
            bookingId={b.bookingId}
            label={refundable.length > 1 ? "refund whole booking 💸" : "refund 💸"}
            available={refundable.length > 0}
          />
        )}
      </div>
    </article>
  );
}
