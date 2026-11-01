import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getBooking, getCheckoutSession, getEvent, getTicket, TunytError, type CheckoutSession } from "@/lib/tunyt";
import { myOrderIds } from "@/lib/orders";
import { qrImageSrc } from "@/lib/qr";
import { eventDay, eventTime, rupees } from "@/lib/format";

export const metadata = { title: "Thank you!" };

export default function ThanksPage({ searchParams }: PageProps<"/thanks">) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:py-24">
      <Suspense fallback={<Card emoji="⏳" title="checking your payment…" tint="bg-lilac-soft" />}>
        <Result searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Result({ searchParams }: Pick<PageProps<"/thanks">, "searchParams">) {
  await connection(); // always ask Tunyt at request time
  const { session_id } = await searchParams;
  const sessionId = typeof session_id === "string" ? session_id : null;
  const orderIds = await myOrderIds();

  if (!sessionId) {
    return <Card emoji="🤔" title="nothing to see here" tint="bg-butter-soft" body="This page shows up after checkout." />;
  }

  // The redirect alone proves nothing: ask Tunyt. Right after paying the session can still read OPEN for a moment.
  let session: CheckoutSession | null = null;
  try {
    for (let i = 0; i < 3; i++) {
      session = await getCheckoutSession(sessionId);
      if (session.status !== "OPEN") break;
      await new Promise((r) => setTimeout(r, 1500));
    }
  } catch (e) {
    if (!(e instanceof TunytError && e.status === 404)) console.error(e);
  }

  if (!session) {
    return <Card emoji="🙈" title="we couldn't find that checkout" tint="bg-pink-soft" body="If you paid, your tickets are in your email and your Tunyt account." />;
  }

  if (session.status === "PAID") {
    // Tickets (with QR codes) are shown only in the browser that started this checkout.
    const ours = !!session.clientReference && orderIds.includes(session.clientReference);
    return (
      <div className="relative">
        <Confetti />
        <Card
          emoji="🎉"
          title="yay, you're going!"
          tint="bg-mint-soft"
          body="Your tickets are on their way to your email, and they're saved in your Tunyt account too. Show the QR code at the door!"
        >
          {ours && (
            <dl className="mt-6 grid grid-cols-2 gap-3 text-left">
              <Fact label="paid">{rupees(session.amountPaise)}</Fact>
              <Fact label="tickets">{session.items.reduce((s, i) => s + i.quantity, 0)}</Fact>
              {session.bookingId && <Fact label="booking" wide>{session.bookingId}</Fact>}
            </dl>
          )}
        </Card>
        {ours && session.bookingId && (
          <Suspense fallback={<p className="mt-8 text-center font-bold text-cocoa-soft">loading your tickets… 🎟️</p>}>
            <MyTickets bookingId={session.bookingId} eventId={session.eventId} />
          </Suspense>
        )}
      </div>
    );
  }

  if (session.status === "OPEN") {
    return (
      <Card emoji="⏳" title="almost there…" tint="bg-lilac-soft" body="We're still confirming your payment. This usually takes a few seconds.">
        <a href={`/thanks?session_id=${encodeURIComponent(sessionId)}`} className="sticker mt-6 inline-block rounded-full bg-lilac px-6 py-3 font-display font-semibold">
          check again 🔄
        </a>
      </Card>
    );
  }

  return (
    <Card
      emoji="🌧️"
      title="that checkout didn't finish"
      tint="bg-butter-soft"
      body={
        session.expireReason === "price_changed"
          ? "A ticket price changed while you were checking out. Please try again."
          : "It timed out before the payment went through. If you were charged, your tickets will still arrive by email."
      }
    >
      <Link href={`/events/${encodeURIComponent(session.eventId)}`} className="sticker mt-6 inline-block rounded-full bg-pink px-6 py-3 font-display font-semibold text-white">
        try again 💖
      </Link>
    </Card>
  );
}

function Card(props: { emoji: string; title: string; tint: string; body?: string; children?: React.ReactNode }) {
  return (
    <div className={`sticker pop-in rounded-[2rem] p-8 text-center hover:!transform-none sm:p-10 ${props.tint}`}>
      <div className="float mb-4 text-7xl">{props.emoji}</div>
      <h1 className="font-display text-3xl font-bold sm:text-4xl">{props.title}</h1>
      {props.body && <p className="mt-3 font-semibold text-cocoa-soft">{props.body}</p>}
      {props.children}
      <p className="mt-8">
        <Link href="/" className="font-bold text-cocoa-soft underline decoration-pink decoration-wavy underline-offset-4 hover:text-pink">
          back to all events
        </Link>
      </p>
    </div>
  );
}

function Fact({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border-2 border-cocoa bg-paper px-4 py-3 ${wide ? "col-span-2" : ""}`}>
      <dt className="text-xs font-extrabold uppercase tracking-wider text-cocoa-soft">{label}</dt>
      <dd className="truncate font-display text-lg font-semibold">{children}</dd>
    </div>
  );
}

const COLORS = ["var(--pink)", "var(--lilac)", "var(--butter)", "var(--mint)", "var(--sky)"];

function Confetti() {
  return (
    <div className="confetti pointer-events-none fixed inset-0 z-30 overflow-hidden" aria-hidden>
      {Array.from({ length: 28 }, (_, i) => (
        <span
          key={i}
          style={{
            left: `${(i * 37) % 100}%`,
            background: COLORS[i % COLORS.length],
            animationDelay: `${(i % 7) * 0.35}s`,
            animationDuration: `${2.8 + (i % 5) * 0.4}s`,
            animationIterationCount: 2,
          }}
        />
      ))}
    </div>
  );
}

const TICKET_TINTS = ["bg-pink-soft", "bg-lilac-soft", "bg-butter-soft", "bg-mint-soft"];

async function MyTickets({ bookingId, eventId }: { bookingId: string; eventId: string }) {
  let tickets;
  let event = null;
  try {
    const [booking, ev] = await Promise.all([getBooking(bookingId), getEvent(eventId).catch(() => null)]);
    event = ev;
    const ok = booking.tickets.filter((t) => t.status.toUpperCase() === "SUCCESS");
    tickets = await Promise.all(ok.map((t) => getTicket(t.ticketId)));
  } catch (e) {
    console.error("[thanks] tickets", e);
    return (
      <p className="mt-8 rounded-2xl bg-butter-soft p-4 text-center font-bold">
        Your tickets are safe in your email and Tunyt account 💌 (we couldn&apos;t show them here right now)
      </p>
    );
  }
  if (tickets.length === 0) return null;

  const withQr = await Promise.all(
    tickets.map(async (t) => ({ ...t, qrSrc: t.qrCode ? await qrImageSrc(t.qrCode).catch(() => null) : null })),
  );

  return (
    <section className="mt-10">
      <h2 className="mb-5 text-center font-display text-3xl font-bold">your tickets 🎟️</h2>
      <div className="flex flex-col gap-6">
        {withQr.map((t, i) => (
          <article
            key={t.ticketId}
            className={`sticker pop-in relative overflow-hidden rounded-[2rem] hover:!transform-none ${TICKET_TINTS[i % 4]}`}
            style={{ animationDelay: `${i * 120}ms` }}
          >
            <div className="p-6 pb-5">
              <p className="text-xs font-extrabold uppercase tracking-widest text-cocoa-soft">
                ticket {i + 1} of {withQr.length}
              </p>
              <h3 className="mt-1 font-display text-2xl font-bold leading-tight">{event?.title ?? "Your event"}</h3>
              {event && (
                <p className="mt-1 text-sm font-bold text-cocoa-soft">
                  📅 {eventDay(event.time, event.timezoneOffsetMinutes)} · 🕗 {eventTime(event.time, event.timezoneOffsetMinutes)}
                  <br />📍 {event.location}
                </p>
              )}
              <p className="mt-3 inline-block rounded-full border-2 border-cocoa bg-paper px-3 py-1 text-sm font-extrabold">
                {t.quantity}× {t.ticketTypeName}
              </p>
            </div>

            {/* perforation */}
            <div className="relative border-t-[3px] border-dashed border-cocoa/30">
              <span className="absolute -left-4 -top-4 h-8 w-8 rounded-full border-2 border-cocoa bg-cream" />
              <span className="absolute -right-4 -top-4 h-8 w-8 rounded-full border-2 border-cocoa bg-cream" />
            </div>

            <div className="flex flex-col items-center gap-2 p-6">
              {t.qrSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={t.qrSrc}
                  alt={`QR code for ticket ${i + 1}`}
                  width={208}
                  height={208}
                  className="h-52 w-52 rounded-2xl border-2 border-cocoa bg-paper p-2"
                />
              ) : (
                <p className="rounded-2xl bg-paper p-4 text-sm font-bold">QR code is in your email 💌</p>
              )}
              <p className="text-xs font-semibold text-cocoa-soft">
                {t.checkedIn ? "✅ already checked in" : "show this at the door"} · {t.ticketId.slice(0, 8)}
              </p>
            </div>
          </article>
        ))}
      </div>
      <p className="mt-6 text-center text-sm font-semibold text-cocoa-soft">
        tip: take a screenshot 📸 · this page keeps working in this browser for 30 days
      </p>
    </section>
  );
}
