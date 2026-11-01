import { Suspense } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { getCheckoutSession, TunytError, type CheckoutSession } from "@/lib/tunyt";
import { rupees } from "@/lib/format";

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
  const orderId = (await cookies()).get("tunyt_order")?.value;

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
    const ours = !!orderId && session.clientReference === orderId;
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
